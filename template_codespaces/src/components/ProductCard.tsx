import { useState } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { getPurchaseAndMintInstruction } from "../generated/vault/instructions/purchaseAndMint";
import { getProductAccountPda, getPurchaseRecordPda, getNftMintPda, getNftCustodyAccountPda } from "../lib/pdas";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault/programs";

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
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border-low bg-card shadow-sm">
      {/* Header */}
      <div className="flex h-28 items-center justify-center bg-green-100">
        <span className="text-5xl">🎟️</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Title */}
        <h3 className="font-bold leading-snug text-foreground">{product.name}</h3>
        <p className="line-clamp-2 text-xs text-muted">{product.description}</p>

        {/* Price and Stock */}
        <p className="mt-1 text-2xl font-black text-foreground">
          {priceSol}
          <span className="ml-1 text-sm font-semibold text-muted">SOL</span>
        </p>
        <p className="text-xs text-muted">
          Disponible: {available} / {product.stock}
        </p>

        {/* Authority */}
        <p className="truncate font-mono text-xs text-muted">
          Empresa: {product.authority.slice(0, 6)}...{product.authority.slice(-4)}
        </p>

        {/* Action */}
        {available > 0 && (
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="mt-auto w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-fg transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "Comprando..." : "Comprar NFT Ticket"}
          </button>
        )}
        {available === 0 && (
          <p className="mt-auto text-center text-sm text-muted">Agotado</p>
        )}
      </div>
    </div>
  );
}