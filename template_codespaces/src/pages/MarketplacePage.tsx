import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { OfferCard } from "../components/OfferCard";
import { fetchOffers, type OfferRecord, type OfferCategory } from "../lib/backend";

const CATEGORIES: Array<{ value: OfferCategory | "all"; label: string }> = [
  { value: "all",           label: "Todos" },
  { value: "food",          label: "🍽️ Comida" },
  { value: "retail",        label: "🛍️ Retail" },
  { value: "services",      label: "🔧 Servicios" },
  { value: "entertainment", label: "🎭 Entret." },
  { value: "other",         label: "📦 Otro" },
];

export function MarketplacePage() {
  const { status } = useWalletConnection();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<OfferCategory | "all">("all");

  useEffect(() => {
    fetchOffers()
      .then(setOffers)
      .catch(() => setError("No se pudo conectar al backend. ¿Está corriendo en puerto 4000?"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = category === "all" ? offers : offers.filter((o) => o.category === category);
  const active  = filtered.filter((o) => Date.now() / 1000 <= o.expiryTs);
  const expired = filtered.filter((o) => Date.now() / 1000 > o.expiryTs);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">

      {/* Hero */}
      <div>
        <h1 className="text-2xl font-black leading-tight text-foreground">
          Descuentos locales<br />en Solana
        </h1>
        <p className="mt-1 text-sm text-muted">
          Comprá cupones seguros con escrow on-chain.
        </p>
      </div>

      {/* CTA para merchants */}
      {status === "connected" && (
        <div className="flex items-center justify-between rounded-3xl border border-border-low bg-card px-5 py-4 shadow-sm">
          <div>
            <p className="font-bold text-foreground">¿Sos un comercio?</p>
            <p className="text-xs text-muted">Publicá ofertas con escrow.</p>
          </div>
          <button
            onClick={() => navigate("/merchant")}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-fg transition active:scale-95"
          >
            Crear oferta
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
              category === cat.value
                ? "bg-primary text-primary-fg shadow-sm"
                : "border border-border-low bg-card text-muted"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl border border-border-low bg-card" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Ofertas activas */}
      {!loading && !error && active.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border-low bg-card py-16 text-center">
          <p className="text-4xl">🏪</p>
          <p className="mt-3 font-bold text-foreground">No hay ofertas disponibles</p>
          <p className="mt-1 text-sm text-muted">
            {status === "connected"
              ? "Sé el primero en publicar una oferta."
              : "Conectá tu wallet para publicar."}
          </p>
          {status === "connected" && (
            <button
              onClick={() => navigate("/merchant")}
              className="mt-5 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-fg transition active:scale-95"
            >
              Crear primera oferta
            </button>
          )}
        </div>
      )}

      {!loading && !error && active.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {active.length} oferta{active.length !== 1 ? "s" : ""} disponible{active.length !== 1 ? "s" : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((offer) => (
              <OfferCard key={offer.pda} offer={offer} />
            ))}
          </div>
        </section>
      )}

      {!loading && expired.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Expiradas</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {expired.map((offer) => (
              <OfferCard key={offer.pda} offer={offer} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
