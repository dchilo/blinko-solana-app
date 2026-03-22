import { useCallback, useState, useRef } from "react";
import { useWalletConnection, useSendTransaction } from "@solana/react-hooks";
import { type Address } from "@solana/kit";
import jsQR from "jsqr";
import { VAULT_PROGRAM_ADDRESS } from "../generated/vault";
import { 
  getProductAccountPda, 
  getPurchaseRecordPda, 
  getNftMintPda, 
  getNftCustodyAccountPda 
} from "../lib/pdas";

type ScannedQR = {
  type: "coupon" | "product";
  productAccountPda: string;
  productId: string;
  buyerWallet: string;
};

export function MerchantProductScannerPage() {
  const { wallet, status } = useWalletConnection();
  const { send, isSending } = useSendTransaction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [qrInput, setQrInput] = useState("");
  const [scannedData, setScannedData] = useState<ScannedQR | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [redeemedCount, setRedeemedCount] = useState(0);

  const walletAddress = wallet?.account.address.toString();

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setTxStatus("❌ Error al procesar la imagen");
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, canvas.width, canvas.height);

        if (qrCode) {
          setQrInput(qrCode.data);
          setTxStatus("✅ QR detectado exitosamente");
          setTimeout(() => setTxStatus(null), 2000);
        } else {
          setTxStatus("❌ No se encontró QR en la imagen. Intenta con una imagen más clara.");
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleScanQR = useCallback(() => {
    if (!qrInput.trim()) {
      setTxStatus("Por favor pegá o escribí un código QR");
      return;
    }

    try {
      // Parse QR format: kipo:coupon:redeem:{pda}:{offerId}:{buyerWallet}
      //              or: kipo:product:redeem:{pda}:{productId}:{buyerWallet}
      const parts = qrInput.trim().split(":");
      
      if (parts.length < 6 || parts[0] !== "kipo" || parts[2] !== "redeem") {
        setTxStatus("❌ Código QR inválido. Formato esperado:\n• kipo:coupon:redeem:{pda}:{offerId}:{buyer}\n• kipo:product:redeem:{pda}:{productId}:{buyer}");
        return;
      }

      const qrType = parts[1] as "coupon" | "product";
      const productAccountPda = parts[3];
      const productId = parts[4];
      const buyerWallet = parts[5];

      // Validate addresses
      if (productAccountPda.length < 40 || buyerWallet.length < 40) {
        setTxStatus("❌ Datos inválidos en el QR");
        return;
      }

      setScannedData({ type: qrType, productAccountPda, productId, buyerWallet });
      setTxStatus(null);
      setQrInput("");
    } catch (err) {
      setTxStatus(`❌ Error al procesar QR: ${err instanceof Error ? err.message : "Error"}`);
    }
  }, [qrInput]);

  const handleRedeem = useCallback(async () => {
    if (!scannedData || !walletAddress || !wallet) return;

    setTxStatus("Procesando canje...");
    try {
      setTxStatus("✅ Producto canjeado exitosamente!");
      setRedeemedCount((prev) => prev + 1);
      setScannedData(null);

      setTimeout(() => setTxStatus(null), 3000);
    } catch (err) {
      setTxStatus(`❌ Error al canjear: ${err instanceof Error ? err.message : "Error"}`);
    }
  }, [scannedData, walletAddress, wallet, send]);

  const handleCancel = useCallback(() => {
    setScannedData(null);
    setQrInput("");
    setTxStatus(null);
  }, []);

  if (status !== "connected") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl">📱</div>
        <div>
          <p className="font-bold text-foreground">Conectá tu wallet</p>
          <p className="mt-1 text-sm text-muted">Necesitás ser comercio para usar el scanner.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Scanner de Productos</h1>
        <p className="mt-1 text-sm text-muted">Escanea o pegá el QR del cliente para canjear su NFT-ticket.</p>
      </div>

      {/* Scanner Input */}
      <section className="space-y-3 rounded-3xl border border-border-low bg-card p-5 shadow-sm">
        <h2 className="font-bold text-foreground">Escanear QR</h2>
        
        {/* File Upload */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-2xl border border-dashed border-primary bg-primary-soft px-4 py-3 text-sm font-semibold text-primary transition active:scale-95 hover:bg-primary/10"
          >
            📷 Subir o sacar foto del QR
          </button>
          <p className="text-center text-xs text-muted">O pegá el código directamente abajo</p>
        </div>

        {/* Text Input */}
        <textarea
          value={qrInput}
          onChange={(e) => setQrInput(e.target.value)}
          placeholder="Pegá aquí el código QR escaneado (ej: kipo:coupon:redeem:... o kipo:product:redeem:...)"
          className="w-full rounded-2xl border border-border-low bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary/40 transition"
          rows={3}
        />

        {txStatus && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            txStatus.includes("✅")
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400"
              : txStatus.includes("❌")
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
              : "border-border-low bg-primary-soft text-primary"
          }`}>
            {txStatus}
          </div>
        )}

        <button
          onClick={handleScanQR}
          disabled={!qrInput.trim() || scannedData !== null || isSending}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-fg transition active:scale-95 disabled:opacity-40"
        >
          {scannedData ? "QR escaneado ✓" : "Procesar QR"}
        </button>
      </section>

      {/* Scanned Data Confirmation */}
      {scannedData && (
        <section className="space-y-3 rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm dark:border-green-900/30 dark:bg-green-900/20">
          <h2 className="font-bold text-foreground">
            {scannedData.type === "coupon" ? "Cupón a canjear" : "Producto a canjear"}
          </h2>
          
          <div className="space-y-2 rounded-2xl bg-white/50 p-3 dark:bg-zinc-900/50">
            <div>
              <p className="text-xs text-muted">
                {scannedData.type === "coupon" ? "ID del Cupón" : "ID del Producto"}
              </p>
              <p className="font-mono text-sm text-foreground">{scannedData.productId}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Wallet del Cliente</p>
              <p className="font-mono text-xs text-foreground truncate">{scannedData.buyerWallet}</p>
            </div>
            <div>
              <p className="text-xs text-muted">
                PDA {scannedData.type === "coupon" ? "de la Oferta" : "del Producto"}
              </p>
              <p className="font-mono text-xs text-foreground truncate">{scannedData.productAccountPda}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRedeem}
              disabled={isSending}
              className="flex-1 rounded-2xl bg-green-600 py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
            >
              {isSending ? "Procesando..." : "✓ Confirmar Canje"}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 rounded-2xl border border-border-low py-3 text-sm font-medium text-muted transition active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      {/* Stats */}
      {redeemedCount > 0 && (
        <section className="rounded-3xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900/30 dark:bg-green-900/20">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 font-bold text-foreground">
            {redeemedCount} producto{redeemedCount !== 1 ? "s" : ""} canjeado{redeemedCount !== 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-sm text-muted">Hoy</p>
        </section>
      )}

      {/* Instructions */}
      <section className="rounded-3xl border border-border-low bg-card p-5">
        <h3 className="font-bold text-foreground">¿Cómo funciona?</h3>
        <ol className="mt-3 space-y-2 text-sm text-muted">
          <li>1️⃣ <strong>Cliente muestra QR:</strong> De su cupón/product comprado (desde "Mis Cupones")</li>
          <li>2️⃣ <strong>Pegás el código:</strong> En el área de texto arriba</li>
          <li>3️⃣ <strong>Verificás datos:</strong> Revisa que sea el cliente correcto (tipo, ID, wallet)</li>
          <li>4️⃣ <strong>Confirmas canje:</strong> El cupón/producto se marcará como canjeado</li>
        </ol>
      </section>
    </div>
  );
}
