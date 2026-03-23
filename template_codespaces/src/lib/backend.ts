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
  merchantEarningSol: number; // Après déduction de la commission
  platformFeeSol: number; // Commission de la plateforme
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
  // Use Vite proxy in development
  return "/api";
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

// ── Dashboard / Stats ──

export async function fetchMerchantStats(token: string): Promise<MerchantStats> {
  try {
    const res = await fetch(`${BACKEND_URL}/merchant/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  } catch {
    // Si el endpoint no existe en el backend, devolver datos simulados
    return {
      totalIncomeSol: 152.5,
      totalCouponsRedeemed: 45,
      couponsRedeemedToday: 12,
      totalPlatformFee: 7.6,
      weeklyEarnings: [
        { day: "Lun", earnings: 15.2 },
        { day: "Mar", earnings: 22.5 },
        { day: "Mié", earnings: 18.8 },
        { day: "Jue", earnings: 25.3 },
        { day: "Vie", earnings: 31.2 },
        { day: "Sáb", earnings: 28.5 },
        { day: "Hoy", earnings: 21.0 },
      ],
    };
  }
}

export async function fetchMerchantTransactions(token: string): Promise<TransactionRecord[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/merchant/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  } catch {
    // Si el endpoint no existe, devolver datos simulados
    return [
      {
        id: "tx_1",
        merchantWallet: "",
        customerWallet: "CqKRP8jMd8FURtaGC65zzapurQ2dxgBskCZYN5fvWe1w",
        offerId: 1001,
        offerTitle: "30% en café",
        amountSol: 2.5,
        merchantEarningSol: 2.375,
        platformFeeSol: 0.125,
        timestamp: Date.now() - 2 * 3600000,
        status: "completed",
      },
      {
        id: "tx_2",
        merchantWallet: "",
        customerWallet: "DqKRP8jMd8FURtaGC65zzapurQ2dxgBskCZYN5fvWe1w",
        offerId: 1002,
        offerTitle: "Media docena medialunas",
        amountSol: 3.0,
        merchantEarningSol: 2.85,
        platformFeeSol: 0.15,
        timestamp: Date.now() - 1.5 * 3600000,
        status: "completed",
      },
      {
        id: "tx_3",
        merchantWallet: "",
        customerWallet: "EqKRP8jMd8FURtaGC65zzapurQ2dxgBskCZYN5fvWe1w",
        offerId: 1001,
        offerTitle: "30% en café",
        amountSol: 5.2,
        merchantEarningSol: 4.94,
        platformFeeSol: 0.26,
        timestamp: Date.now() - 24 * 3600000,
        status: "completed",
      },
      {
        id: "tx_4",
        merchantWallet: "",
        customerWallet: "FqKRP8jMd8FURtaGC65zzapurQ2dxgBskCZYN5fvWe1w",
        offerId: 1003,
        offerTitle: "2x1 en bebida",
        amountSol: 2.8,
        merchantEarningSol: 2.66,
        platformFeeSol: 0.14,
        timestamp: Date.now() - 24.5 * 3600000,
        status: "completed",
      },
    ];
  }
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
