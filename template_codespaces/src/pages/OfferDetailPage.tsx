import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWalletConnection, useSendTransaction, useBalance } from "@solana/react-hooks";
import { type Address } from "@solana/kit";
import {
  getBuyCouponInstructionDataEncoder,
  getRedeemCouponInstructionDataEncoder,
  VAULT_PROGRAM_ADDRESS,
} from "../generated/vault";
import { fetchOffer, CATEGORY_LABELS, CATEGORY_EMOJI, type OfferRecord } from "../lib/backend";
import { saveCoupon } from "../lib/coupons";

const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111" as Address;

function BoughtModal({ offer, onClose }: { offer: OfferRecord; pda: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-zinc-900">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">¡Cupón adquirido!</h2>
        <p className="mt-1 text-sm text-muted">Tu escrow on-chain está activo. Presentá el QR al merchant para canjearlo.</p>

        <div className="mt-5 rounded-2xl border border-border-low bg-cream/40 p-4 text-left dark:bg-zinc-800/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{CATEGORY_EMOJI[offer.category]} {CATEGORY_LABELS[offer.category]}</p>
          <p className="mt-1 font-semibold text-foreground">{offer.title}</p>
          <p className="mt-0.5 text-sm text-muted">{offer.amountSol} SOL · ID {offer.offerId}</p>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-foreground py-3.5 text-sm font-semibold text-background"
          >
            Ver mis cupones
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-border-low py-3 text-sm font-medium text-muted"
          >
            Seguir explorando
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfferDetailPage() {
  const { pda } = useParams<{ pda: string }>();
  const navigate = useNavigate();
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();

  const [offer, setOffer] = useState<OfferRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [buyerForRedeem, setBuyerForRedeem] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const walletAddress = wallet?.account.address.toString();
  const isMerchant = walletAddress === offer?.merchantWallet;
  const isExpired = offer ? Date.now() / 1000 > offer.expiryTs : false;

  const pdaBalance = useBalance(pda as Address | undefined);
  const pdaSol = pdaBalance?.lamports ? Number(pdaBalance.lamports) / 1e9 : 0;
  const isBought = pdaSol > 0 && pdaSol >= (offer?.amountSol ?? 0) * 0.99;

  useEffect(() => {
    if (!pda) return;
    fetchOffer(pda)
      .then(setOffer)
      .catch(() => setOffer(null))
      .finally(() => setLoading(false));
  }, [pda]);

  const handleBuy = useCallback(async () => {
    if (!walletAddress || !offer || !pda) return;
    try {
      setTxStatus("Esperando firma...");
      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: 3 },
          { address: pda as Address, role: 1 },
          { address: offer.merchantWallet as Address, role: 0 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: getBuyCouponInstructionDataEncoder().encode({}),
      };
      await send({ instructions: [instruction] });

      saveCoupon({
        pda,
        offerId: offer.offerId,
        title: offer.title,
        description: offer.description,
        merchantWallet: offer.merchantWallet,
        amountSol: offer.amountSol,
        expiryTs: offer.expiryTs,
        category: offer.category,
        boughtAt: Date.now(),
      });

      setTxStatus(null);
      setShowSuccessModal(true);
    } catch (err) {
      setTxStatus(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
    }
  }, [walletAddress, offer, pda, send]);

  const handleRedeem = useCallback(async () => {
    if (!walletAddress || !offer || !pda || !buyerForRedeem) return;
    try {
      setTxStatus("Esperando firma para canjear...");
      const instruction = {
        programAddress: VAULT_PROGRAM_ADDRESS,
        accounts: [
          { address: walletAddress as Address, role: 3 },
          { address: pda as Address, role: 1 },
          { address: buyerForRedeem as Address, role: 1 },
          { address: offer.merchantWallet as Address, role: 1 },
          { address: SYSTEM_PROGRAM_ADDRESS, role: 0 },
        ],
        data: getRedeemCouponInstructionDataEncoder().encode({}),
      };
      const sig = await send({ instructions: [instruction] });
      setTxStatus(`¡Canjeado! Fondos distribuidos. Firma: ${sig?.slice(0, 16)}...`);
    } catch (err) {
      setTxStatus(`Error: ${err instanceof Error ? err.message : "Error desconocido"}`);
    }
  }, [walletAddress, offer, pda, buyerForRedeem, send]);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted">Cargando oferta...</div>;
  }

  if (!offer) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-3xl">🔍</p>
        <p className="font-semibold">Oferta no encontrada</p>
        <button onClick={() => navigate("/")} className="text-sm text-muted underline">Volver al marketplace</button>
      </div>
    );
  }

  const expiryDate = new Date(offer.expiryTs * 1000).toLocaleDateString("es", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <>
      {showSuccessModal && offer && pda && (
        <BoughtModal
          offer={offer}
          pda={pda}
          onClose={() => {
            setShowSuccessModal(false);
            navigate("/coupons");
          }}
        />
      )}

      <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {/* Back */}
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-muted active:opacity-60">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        {/* Header */}
        <div className="rounded-3xl border border-border-low bg-card p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">{CATEGORY_EMOJI[offer.category]}</span>
            <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-foreground/80">
              {CATEGORY_LABELS[offer.category]}
            </span>
            {isExpired && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                Expirado
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-foreground">{offer.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">{offer.description}</p>

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-cream/40 p-3 dark:bg-zinc-800/40">
              <p className="text-xs uppercase tracking-wide text-muted">Precio</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">{offer.amountSol} SOL</p>
            </div>
            <div className="rounded-2xl bg-cream/40 p-3 dark:bg-zinc-800/40">
              <p className="text-xs uppercase tracking-wide text-muted">Vence</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{expiryDate}</p>
            </div>
            <div className="rounded-2xl bg-cream/40 p-3 dark:bg-zinc-800/40">
              <p className="text-xs uppercase tracking-wide text-muted">Merchant recibe</p>
              <p className="mt-0.5 font-semibold text-foreground">{100 - offer.platformFeeBps / 100}%</p>
            </div>
            <div className="rounded-2xl bg-cream/40 p-3 dark:bg-zinc-800/40">
              <p className="text-xs uppercase tracking-wide text-muted">Estado</p>
              <p className={`mt-0.5 font-semibold ${isBought ? "text-green-600 dark:text-green-400" : "text-foreground"}`}>
                {isBought ? "Comprado" : "Disponible"}
              </p>
            </div>
          </div>

          {/* PDA */}
          <div className="mt-4 rounded-xl bg-cream/20 px-3 py-2.5 dark:bg-zinc-800/20">
            <p className="text-xs uppercase tracking-wide text-muted">PDA on-chain</p>
            <p className="mt-0.5 truncate font-mono text-xs text-foreground">{pda}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="rounded-3xl border border-border-low bg-card p-6 shadow-sm">
          {status !== "connected" && (
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-2xl border border-primary py-4 text-sm font-bold text-primary transition active:scale-95"
            >
              🔐 Conectá Wallet para Comprar
            </button>
          )}

          {status === "connected" && isMerchant && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-400">
              📌 Sos el mencionante de esta oferta
            </div>
          )}

          {status === "connected" && !isMerchant && !isExpired && (
            <div className="space-y-3">
              <button
                onClick={handleBuy}
                disabled={isSending}
                className="w-full rounded-2xl bg-foreground py-4 text-sm font-bold text-background transition active:scale-95 disabled:opacity-40"
              >
                {isSending ? "Procesando compra..." : `💳 Comprar por ${offer.amountSol} SOL`}
              </button>
              {isBought && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-center text-xs font-medium text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400">
                  ✓ Ya compraste este cupón
                </div>
              )}
            </div>
          )}

          {status === "connected" && !isMerchant && isExpired && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                ❌ Esta oferta expiró el {expiryDate}
              </div>
            </div>
          )}

          {status === "connected" && isMerchant && isBought && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Canjear cupón</p>
              <p className="text-xs text-muted">Ingresá la dirección del comprador (escaneá el QR del cliente).</p>
              <input
                className="w-full rounded-2xl border border-border-low bg-input px-4 py-3 text-sm outline-none focus:border-foreground/30"
                placeholder="Wallet del comprador"
                value={buyerForRedeem}
                onChange={(e) => setBuyerForRedeem(e.target.value)}
              />
              <button
                onClick={handleRedeem}
                disabled={isSending || !buyerForRedeem}
                className="w-full rounded-2xl bg-green-600 py-4 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
              >
                {isSending ? "Canjeando..." : "✓ Canjear y recibir pago"}
              </button>
            </div>
          )}

          {txStatus && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              txStatus.startsWith("Error")
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
                : "border-green-200 bg-green-50 text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400"
            }`}>
              {txStatus}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
