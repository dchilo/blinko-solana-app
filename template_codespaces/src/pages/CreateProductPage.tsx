import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { getInitializeProductInstruction } from "../generated/vault/instructions/initializeProduct";
import { getProductAccountPda } from "../lib/pdas";

export function CreateProductPage() {
  const { wallet } = useWalletConnection();
  const navigate = useNavigate();
  const { send } = useSendTransaction();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    name: "",
    description: "",
    metadataUri: "",
    price: "",
    stock: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet) return;

    setLoading(true);
    try {
      const productAccountPda = getProductAccountPda({
        authority: wallet.address,
        productId: form.productId,
      });

      const instruction = getInitializeProductInstruction({
        authority: wallet,
        productAccount: productAccountPda,
        params: {
          productId: form.productId,
          name: form.name,
          description: form.description,
          metadataUri: form.metadataUri,
          price: BigInt(Math.floor(parseFloat(form.price) * 1e9)),
          paymentMint: null,
          stock: parseInt(form.stock),
        },
      });

      const signature = await send({ instructions: [instruction] });
      console.log("Product created:", signature);
      navigate("/");
    } catch (error) {
      console.error("Error creating product:", error);
      alert("Error al crear el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-black leading-tight text-foreground">
          Crear Producto NFT
        </h1>
        <p className="mt-1 text-sm text-muted">
          Publicá un producto con tickets NFT.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">ID del Producto</label>
          <input
            type="text"
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            className="mt-1 block w-full rounded-2xl border border-border-low bg-card px-3 py-2 text-sm"
            placeholder="ej: ticket-cine-3d"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Nombre</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="mt-1 block w-full rounded-2xl border border-border-low bg-card px-3 py-2 text-sm"
            placeholder="Ticket Cine 3D"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 block w-full rounded-2xl border border-border-low bg-card px-3 py-2 text-sm"
            rows={3}
            placeholder="Descripción del producto"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Metadata URI</label>
          <input
            type="url"
            value={form.metadataUri}
            onChange={(e) => setForm({ ...form, metadataUri: e.target.value })}
            className="mt-1 block w-full rounded-2xl border border-border-low bg-card px-3 py-2 text-sm"
            placeholder="https://example.com/metadata.json"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Precio (SOL)</label>
          <input
            type="number"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="mt-1 block w-full rounded-2xl border border-border-low bg-card px-3 py-2 text-sm"
            placeholder="1.0"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Stock</label>
          <input
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="mt-1 block w-full rounded-2xl border border-border-low bg-card px-3 py-2 text-sm"
            placeholder="100"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-fg transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear Producto"}
        </button>
      </form>
    </div>
  );
}