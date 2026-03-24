import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { OfferCard } from "../components/OfferCard";
import { ProductCard } from "../components/ProductCard";
import { fetchOffers, type OfferRecord, type OfferCategory } from "../lib/backend";

const CATEGORIES: Array<{ value: OfferCategory | "all"; label: string }> = [
  { value: "all",           label: "Todos" },
  { value: "food",          label: "🍽️ Comida" },
  { value: "retail",        label: "🛍️ Retail" },
  { value: "services",      label: "🔧 Servicios" },
  { value: "entertainment", label: "🎭 Entret." },
  { value: "other",         label: "📦 Otro" },
];

type Product = {
  pda: string;
  productId: string;
  name: string;
  description: string;
  price: number; // in lamports
  stock: number;
  sold: number;
  authority: string;
};

export function MarketplacePage() {
  const { status } = useWalletConnection();
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<OfferCategory | "all">("all");
  const [tab, setTab] = useState<"offers" | "products">("offers");

  useEffect(() => {
    fetchOffers()
      .then((data) => {
        setOffers(data);
        setError(null); // Limpiamos cualquier error previo si hubo éxito
      })
      .catch((err) => {
        console.error("Error al buscar ofertas:", err);
        // CAMBIAMOS EL MENSAJE AQUÍ:
        setError("No se pudieron cargar las ofertas. Verifica la conexión con la API.");
      })
      .finally(() => setLoading(false));

    // TODO: Fetch products from backend or on-chain
    setProducts([
      {
        pda: "example",
        productId: "prod1",
        name: "Ticket Cine",
        description: "Entrada para película en 3D",
        price: 1000000000, // 1 SOL
        stock: 100,
        sold: 10,
        authority: "11111111111111111111111111111112",
      },
    ]);
  }, []);

  const filteredOffers = category === "all" ? offers : offers.filter((o) => o.category === category);
  const activeOffers = filteredOffers.filter((o) => Date.now() / 1000 <= o.expiryTs);
  const expiredOffers = filteredOffers.filter((o) => Date.now() / 1000 > o.expiryTs);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">

      {/* Hero */}
      <div>
        <h1 className="text-3xl font-black leading-tight text-foreground">
          Marketplace en Solana<br />Cupones y NFTs
        </h1>
        <p className="mt-2 text-sm text-muted">
          Comprá cupones seguros o tickets NFT con escrow on-chain.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("offers")}
          className={`rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-95 ${
            tab === "offers"
              ? "bg-primary text-primary-fg shadow-sm"
              : "border border-border-low bg-card text-muted"
          }`}
        >
          Cupones
        </button>
        <button
          onClick={() => setTab("products")}
          className={`rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-95 ${
            tab === "products"
              ? "bg-primary text-primary-fg shadow-sm"
              : "border border-border-low bg-card text-muted"
          }`}
        >
          Productos NFT
        </button>
      </div>

      {/* CTA para merchants */}
      {status === "connected" && tab === "offers" && (
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

      {/* CTA para crear productos */}
      {status === "connected" && tab === "products" && (
        <div className="flex items-center justify-between rounded-3xl border border-border-low bg-card px-5 py-4 shadow-sm">
          <div>
            <p className="font-bold text-foreground">¿Sos una empresa?</p>
            <p className="text-xs text-muted">Publicá productos con tickets NFT.</p>
          </div>
          <button
            onClick={() => navigate("/create-product")}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-fg transition active:scale-95"
          >
            Crear producto
          </button>
        </div>
      )}

      {/* Filtros para offers */}
      {tab === "offers" && (
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
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border-low bg-card" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Offers */}
      {tab === "offers" && !loading && !error && (
        <>
          {activeOffers.length > 0 && (
            <section className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                {activeOffers.length} oferta{activeOffers.length !== 1 ? "s" : ""} disponible{activeOffers.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-4">
                {activeOffers.map((offer) => (
                  <OfferCard key={offer.pda} offer={offer} />
                ))}
              </div>
            </section>
          )}
          {expiredOffers.length > 0 && (
            <section className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Expiradas</p>
              <div className="space-y-4">
                {expiredOffers.map((offer) => (
                  <OfferCard key={offer.pda} offer={offer} />
                ))}
              </div>
            </section>
          )}
          {activeOffers.length === 0 && expiredOffers.length === 0 && (
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
        </>
      )}

      {/* Products */}
      {tab === "products" && !loading && !error && (
        <>
          {products.length > 0 && (
            <section className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">
                {products.length} producto{products.length !== 1 ? "s" : ""} disponible{products.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-4">
                {products.map((product) => (
                  <ProductCard key={product.pda} product={product} onPurchase={() => {
                    // Refresh products
                    setProducts(prev => prev.map(p => p.pda === product.pda ? { ...p, sold: p.sold + 1 } : p));
                  }} />
                ))}
              </div>
            </section>
          )}
          {products.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border-low bg-card py-16 text-center">
              <p className="text-4xl">🎟️</p>
              <p className="mt-3 font-bold text-foreground">No hay productos disponibles</p>
              <p className="mt-1 text-sm text-muted">
                {status === "connected"
                  ? "Sé el primero en publicar un producto NFT."
                  : "Conectá tu wallet para publicar."}
              </p>
              {status === "connected" && (
                <button
                  onClick={() => navigate("/create-product")}
                  className="mt-5 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-fg transition active:scale-95"
                >
                  Crear primer producto
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}