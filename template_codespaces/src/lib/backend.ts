export type OfferCategory = "food" | "retail" | "services" | "entertainment" | "other";

export type OfferRecord = {
  pda: string;
  merchantWallet: string;
  offerId: number;
  amountSol: number;
  title: string;
  description: string;
  category: OfferCategory;
  expiryTs: number;
  platformFeeBps: number;
  createdAt: number;
};

function resolveBackendUrl(): string {
  const envUrl = import.meta.env.VITE_BACKEND_URL?.toString().trim();
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const { hostname, port, protocol } = window.location;
    if (hostname.endsWith(".app.github.dev")) {
      const currentPort = port || "5173";
      const expectedSuffix = `-${currentPort}.app.github.dev`;
      if (hostname.includes(expectedSuffix)) {
        return `${protocol}//${hostname.replace(expectedSuffix, "-4000.app.github.dev")}`;
      }
    }
  }
  return "http://localhost:4000";
}

export const BACKEND_URL = resolveBackendUrl();

export async function fetchOffers(): Promise<OfferRecord[]> {
  const res = await fetch(`${BACKEND_URL}/offers`);
  if (!res.ok) throw new Error("Failed to fetch offers");
  return res.json();
}

export async function fetchOffer(pda: string): Promise<OfferRecord> {
  const res = await fetch(`${BACKEND_URL}/offers/${pda}`);
  if (!res.ok) throw new Error("Offer not found");
  return res.json();
}

export async function createOfferMetadata(token: string, data: Omit<OfferRecord, "merchantWallet" | "createdAt">): Promise<OfferRecord> {
  const res = await fetch(`${BACKEND_URL}/offers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to create offer");
  }
  return res.json();
}

export async function deleteOfferMetadata(token: string, pda: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/offers/${pda}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete offer");
}

export const CATEGORY_LABELS: Record<OfferCategory, string> = {
  food: "Comida & Bebida",
  retail: "Tienda & Retail",
  services: "Servicios",
  entertainment: "Entretenimiento",
  other: "Otro",
};

export const CATEGORY_EMOJI: Record<OfferCategory, string> = {
  food: "🍽️",
  retail: "🛍️",
  services: "🔧",
  entertainment: "🎭",
  other: "📦",
};
