use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

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
