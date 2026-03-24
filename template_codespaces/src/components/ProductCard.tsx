import { useState } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { Address } from "@solana/kit";
import { getPurchaseAndMintInstruction } from "../generated/vault/instructions/purchaseAndMint";
import { 
  getProductAccountPda, 
  getPurchaseRecordPda, 
  getNftMintPda, 
  getNftCustodyAccountPda 
} from "../lib/pdas";

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
    if (!wallet || !wallet.account) {
      alert("Por favor, conecta tu wallet");
      return;
    }

    setLoading(true);
    try {
      const buyerAddress = wallet.account.address;
      const merchantAddress = product.authority as Address;

      // 1. Obtener PDAs con await
      const productAccountPda = await getProductAccountPda(
        merchantAddress,
        product.productId
      );

      const purchaseRecordPda = await getPurchaseRecordPda(
        productAccountPda,
        buyerAddress
      );

      const nftMintPda = await getNftMintPda(
        productAccountPda,
        buyerAddress
      );

      const nftCustodyAccountPda = await getNftCustodyAccountPda(
        merchantAddress,
        nftMintPda
      );

      // 2. Construcción de la instrucción corregida
      const instruction = getPurchaseAndMintInstruction({
        buyer: wallet as any, 
        companyWallet: merchantAddress,
        productAccount: productAccountPda,
        nftMint: nftMintPda,
        nftCustodyAccount: nftCustodyAccountPda,
        purchaseRecord: purchaseRecordPda,
        // ✅ AQUÍ ESTÁ EL CAMBIO: Agregamos el campo obligatorio
        placeholder: 0, 
      });

      // 3. Envío de transacción
      const signature = await send({ instructions: [instruction] });
      console.log("Purchase successful:", signature);
      onPurchase();
      alert("¡Compra exitosa! NFT emitido.");
    } catch (error) {
      console.error("Purchase failed:", error);
      alert("Error al comprar el producto. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  const available = product.stock - product.sold;
  const priceSol = product.price / 10 ** 9;

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-border-low bg-card px-5 py-4 shadow-lg transition">
      <div className="shrink-0 text-4xl">🎟️</div>

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