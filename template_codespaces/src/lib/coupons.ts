import type { OfferCategory } from "./backend";

const STORAGE_KEY = "blinko_coupons";

export type StoredCoupon = {
  pda: string;
  offerId: number;
  title: string;
  description: string;
  merchantWallet: string;
  amountSol: number;
  expiryTs: number;
  category: OfferCategory;
  boughtAt: number;
};

export function getStoredCoupons(): StoredCoupon[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCoupon(coupon: StoredCoupon): void {
  const existing = getStoredCoupons();
  const updated = existing.filter((c) => c.pda !== coupon.pda);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([coupon, ...updated]));
}
