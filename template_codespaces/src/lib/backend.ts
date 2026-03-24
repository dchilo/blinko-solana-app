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

export type TransactionRecord = {
  id: string;
  merchantWallet: string;
  customerWallet: string;
  offerId: number;
  offerTitle: string;
  amountSol: number;
  merchantEarningSol: number;
  platformFeeSol: number;
  timestamp: number;
  status: "completed" | "pending" | "failed";
};

export type MerchantStats = {
  totalIncomeSol: number;
  totalCouponsRedeemed: number;
  couponsRedeemedToday: number;
  totalPlatformFee: number;
  weeklyEarnings: Array<{ day: string; earnings: number }>;
};

function resolveBackendUrl(): string {
  return "/api";
}

export const BACKEND_URL = resolveBackendUrl();

// ── GET Offers ──
export async function fetchOffers(): Promise<OfferRecord[]> {
  const res = await fetch(`${BACKEND_URL}/offers`);
  if (!res.ok) throw new Error("Error al obtener las ofertas");
  return res.json();
}

export async function fetchOffer(pda: string): Promise<OfferRecord> {
  const res = await fetch(`${BACKEND_URL}/offers/${pda}`);
  if (!res.ok) throw new Error("Oferta no encontrada");
  return res.json();
}

// ── CREATE Offer ──
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
    throw new Error((err as { error?: string }).error ?? "Error al crear la oferta");
  }
  return res.json();
}

// ── DELETE Offer ──
export async function deleteOfferMetadata(token: string, pda: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/offers/${pda}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Error al eliminar la oferta");
}

// ── Dashboard / Stats (SIN MOCKS) ──

export async function fetchMerchantStats(token: string): Promise<MerchantStats> {
  const res = await fetch(`${BACKEND_URL}/merchant/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error al obtener estadísticas");
  }
  
  return res.json();
}

export async function fetchMerchantTransactions(token: string): Promise<TransactionRecord[]> {
  const res = await fetch(`${BACKEND_URL}/merchant/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Error al obtener transacciones");
  }

  return res.json();
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