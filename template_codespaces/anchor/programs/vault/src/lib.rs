use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

#[cfg(test)]
mod tests;

declare_id!("E5esXJ8cfHNa9pSTr5nqqEMpQ81tQ2PBmnHiz5UWF7fN");

#[program]
pub mod vault {
    use super::*;

    pub fn create_offer(
        ctx: Context<CreateOffer>,
        offer_id: u64,
        amount: u64,
        expiry_ts: i64,
        platform_fee_bps: u16,
    ) -> Result<()> {
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(platform_fee_bps <= 10_000, EscrowError::InvalidFeeBps);
        require!(expiry_ts > Clock::get()?.unix_timestamp, EscrowError::InvalidExpiry);

        let offer = &mut ctx.accounts.offer;
        offer.merchant = ctx.accounts.merchant.key();
        offer.buyer = Pubkey::default();
        offer.platform = ctx.accounts.platform.key();
        offer.offer_id = offer_id;
        offer.amount = amount;
        offer.expiry_ts = expiry_ts;
        offer.platform_fee_bps = platform_fee_bps;
        offer.status = OfferStatus::Created;
        offer.bump = ctx.bumps.offer;

        Ok(())
    }

    pub fn buy_coupon(ctx: Context<BuyCoupon>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let amount = ctx.accounts.offer.amount;
        let merchant = ctx.accounts.offer.merchant;

        require!(ctx.accounts.offer.status == OfferStatus::Created, EscrowError::InvalidStatus);
        require!(now < ctx.accounts.offer.expiry_ts, EscrowError::OfferExpired);
        require!(ctx.accounts.buyer.key() != merchant, EscrowError::MerchantCannotBuyOwnOffer);

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.offer.to_account_info(),
                },
            ),
            amount,
        )?;

        let offer = &mut ctx.accounts.offer;
        offer.buyer = ctx.accounts.buyer.key();
        offer.status = OfferStatus::Bought;

        Ok(())
    }

    pub fn redeem_coupon(ctx: Context<RedeemCoupon>) -> Result<()> {
        let offer_info = ctx.accounts.offer.to_account_info();
        let offer_amount = ctx.accounts.offer.amount;
        let fee_bps = ctx.accounts.offer.platform_fee_bps;

        require!(ctx.accounts.offer.status == OfferStatus::Bought, EscrowError::InvalidStatus);

        let platform_amount_u128 = (offer_amount as u128)
            .checked_mul(fee_bps as u128)
            .ok_or(EscrowError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(EscrowError::MathOverflow)?;

        let platform_amount = u64::try_from(platform_amount_u128).map_err(|_| EscrowError::MathOverflow)?;
        let merchant_amount = offer_amount
            .checked_sub(platform_amount)
            .ok_or(EscrowError::MathOverflow)?;

        transfer_from_vault(
            &offer_info,
            &ctx.accounts.merchant.to_account_info(),
            merchant_amount,
        )?;

        transfer_from_vault(
            &offer_info,
            &ctx.accounts.platform.to_account_info(),
            platform_amount,
        )?;

        let offer = &mut ctx.accounts.offer;
        offer.status = OfferStatus::Redeemed;
        Ok(())
    }

    pub fn refund_expired(ctx: Context<RefundExpired>) -> Result<()> {
        let offer_info = ctx.accounts.offer.to_account_info();
        let amount = ctx.accounts.offer.amount;

        require!(ctx.accounts.offer.status == OfferStatus::Bought, EscrowError::InvalidStatus);
        require!(Clock::get()?.unix_timestamp >= ctx.accounts.offer.expiry_ts, EscrowError::NotExpiredYet);

        transfer_from_vault(
            &offer_info,
            &ctx.accounts.buyer.to_account_info(),
            amount,
        )?;

        let offer = &mut ctx.accounts.offer;
        offer.status = OfferStatus::Refunded;
        Ok(())
    }

    // ─────────────────────────────────────────────────
    // initialize_product
    // La empresa registra un producto on-chain.
    // Crea el ProductAccount PDA con precio, stock y metadata.
    // ─────────────────────────────────────────────────
    pub fn initialize_product(
        ctx: Context<InitializeProduct>,
        params: InitializeProductParams,
    ) -> Result<()> {
        require!(
            params.product_id.len() <= ProductAccount::MAX_PRODUCT_ID_LEN,
            LoyaltyError::ProductIdTooLong
        );
        require!(
            params.name.len() <= ProductAccount::MAX_NAME_LEN,
            LoyaltyError::NameTooLong
        );
        require!(
            params.description.len() <= ProductAccount::MAX_DESC_LEN,
            LoyaltyError::DescriptionTooLong
        );
        require!(
            params.metadata_uri.len() <= ProductAccount::MAX_URI_LEN,
            LoyaltyError::MetadataUriTooLong
        );
        require!(params.price > 0, LoyaltyError::InvalidPrice);
        require!(params.stock > 0, LoyaltyError::InvalidStock);

        let product    = &mut ctx.accounts.product_account;
        let clock      = Clock::get()?;

        product.authority      = ctx.accounts.authority.key();
        product.product_id     = params.product_id;
        product.name           = params.name;
        product.description    = params.description;
        product.metadata_uri   = params.metadata_uri;
        product.price          = params.price;
        product.payment_mint   = params.payment_mint;
        product.stock          = params.stock;
        product.active         = true;
        product.total_minted   = 0;
        product.total_redeemed = 0;
        product.created_at     = clock.unix_timestamp;
        product.bump           = ctx.bumps.product_account;

        msg!(
            "Producto '{}' registrado | precio: {} lamports | stock: {}",
            product.product_id,
            product.price,
            product.stock
        );

        Ok(())
    }

    // ─────────────────────────────────────────────────
    // purchase_and_mint
    // El cliente compra un producto. En una sola tx:
    //   1. Transfiere el pago SOL: buyer → company_wallet
    //   2. Mintea 1 NFT-ticket al nft_custody_account (empresa)
    //   3. Crea el PurchaseRecord con redeemed = false
    // ─────────────────────────────────────────────────
    pub fn purchase_and_mint(
        ctx: Context<PurchaseAndMint>,
        _params: PurchaseAndMintParams,
    ) -> Result<()> {
        let product  = &mut ctx.accounts.product_account;
        let buyer    = &ctx.accounts.buyer;
        let clock    = Clock::get()?;

        // 1. Transferir pago SOL: buyer → company_wallet
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: buyer.to_account_info(),
                    to:   ctx.accounts.company_wallet.to_account_info(),
                },
            ),
            product.price,
        )?;

        msg!("Pago de {} lamports transferido a empresa", product.price);

        // 2. Mintear 1 NFT-ticket al custody account de la empresa.
        //    El mint PDA firma por si mismo usando sus propias seeds.
        let product_key   = product.key();
        let buyer_key     = buyer.key();
        let nft_mint_bump = ctx.bumps.nft_mint;

        let mint_seeds: &[&[&[u8]]] = &[&[
            b"nft_mint",
            product_key.as_ref(),
            buyer_key.as_ref(),
            &[nft_mint_bump],
        ]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint:      ctx.accounts.nft_mint.to_account_info(),
                    to:        ctx.accounts.nft_custody_account.to_account_info(),
                    authority: ctx.accounts.nft_mint.to_account_info(),
                },
                mint_seeds,
            ),
            1,
        )?;

        msg!(
            "NFT-ticket minteado. Mint: {} | Custodia: {}",
            ctx.accounts.nft_mint.key(),
            ctx.accounts.nft_custody_account.key()
        );

        // 3. Actualizar stock y contador del producto
        product.stock        -= 1;
        product.total_minted += 1;

        // 4. Crear PurchaseRecord como prueba on-chain de la compra
        let record             = &mut ctx.accounts.purchase_record;
        record.buyer           = buyer.key();
        record.product_account = product.key();
        record.nft_mint        = ctx.accounts.nft_mint.key();
        record.purchased_at    = clock.unix_timestamp;
        record.redeemed        = false;
        record.bump            = ctx.bumps.purchase_record;

        msg!(
            "PurchaseRecord creado | buyer: {} | redeemed: false",
            buyer.key()
        );

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(offer_id: u64)]
pub struct CreateOffer<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,
    #[account(
        init,
        payer = merchant,
        space = Offer::SPACE,
        seeds = [b"offer", merchant.key().as_ref(), &offer_id.to_le_bytes()],
        bump,
    )]
    pub offer: Account<'info, Offer>,
    pub platform: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyCoupon<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"offer", offer.merchant.as_ref(), &offer.offer_id.to_le_bytes()],
        bump = offer.bump,
    )]
    pub offer: Account<'info, Offer>,
    #[account(address = offer.merchant @ EscrowError::UnauthorizedMerchant)]
    pub merchant: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RedeemCoupon<'info> {
    #[account(mut, address = offer.merchant @ EscrowError::UnauthorizedMerchant)]
    pub merchant: Signer<'info>,
    #[account(
        mut,
        seeds = [b"offer", offer.merchant.as_ref(), &offer.offer_id.to_le_bytes()],
        bump = offer.bump,
    )]
    pub offer: Account<'info, Offer>,
    #[account(mut, address = offer.buyer @ EscrowError::UnauthorizedBuyer)]
    pub buyer: SystemAccount<'info>,
    #[account(mut, address = offer.platform @ EscrowError::UnauthorizedPlatform)]
    pub platform: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundExpired<'info> {
    #[account(mut, address = offer.buyer @ EscrowError::UnauthorizedBuyer)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"offer", offer.merchant.as_ref(), &offer.offer_id.to_le_bytes()],
        bump = offer.bump,
    )]
    pub offer: Account<'info, Offer>,
    pub system_program: Program<'info, System>,
}

// ═══════════════════════════════════════════════════════
// ACCOUNTS — initialize_product
// ═══════════════════════════════════════════════════════

#[derive(Accounts)]
#[instruction(params: InitializeProductParams)]
pub struct InitializeProduct<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = ProductAccount::LEN,
        seeds = [
            b"product",
            authority.key().as_ref(),
            params.product_id.as_bytes(),
        ],
        bump
    )]
    pub product_account: Account<'info, ProductAccount>,

    pub system_program: Program<'info, System>,
}

// ═══════════════════════════════════════════════════════
// ACCOUNTS — purchase_and_mint
// ═══════════════════════════════════════════════════════

#[derive(Accounts)]
pub struct PurchaseAndMint<'info> {
    /// Cliente que compra: firma y paga el precio del producto.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Wallet de la empresa: recibe el pago y custodia el NFT-ticket.
    /// CHECK: solo recibe SOL. Validamos que sea la authority del producto.
    #[account(
        mut,
        constraint = product_account.authority == company_wallet.key()
            @ LoyaltyError::Unauthorized
    )]
    pub company_wallet: SystemAccount<'info>,

    /// ProductAccount del producto que se compra.
    #[account(
        mut,
        seeds = [
            b"product",
            company_wallet.key().as_ref(),
            product_account.product_id.as_bytes(),
        ],
        bump = product_account.bump,
        constraint = product_account.active    @ LoyaltyError::ProductNotActive,
        constraint = product_account.stock > 0 @ LoyaltyError::OutOfStock,
    )]
    pub product_account: Account<'info, ProductAccount>,

    /// Mint del NFT-ticket. Creado en esta tx por el programa.
    /// PDA: ["nft_mint", product_account, buyer]
    /// Unico por combinacion comprador + producto.
    #[account(
        init,
        payer = buyer,
        mint::decimals = 0,
        mint::authority = nft_mint,
        mint::freeze_authority = nft_mint,
        seeds = [
            b"nft_mint",
            product_account.key().as_ref(),
            buyer.key().as_ref(),
        ],
        bump
    )]
    pub nft_mint: Account<'info, Mint>,

    /// Token account de la empresa donde queda custodiado el NFT.
    /// El cliente nunca recibe el token hasta el canje en tienda.
    /// PDA: ["nft_custody", nft_mint]
    #[account(
        init,
        payer = buyer,
        token::mint = nft_mint,
        token::authority = company_wallet,
        seeds = [
            b"nft_custody",
            nft_mint.key().as_ref(),
        ],
        bump
    )]
    pub nft_custody_account: Account<'info, TokenAccount>,

    /// Prueba on-chain de la compra. redeemed = false hasta el canje.
    /// PDA: ["purchase", product_account, buyer]
    #[account(
        init,
        payer = buyer,
        space = PurchaseRecord::LEN,
        seeds = [
            b"purchase",
            product_account.key().as_ref(),
            buyer.key().as_ref(),
        ],
        bump
    )]
    pub purchase_record: Account<'info, PurchaseRecord>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[account]
pub struct Offer {
    pub merchant: Pubkey,
    pub buyer: Pubkey,
    pub platform: Pubkey,
    pub offer_id: u64,
    pub amount: u64,
    pub expiry_ts: i64,
    pub platform_fee_bps: u16,
    pub status: OfferStatus,
    pub bump: u8,
}

impl Offer {
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 2 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum OfferStatus {
    Created,
    Bought,
    Redeemed,
    Refunded,
}

/// Cuenta que representa un producto publicado por una empresa.
/// PDA: ["product", authority, product_id]
#[account]
pub struct ProductAccount {
    pub authority:      Pubkey,
    pub product_id:     String,
    pub name:           String,
    pub description:    String,
    pub metadata_uri:   String,
    pub price:          u64,
    pub payment_mint:   Option<Pubkey>,
    pub stock:          u32,
    pub active:         bool,
    pub total_minted:   u32,
    pub total_redeemed: u32,
    pub created_at:     i64,
    pub bump:           u8,
}

impl ProductAccount {
    pub const MAX_PRODUCT_ID_LEN: usize = 32;
    pub const MAX_NAME_LEN:       usize = 64;
    pub const MAX_DESC_LEN:       usize = 256;
    pub const MAX_URI_LEN:        usize = 200;

    pub const LEN: usize =
        8
        + 32
        + 4 + Self::MAX_PRODUCT_ID_LEN
        + 4 + Self::MAX_NAME_LEN
        + 4 + Self::MAX_DESC_LEN
        + 4 + Self::MAX_URI_LEN
        + 8
        + 1 + 32
        + 4
        + 1
        + 4
        + 4
        + 8
        + 1;
}

/// Registro de compra: liga buyer <-> producto <-> NFT mint.
/// PDA: ["purchase", product_account, buyer]
#[account]
pub struct PurchaseRecord {
    pub buyer:           Pubkey,
    pub product_account: Pubkey,
    pub nft_mint:        Pubkey,
    pub purchased_at:    i64,
    pub redeemed:        bool,
    pub bump:            u8,
}

impl PurchaseRecord {
    pub const LEN: usize =
        8
        + 32
        + 32
        + 32
        + 8
        + 1
        + 1;
}

// ═══════════════════════════════════════════════════════
// PARAMS
// ═══════════════════════════════════════════════════════

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProductParams {
    pub product_id:   String,
    pub name:         String,
    pub description:  String,
    pub metadata_uri: String,
    pub price:        u64,
    pub payment_mint: Option<Pubkey>,
    pub stock:        u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PurchaseAndMintParams {
    pub _placeholder: u8,
}

#[error_code]
pub enum EscrowError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid fee bps")]
    InvalidFeeBps,
    #[msg("Invalid expiry")]
    InvalidExpiry,
    #[msg("Invalid offer status for this action")]
    InvalidStatus,
    #[msg("Offer already expired")]
    OfferExpired,
    #[msg("Merchant cannot buy own offer")]
    MerchantCannotBuyOwnOffer,
    #[msg("Only the offer merchant can redeem")]
    UnauthorizedMerchant,
    #[msg("Only the offer buyer can be used")]
    UnauthorizedBuyer,
    #[msg("Only the configured platform account can be used")]
    UnauthorizedPlatform,
    #[msg("Offer is not expired yet")]
    NotExpiredYet,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Escrow balance is insufficient")]
    InsufficientEscrowBalance,
}

// ═══════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════

#[error_code]
pub enum LoyaltyError {
    #[msg("El product_id supera los 32 caracteres permitidos")]
    ProductIdTooLong,
    #[msg("El nombre supera los 64 caracteres permitidos")]
    NameTooLong,
    #[msg("La descripcion supera los 256 caracteres permitidos")]
    DescriptionTooLong,
    #[msg("La URI de metadata supera los 200 caracteres permitidos")]
    MetadataUriTooLong,
    #[msg("El precio debe ser mayor a cero")]
    InvalidPrice,
    #[msg("El stock debe ser mayor a cero")]
    InvalidStock,
    #[msg("El producto no esta activo")]
    ProductNotActive,
    #[msg("No hay stock disponible")]
    OutOfStock,
    #[msg("No tienes autorizacion para esta operacion")]
    Unauthorized,
}

fn transfer_from_vault<'info>(
    escrow_source: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }

    let current_source = escrow_source.lamports();
    let current_destination = destination.lamports();

    let new_source = current_source
        .checked_sub(amount)
        .ok_or(EscrowError::InsufficientEscrowBalance)?;
    let new_destination = current_destination
        .checked_add(amount)
        .ok_or(EscrowError::MathOverflow)?;

    **escrow_source.try_borrow_mut_lamports()? = new_source;
    **destination.try_borrow_mut_lamports()? = new_destination;

    Ok(())
}
