import { useState } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { getPurchaseAndMintInstruction } from "../generated/vault/instructions/purchaseAndMint";
import { getProductAccountPda, getPurchaseRecordPda, getNftMintPda, getNftCustodyAccountPda } from "../lib/pdas";

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

type Props = { product: Product; onPurchase: () => void };

export function ProductCard({ product, onPurchase }: Props) {
  const { wallet } = useWalletConnection();
  const { send } = useSendTransaction();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (!wallet) return;

    setLoading(true);
    try {
      const productAccountPda = getProductAccountPda({
        authority: product.authority as any,
        productId: product.productId,
      });
      const purchaseRecordPda = getPurchaseRecordPda({
        productAccount: productAccountPda,
        buyer: wallet.address,
      });
      const nftMintPda = getNftMintPda({
        productAccount: productAccountPda,
        buyer: wallet.address,
      });
      const nftCustodyAccountPda = getNftCustodyAccountPda({
        companyWallet: product.authority as any,
        nftMint: nftMintPda,
      });

      const instruction = getPurchaseAndMintInstruction({
        buyer: wallet,
        companyWallet: product.authority as any,
        productAccount: productAccountPda,
        nftMint: nftMintPda,
        nftCustodyAccount: nftCustodyAccountPda,
        purchaseRecord: purchaseRecordPda,
        placeholder: 0,
      });

      const signature = await send({ instructions: [instruction] });
      console.log("Purchase successful:", signature);
      onPurchase();
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Error al comprar el producto");
    } finally {
      setLoading(false);
    }
  };

  const available = product.stock - product.sold;
  const priceSol = product.price / 1e9;

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-border-low bg-card px-5 py-4 shadow-lg transition">
      {/* Emoji */}
      <div className="shrink-0 text-4xl">🎟️</div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-foreground truncate">{product.name}</h3>
            <p className="text-sm text-muted line-clamp-1 mt-0.5">{product.description}</p>
          </div>
          {available === 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 dark:bg-red-900/20 dark:text-red-400">
              Agotado
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-lg font-bold text-foreground">
            {priceSol} <span className="text-sm font-semibold text-muted">SOL</span>
          </p>
          <p className="text-xs text-muted">{available} disponibles</p>
        </div>
      </div>

      {/* Action Button */}
      {available > 0 && (
        <button
          onClick={handlePurchase}
          disabled={loading}
          className="shrink-0 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-primary-fg transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "..." : "Comprar"}
        </button>
      )}
    </div>
  );
}