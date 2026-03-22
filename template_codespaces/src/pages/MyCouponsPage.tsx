import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import QRCode from "react-qr-code";
import { getStoredCoupons, type StoredCoupon } from "../lib/coupons";
import { CATEGORY_EMOJI } from "../lib/backend";

function QRModal({ coupon, walletAddress, onClose }: { coupon: StoredCoupon; walletAddress: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const qrValue = `kipo:coupon:redeem:${coupon.pda}:${coupon.offerId}:${walletAddress}`;
  const isExpired = Date.now() / 1000 > coupon.expiryTs;

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-foreground">Mostrar al comercio</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-muted dark:bg-zinc-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Coupon info */}
        <div className="mb-5 rounded-2xl bg-cream/40 px-4 py-3 dark:bg-zinc-800/40">
          <p className="text-xs text-muted">{CATEGORY_EMOJI[coupon.category]} {coupon.title}</p>
          <p className="mt-0.5 text-lg font-bold text-foreground">{coupon.amountSol} SOL</p>
          {isExpired && (
            <p className="mt-1 text-xs font-medium text-red-500">Cupón expirado</p>
          )}
        </div>

        {/* QR */}
        <div className="flex justify-center rounded-2xl border border-border-low bg-white p-5 dark:bg-zinc-100">
          <QRCode value={qrValue} size={200} />
        </div>

        <p className="mt-3 text-center text-xs text-muted">El merchant escanea este código para procesar el canje on-chain</p>

        {/* Wallet address */}
        <div className="mt-4 rounded-2xl border border-border-low bg-cream/30 px-4 py-3 dark:bg-zinc-800/30">
          <p className="text-xs uppercase tracking-wide text-muted">Tu wallet</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="truncate font-mono text-xs text-foreground">{walletAddress}</p>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-lg border border-border-low px-2 py-1 text-xs font-medium text-muted transition active:scale-95"
            >
              {copied ? "✓" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border-low bg-cream/20 px-3 py-2 text-center dark:bg-zinc-800/20">
          <p className="text-xs text-muted">USO ÚNICO · ID {coupon.offerId}</p>
        </div>
      </div>
    </div>
  );
}

function CouponCard({ coupon, walletAddress }: { coupon: StoredCoupon; walletAddress: string }) {
  const navigate = useNavigate();
  const [showQR, setShowQR] = useState(false);
  const isExpired = Date.now() / 1000 > coupon.expiryTs;

  const expiryDate = new Date(coupon.expiryTs * 1000).toLocaleDateString("es", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <>
      {showQR && (
        <QRModal coupon={coupon} walletAddress={walletAddress} onClose={() => setShowQR(false)} />
      )}
      <div className={`rounded-3xl border p-5 transition ${isExpired ? "border-border-low bg-card opacity-60" : "border-border-low bg-card shadow-sm"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{CATEGORY_EMOJI[coupon.category]}</span>
              <p className="font-semibold text-foreground truncate">{coupon.title}</p>
            </div>
            <p className="mt-1 text-sm text-muted line-clamp-2">{coupon.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border-low px-3 py-1 text-xs font-semibold text-foreground">
                {coupon.amountSol} SOL
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${isExpired ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                {isExpired ? "Expirado" : `Vence ${expiryDate}`}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {!isExpired && (
            <button
              onClick={() => setShowQR(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground py-3 text-sm font-semibold text-background transition active:scale-95"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Mostrar QR
            </button>
          )}
          <button
            onClick={() => navigate(`/offer/${coupon.pda}`)}
            className="rounded-2xl border border-border-low px-4 py-3 text-sm font-medium text-muted transition active:scale-95"
          >
            Ver oferta
          </button>
        </div>
      </div>
    </>
  );
}

export function MyCouponsPage() {
  const { wallet, status } = useWalletConnection();
  const navigate = useNavigate();

  const walletAddress = wallet?.account.address.toString() ?? "";
  const coupons = getStoredCoupons();
  const active = coupons.filter((c) => Date.now() / 1000 <= c.expiryTs);
  const expired = coupons.filter((c) => Date.now() / 1000 > c.expiryTs);

  if (status !== "connected") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream text-3xl dark:bg-zinc-800">
          🎫
        </div>
        <div>
          <p className="font-semibold text-foreground">Conectá tu wallet</p>
          <p className="mt-1 text-sm text-muted">Aquí verás todos los cupones que compraste.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Mis Cupones</h1>
        <p className="mt-1 text-sm text-muted">Mostrá el QR al comercio para canjear.</p>
      </div>

      {/* ¿Cómo funciona? */}
      {coupons.length === 0 && (
        <div className="rounded-3xl border border-border-low bg-card p-6">
          <h2 className="mb-4 font-semibold text-foreground">¿Cómo funciona?</h2>
          <ol className="space-y-4 text-sm">
            {[
              { step: "1", title: "Comprás el cupón", desc: "Tu pago queda bloqueado en escrow on-chain." },
              { step: "2", title: "Vas al local", desc: "Abrís esta sección y mostrás el QR al comercio." },
              { step: "3", title: "El merchant escanea", desc: "Ejecuta el canje on-chain. Recibe el 95%, la plataforma el 5%." },
              { step: "4", title: "Si no canjean", desc: "Al expirar podés reclamar reembolso on-chain." },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  {step}
                </span>
                <div>
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="text-muted">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Cupones activos */}
      {active.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Activos · {active.length}
          </p>
          {active.map((c) => (
            <CouponCard key={c.pda} coupon={c} walletAddress={walletAddress} />
          ))}
        </section>
      )}

      {/* Cupones expirados */}
      {expired.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Expirados · {expired.length}
          </p>
          {expired.map((c) => (
            <CouponCard key={c.pda} coupon={c} walletAddress={walletAddress} />
          ))}
        </section>
      )}

      {/* Empty state */}
      {coupons.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border-low bg-card/50 py-12 text-center">
          <p className="text-3xl">🏪</p>
          <p className="mt-3 font-semibold text-foreground">Todavía no tenés cupones</p>
          <p className="mt-1 text-sm text-muted">Explorá el marketplace y comprá tu primer cupón.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-5 rounded-2xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition active:scale-95"
          >
            Explorar ofertas
          </button>
        </div>
      )}
    </div>
  );
}
