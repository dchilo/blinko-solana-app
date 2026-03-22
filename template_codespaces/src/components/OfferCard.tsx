import { useNavigate } from "react-router-dom";
import { CATEGORY_LABELS, CATEGORY_EMOJI, type OfferRecord } from "../lib/backend";

type Props = { offer: OfferRecord };

export function OfferCard({ offer }: Props) {
  const navigate = useNavigate();
  const isExpired = Date.now() / 1000 > offer.expiryTs;
  const expiryDate = new Date(offer.expiryTs * 1000).toLocaleDateString("es", {
    day: "2-digit", month: "short",
  });

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition ${
        isExpired ? "border-border-low opacity-60" : "border-border-low"
      }`}
    >
      {/* Color header strip */}
      <div className="flex h-28 items-center justify-center bg-primary-soft">
        <span className="text-5xl">{CATEGORY_EMOJI[offer.category]}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Category + expired badge */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            {CATEGORY_LABELS[offer.category]}
          </span>
          {isExpired && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              Expirado
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold leading-snug text-foreground">{offer.title}</h3>
        <p className="line-clamp-2 text-xs text-muted">{offer.description}</p>

        {/* Price */}
        <p className="mt-1 text-2xl font-black text-foreground">
          {offer.amountSol}
          <span className="ml-1 text-sm font-semibold text-muted">SOL</span>
        </p>
        <p className="text-xs text-muted">
          Comisión {offer.platformFeeBps / 100}% · Vence {expiryDate}
        </p>

        {/* Merchant */}
        <p className="truncate font-mono text-xs text-muted">
          {offer.merchantWallet.slice(0, 6)}...{offer.merchantWallet.slice(-4)}
        </p>

        {/* Action */}
        {!isExpired && (
          <button
            onClick={() => navigate(`/offer/${offer.pda}`)}
            className="mt-auto w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-fg transition active:scale-95"
          >
            Reclamar cupón
          </button>
        )}
      </div>
    </div>
  );
}
