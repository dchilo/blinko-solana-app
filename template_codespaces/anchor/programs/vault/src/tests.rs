#[cfg(test)]
mod tests {
    use crate::{
        instruction::{BuyCoupon, CreateOffer, RedeemCoupon, RefundExpired},
        Offer, OfferStatus, ID as PROGRAM_ID,
    };
    use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
    use litesvm::LiteSVM;
    use solana_sdk::{
        instruction::Instruction,
        pubkey::Pubkey,
        signature::Keypair,
        signer::Signer,
        system_program,
        transaction::Transaction,
    };

    const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
    const FEE_BPS: u16 = 500;
    const OFFER_AMOUNT: u64 = LAMPORTS_PER_SOL;
    const FAR_FUTURE_EXPIRY: i64 = 4_000_000_000;

    fn get_offer_pda(merchant: &Pubkey, offer_id: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[b"offer", merchant.as_ref(), &offer_id.to_le_bytes()],
            &PROGRAM_ID,
        )
    }

    fn create_offer_ix(
        merchant: &Pubkey,
        offer: &Pubkey,
        platform: &Pubkey,
        offer_id: u64,
        amount: u64,
        expiry_ts: i64,
        platform_fee_bps: u16,
    ) -> Instruction {
        let accounts = crate::accounts::CreateOffer {
            merchant: *merchant,
            offer: *offer,
            platform: *platform,
            system_program: system_program::ID,
        }
        .to_account_metas(None);

        let data = CreateOffer {
            offer_id,
            amount,
            expiry_ts,
            platform_fee_bps,
        }
        .data();

        Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data,
        }
    }

    fn buy_coupon_ix(buyer: &Pubkey, offer: &Pubkey, merchant: &Pubkey) -> Instruction {
        let accounts = crate::accounts::BuyCoupon {
            buyer: *buyer,
            offer: *offer,
            merchant: *merchant,
            system_program: system_program::ID,
        }
        .to_account_metas(None);

        let data = BuyCoupon {}.data();

        Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data,
        }
    }

    fn redeem_coupon_ix(
        merchant: &Pubkey,
        offer: &Pubkey,
        buyer: &Pubkey,
        platform: &Pubkey,
    ) -> Instruction {
        let accounts = crate::accounts::RedeemCoupon {
            merchant: *merchant,
            offer: *offer,
            buyer: *buyer,
            platform: *platform,
            system_program: system_program::ID,
        }
        .to_account_metas(None);

        let data = RedeemCoupon {}.data();

        Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data,
        }
    }

    fn refund_expired_ix(buyer: &Pubkey, offer: &Pubkey) -> Instruction {
        let accounts = crate::accounts::RefundExpired {
            buyer: *buyer,
            offer: *offer,
            system_program: system_program::ID,
        }
        .to_account_metas(None);

        let data = RefundExpired {}.data();

        Instruction {
            program_id: PROGRAM_ID,
            accounts,
            data,
        }
    }

    #[test]
    fn test_create_buy_redeem_flow() {
        let mut svm = LiteSVM::new();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let relayer = Keypair::new();
        let merchant = Keypair::new();
        let buyer = Keypair::new();
        let platform = Keypair::new();

        svm.airdrop(&relayer.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&merchant.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&buyer.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&platform.pubkey(), LAMPORTS_PER_SOL).unwrap();

        let offer_id = 1;
        let (offer_pda, _offer_bump) = get_offer_pda(&merchant.pubkey(), offer_id);

        let create_ix = create_offer_ix(
            &merchant.pubkey(),
            &offer_pda,
            &platform.pubkey(),
            offer_id,
            OFFER_AMOUNT,
            FAR_FUTURE_EXPIRY,
            FEE_BPS,
        );

        let blockhash = svm.latest_blockhash();
        let create_tx = Transaction::new_signed_with_payer(
            &[create_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &merchant],
            blockhash,
        );
        svm.send_transaction(create_tx).unwrap();

        let buy_ix = buy_coupon_ix(&buyer.pubkey(), &offer_pda, &merchant.pubkey());

        let blockhash = svm.latest_blockhash();
        let buy_tx = Transaction::new_signed_with_payer(
            &[buy_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &buyer],
            blockhash,
        );
        svm.send_transaction(buy_tx).unwrap();

        let merchant_before = svm.get_balance(&merchant.pubkey()).unwrap();
        let platform_before = svm.get_balance(&platform.pubkey()).unwrap();

        let redeem_ix = redeem_coupon_ix(
            &merchant.pubkey(),
            &offer_pda,
            &buyer.pubkey(),
            &platform.pubkey(),
        );

        let blockhash = svm.latest_blockhash();
        let redeem_tx = Transaction::new_signed_with_payer(
            &[redeem_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &merchant],
            blockhash,
        );

        let result = svm.send_transaction(redeem_tx);
        assert!(result.is_ok(), "Redeem should succeed");

        let merchant_after = svm.get_balance(&merchant.pubkey()).unwrap();
        let platform_after = svm.get_balance(&platform.pubkey()).unwrap();

        let expected_platform = (OFFER_AMOUNT as u128 * FEE_BPS as u128 / 10_000) as u64;
        let expected_merchant = OFFER_AMOUNT - expected_platform;

        assert_eq!(
            merchant_after - merchant_before,
            expected_merchant,
            "Merchant should receive 95%"
        );
        assert_eq!(
            platform_after - platform_before,
            expected_platform,
            "Platform should receive 5%"
        );

        let offer_account = svm.get_account(&offer_pda).unwrap();
        let mut data = offer_account.data.as_slice();
        let offer_state = Offer::try_deserialize(&mut data).unwrap();
        assert_eq!(offer_state.status, OfferStatus::Redeemed);
    }

    #[test]
    fn test_buy_fails_if_already_bought() {
        let mut svm = LiteSVM::new();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let relayer = Keypair::new();
        let merchant = Keypair::new();
        let buyer_a = Keypair::new();
        let buyer_b = Keypair::new();
        let platform = Keypair::new();

        svm.airdrop(&relayer.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&merchant.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&buyer_a.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&buyer_b.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&platform.pubkey(), LAMPORTS_PER_SOL).unwrap();

        let offer_id = 2;
        let (offer_pda, _offer_bump) = get_offer_pda(&merchant.pubkey(), offer_id);

        let create_ix = create_offer_ix(
            &merchant.pubkey(),
            &offer_pda,
            &platform.pubkey(),
            offer_id,
            OFFER_AMOUNT,
            FAR_FUTURE_EXPIRY,
            FEE_BPS,
        );

        let blockhash = svm.latest_blockhash();
        let create_tx = Transaction::new_signed_with_payer(
            &[create_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &merchant],
            blockhash,
        );
        svm.send_transaction(create_tx).unwrap();

        let buy_a_ix = buy_coupon_ix(&buyer_a.pubkey(), &offer_pda, &merchant.pubkey());

        let blockhash = svm.latest_blockhash();
        let buy_a_tx = Transaction::new_signed_with_payer(
            &[buy_a_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &buyer_a],
            blockhash,
        );
        svm.send_transaction(buy_a_tx).unwrap();

        let buy_b_ix = buy_coupon_ix(&buyer_b.pubkey(), &offer_pda, &merchant.pubkey());

        let blockhash = svm.latest_blockhash();
        let buy_b_tx = Transaction::new_signed_with_payer(
            &[buy_b_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &buyer_b],
            blockhash,
        );

        let result = svm.send_transaction(buy_b_tx);
        assert!(result.is_err(), "Second buy should fail");
    }

    #[test]
    fn test_refund_fails_if_not_expired() {
        let mut svm = LiteSVM::new();

        let program_bytes = include_bytes!("../../../target/deploy/vault.so");
        svm.add_program(PROGRAM_ID, program_bytes).unwrap();

        let relayer = Keypair::new();
        let merchant = Keypair::new();
        let buyer = Keypair::new();
        let platform = Keypair::new();

        svm.airdrop(&relayer.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&merchant.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&buyer.pubkey(), 5 * LAMPORTS_PER_SOL).unwrap();
        svm.airdrop(&platform.pubkey(), LAMPORTS_PER_SOL).unwrap();

        let offer_id = 3;
        let (offer_pda, _offer_bump) = get_offer_pda(&merchant.pubkey(), offer_id);

        let create_ix = create_offer_ix(
            &merchant.pubkey(),
            &offer_pda,
            &platform.pubkey(),
            offer_id,
            OFFER_AMOUNT,
            FAR_FUTURE_EXPIRY,
            FEE_BPS,
        );

        let blockhash = svm.latest_blockhash();
        let create_tx = Transaction::new_signed_with_payer(
            &[create_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &merchant],
            blockhash,
        );
        svm.send_transaction(create_tx).unwrap();

        let buy_ix = buy_coupon_ix(&buyer.pubkey(), &offer_pda, &merchant.pubkey());

        let blockhash = svm.latest_blockhash();
        let buy_tx = Transaction::new_signed_with_payer(
            &[buy_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &buyer],
            blockhash,
        );
        svm.send_transaction(buy_tx).unwrap();

        let refund_ix = refund_expired_ix(&buyer.pubkey(), &offer_pda);
        let blockhash = svm.latest_blockhash();
        let refund_tx = Transaction::new_signed_with_payer(
            &[refund_ix],
            Some(&relayer.pubkey()),
            &[&relayer, &buyer],
            blockhash,
        );

        let result = svm.send_transaction(refund_tx);
        assert!(result.is_err(), "Refund should fail when offer is not expired");

        let offer_account = svm.get_account(&offer_pda).unwrap();
        let mut data = offer_account.data.as_slice();
        let offer_state = Offer::try_deserialize(&mut data).unwrap();
        assert_eq!(offer_state.status, OfferStatus::Bought);
    }
}
