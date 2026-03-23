import { useState, useEffect, useCallback } from "react";
import {
  useWalletConnection,
  useSendTransaction,
  useBalance,
} from "@solana/react-hooks";
import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getBytesEncoder,
  getU64Encoder,
  type Address,
} from "@solana/kit";
import {
  getBuyCouponInstructionDataEncoder,
  getCreateOfferInstructionDataEncoder,
  getRedeemCouponInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS,
} from "./generated/vault";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

export function VaultCard() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [offerId, setOfferId] = useState("1");
  const [amountSol, setAmountSol] = useState("0.1");
  const [merchantAddress, setMerchantAddress] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [platformAddress, setPlatformAddress] = useState("");
  const [offerAddress, setOfferAddress] = useState<Address | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const walletAddress = wallet?.account.address;
  
  // Get wallet balance to validate we have enough SOL
  const walletBalance = useBalance(walletAddress ?? undefined);
  const walletLamports = walletBalance?.lamports ?? 0n;
  const walletSol = Number(walletLamports) / Number(LAMPORTS_PER_SOL);

  useEffect(() => {
    if (!walletAddress) return;
    if (!merchantAddress) setMerchantAddress(walletAddress.toString());
    if (!platformAddress) setPlatformAddress(walletAddress.toString());
  }, [walletAddress, merchantAddress, platformAddress]);

  useEffect(() => {
    async function deriveOfferPda() {
      if (!merchantAddress || !offerId) {
        setOfferAddress(null);
        return;
      }

      const parsedOfferId = Number(offerId);
      if (!Number.isInteger(parsedOfferId) || parsedOfferId < 0) {
        setOfferAddress(null);
        return;
      }

      try {
        const [pda] = await getProgramDerivedAddress({
          programAddress: VAULT_PROGRAM_ADDRESS,
          seeds: [
            getBytesEncoder().encode(new Uint8Array([111, 102, 102, 101, 114])), // "offer"
            getAddressEncoder().encode(merchantAddress as Address),
            getU64Encoder().encode(BigInt(parsedOfferId)),
          ],
        });
        setOfferAddress(pda);
      } catch {
        setOfferAddress(null);
      }
    }

    deriveOfferPda();
  }, [merchantAddress, offerId]);

  const offerBalance = useBalance(offerAddress ?? undefined);
  const offerLamports = offerBalance?.lamports ?? 0n;
  const offerSol = Number(offerLamports) / Number(LAMPORTS_PER_SOL);

  const handleCreateOffer = useCallback(async () => {
    if (!walletAddress || !offerAddress) {
      setTxStatus("❌ Wallet info missing. Please connect your wallet.");
      return;
    }

    if (merchantAddress !== walletAddress.toString()) {
      setTxStatus("❌ Merchant must be the connected wallet.");
      return;
    }

    try {
      const parsedOfferId = Number(offerId);
      const parsedAmount = Number(amountSol);

      // Validation
      if (!Number.isInteger(parsedOfferId) || parsedOfferId < 0 || parsedOfferId > 2147483647) {
        setTxStatus("❌ Offer ID must be a valid positive integer.");
        return;
      }

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setTxStatus("❌ Amount must be greater than 0.");
        return;
      }

      if (parsedAmount > 1000) {
        setTxStatus("❌ Amount too large (max 1000 SOL).");
        return;
      }

      // Check wallet balance (need ~0.003 SOL for account + amount for offer)
      const minRequired = 0.01; // Minimum for account + fees
      if (walletSol < minRequired) {
        setTxStatus(`❌ Insufficient balance. Have ${walletSol.toFixed(3)} SOL, need at least ${minRequired} SOL.`);
        return;
      }

      const amountLamports = BigInt(
        Math.floor(parsedAmount * Number(LAMPORTS_PER_SOL)),
      );

      const now = Math.floor(Date.now() / 1000);
      const expiryTs = BigInt(now + 24 * 60 * 60); // 24h from now

      if (expiryTs <= BigInt(now)) {
        setTxStatus("❌ Expiry must be in the future.");
        return;
      }

      setTxStatus("🔄 Creating offer on-chain....");

      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress, role: 3 }, // signer, writable
          { address: offerAddress, role: 1 },  // writable (init)
          { address: platformAddress as Address, role: 0 }, // readonly
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 }, // readonly
        ],
        data: getCreateOfferInstructionDataEncoder().encode({
          offerId: BigInt(parsedOfferId),
          amount: amountLamports,
          expiryTs,
          platformFeeBps: 500,
        }),
      };

      const signature = await send({ instructions: [instruction] });
      setTxStatus(`✅ Offer created! Sig: ${signature?.slice(0, 16)}...`);
      
      // Reset form after success
      setTimeout(() => {
        setOfferId((String(Date.now()).slice(-6)));
        setAmountSol("0.1");
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      
      // Parse common errors
      if (errorMsg.includes("insufficient")) {
        setTxStatus("❌ Insufficient SOL. Need ~0.003 SOL for account creation.");
      } else if (errorMsg.includes("already")) {
        setTxStatus("❌ Offer ID already exists. Try a different ID.");
      } else if (errorMsg.includes("0x1")) {
        setTxStatus("❌ Invalid expiry. Must be in the future.");
      } else if (errorMsg.includes("0x2")) {
        setTxStatus("❌ Invalid amount. Must be > 0.");
      } else if (errorMsg.includes("transaction plan failed")) {
        setTxStatus("❌ Transaction failed. Check: SOL balance, unique Offer ID, expiry date.");
      } else {
        setTxStatus(`❌ Error: ${errorMsg}`);
      }
      console.error("Create offer error:", err);
    }
  }, [walletAddress, offerAddress, merchantAddress, offerId, amountSol, platformAddress, walletSol, send]);

  const handleBuyCoupon = useCallback(async () => {
    if (!walletAddress || !offerAddress) return;

    try {
      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress, role: 3 },
          { address: offerAddress, role: 1 },
          { address: merchantAddress as Address, role: 0 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: getBuyCouponInstructionDataEncoder().encode({}),
      };

      setTxStatus("Awaiting signature for buy_coupon...");
      const signature = await send({ instructions: [instruction] });
      setTxStatus(`Coupon bought. Signature: ${signature?.slice(0, 20)}...`);
    } catch (err) {
      setTxStatus(
        `Buy coupon failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }, [walletAddress, offerAddress, merchantAddress, send]);

  const handleRedeemCoupon = useCallback(async () => {
    if (!walletAddress || !offerAddress || !buyerAddress) return;

    if (merchantAddress !== walletAddress.toString()) {
      setTxStatus("For redeem_coupon, merchant must be the connected wallet.");
      return;
    }

    try {
      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress, role: 3 },
          { address: offerAddress, role: 1 },
          { address: buyerAddress as Address, role: 1 },
          { address: platformAddress as Address, role: 1 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: getRedeemCouponInstructionDataEncoder().encode({}),
      };

      setTxStatus("Awaiting signature for redeem_coupon...");
      const signature = await send({ instructions: [instruction] });
      setTxStatus(`Coupon redeemed. Signature: ${signature?.slice(0, 20)}...`);
    } catch (err) {
      setTxStatus(
        `Redeem coupon failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }
  }, [walletAddress, offerAddress, merchantAddress, buyerAddress, platformAddress, send]);

  if (status !== "connected") {
    return (
      <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
        <div className="space-y-1">
          <p className="text-lg font-semibold">Escrow MVP</p>
          <p className="text-sm text-muted">
            Connect your wallet to create offers, buy coupons, and redeem.
          </p>
        </div>
        <div className="rounded-lg bg-cream/50 p-4 text-center text-sm text-muted">
          Wallet not connected
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl space-y-4 rounded-2xl border border-border-low bg-card p-6 shadow-[0_20px_80px_-50px_rgba(0,0,0,0.35)]">
      <div className="space-y-1">
        <p className="text-lg font-semibold">Escrow MVP</p>
        <p className="text-sm text-muted">
          Step-by-step base: create offer, buy coupon, redeem coupon.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          placeholder="Offer ID (e.g. 1)"
          value={offerId}
          onChange={(e) => setOfferId(e.target.value)}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none"
        />
        <input
          placeholder="Amount in SOL (e.g. 0.1)"
          value={amountSol}
          onChange={(e) => setAmountSol(e.target.value)}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none"
        />
        <input
          placeholder="Merchant address"
          value={merchantAddress}
          onChange={(e) => setMerchantAddress(e.target.value)}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none sm:col-span-2"
        />
        <input
          placeholder="Platform address"
          value={platformAddress}
          onChange={(e) => setPlatformAddress(e.target.value)}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none sm:col-span-2"
        />
        <input
          placeholder="Buyer address (for redeem)"
          value={buyerAddress}
          onChange={(e) => setBuyerAddress(e.target.value)}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm outline-none sm:col-span-2"
        />
      </div>

      <div className="rounded-xl border border-border-low bg-cream/30 p-4 text-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Wallet Balance</p>
            <p className="mt-1 font-mono text-sm font-bold">
              {walletSol.toFixed(4)} SOL
              {walletSol < 0.01 && <span className="ml-2 text-red-500">⚠️ Low balance</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted">Derived Offer PDA</p>
            <p className="mt-1 truncate font-mono text-xs">{offerAddress ?? "Invalid inputs"}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Offer account lamports: {offerSol.toFixed(6)} SOL</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={handleCreateOffer}
          disabled={isSending || !offerAddress}
          className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
        >
          {isSending ? "Confirming..." : "Create Offer"}
        </button>
        <button
          onClick={handleBuyCoupon}
          disabled={isSending || !offerAddress}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          {isSending ? "Confirming..." : "Buy Coupon"}
        </button>
        <button
          onClick={handleRedeemCoupon}
          disabled={isSending || !offerAddress || !buyerAddress}
          className="rounded-lg border border-border-low bg-card px-4 py-2.5 text-sm font-medium disabled:opacity-40"
        >
          {isSending ? "Confirming..." : "Redeem Coupon"}
        </button>
      </div>

      {txStatus && (
        <div className="rounded-lg border border-border-low bg-cream/50 px-4 py-3 text-sm">
          {txStatus}
        </div>
      )}
    </section>
  );
}
