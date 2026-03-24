import { useNavigate } from "react-router-dom";
import { CATEGORY_EMOJI, type OfferRecord } from "../lib/backend";

type Props = { offer: OfferRecord };

export function OfferCard({ offer }: Props) {
  const navigate = useNavigate();
  const isExpired = Date.now() / 1000 > offer.expiryTs;
  const expiryDate = new Date(offer.expiryTs * 1000).toLocaleDateString("es", {
    day: "2-digit", month: "short",
  });

  return (
    <div
      className={`flex items-center gap-4 rounded-3xl border px-5 py-4 transition ${
        isExpired ? "border-border-low bg-card opacity-60" : "border-border-low bg-card shadow-lg"
      }`}
      onClick={() => navigate(`/offer/${offer.pda}`)}
      role="button"
      tabIndex={0}
    >
      {/* Emoji */}
      <div className="shrink-0 text-4xl">{CATEGORY_EMOJI[offer.category]}</div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-foreground truncate">{offer.title}</h3>
            <p className="text-sm text-muted line-clamp-1 mt-0.5">{offer.description}</p>
          </div>
          {isExpired && (
            <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
              Vencido
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-lg font-bold text-foreground">
            {offer.amountSol} <span className="text-sm font-semibold text-muted">SOL</span>
          </p>
          <p className="text-xs text-muted">{isExpired ? "" : `Vence ${expiryDate}`}</p>
        </div>
      </div>
    </div>
  );
}
