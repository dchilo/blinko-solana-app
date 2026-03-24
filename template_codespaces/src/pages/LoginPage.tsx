import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { loginAsClient, loginAsMerchant } = useAuth();
  const [showMerchantForm, setShowMerchantForm] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleClientLogin = () => {
    loginAsClient();
    navigate("/");
  };

  const handleMerchantLogin = () => {
    if (!password.trim()) {
      setError("Ingresá la clave");
      return;
    }
    if (loginAsMerchant(password)) {
      navigate("/merchant");
    } else {
      setError("Clave incorrecta");
      setPassword("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-blue-950/10 px-4">
      <div className="w-full max-w-sm space-y-8 py-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <h1 className="text-4xl font-black text-foreground">KiPO</h1>
          <p className="text-sm text-muted">Cupones y NFTs en Solana</p>
        </div>

        {!showMerchantForm ? (
          // Cliente Login
          <div className="space-y-5">
            <div className="rounded-3xl border border-border-low bg-card p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-bold text-foreground">Sos Cliente?</h2>
              <p className="mb-6 text-sm text-muted">
                Comprá cupones y tickets NFT en el marketplace.
              </p>
              <button
                onClick={handleClientLogin}
                className="w-full rounded-2xl bg-primary px-4 py-3 font-bold text-primary-fg shadow-lg transition active:scale-95"
              >
                Entrar como Cliente
              </button>
            </div>

            {/* Merchant Hint */}
            <div className="rounded-3xl border border-border-low/50 bg-card/50 p-6 text-center">
              <p className="text-xs text-muted mb-3">¿Tenes un comercio?</p>
              <button
                onClick={() => {
                  setShowMerchantForm(true);
                  setError("");
                }}
                className="text-sm font-bold text-primary transition hover:underline"
              >
                Acceso de Comercio
              </button>
            </div>
          </div>
        ) : (
          // Merchant Login
          <div className="space-y-5">
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6 shadow-lg">
              <button
                onClick={() => {
                  setShowMerchantForm(false);
                  setPassword("");
                  setError("");
                }}
                className="mb-4 text-xs font-bold text-muted hover:text-foreground transition"
              >
                ← Volver
              </button>

              <h2 className="mb-4 text-lg font-bold text-foreground">Acceso Comercio</h2>
              <p className="mb-6 text-sm text-muted">
                Ingresá la clave de comercio para gestionar ofertas.
              </p>

              <input
                type="password"
                placeholder="Clave especial"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleMerchantLogin()}
                className="w-full rounded-2xl border border-border-low bg-background px-4 py-3 text-sm text-foreground placeholder-muted placeholder-opacity-60 transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                autoFocus
              />

              {error && (
                <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>
              )}

              <button
                onClick={handleMerchantLogin}
                disabled={!password.trim()}
                className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 font-bold text-primary-fg shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                Entrar
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted">
          Conectate con tu billetera Solana para transacciones seguras
        </p>
      </div>
    </div>
  );
}
