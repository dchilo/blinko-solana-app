import { useWalletConnection } from "@solana/react-hooks";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";

export function ProfilePage() {
  const { wallet, disconnect, status } = useWalletConnection();
  const { logout, role } = useAuth();
  const navigate = useNavigate();

  const walletAddress = wallet?.account.address.toString();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (status !== "connected") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl">
          👤
        </div>
        <div>
          <p className="font-semibold text-foreground">Conectá tu wallet</p>
          <p className="mt-1 text-sm text-muted">Aquí verás tu perfil y preferencias.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground">Mi Perfil</h1>
        <p className="mt-1 text-sm text-muted">Tu información de cuenta.</p>
      </div>

      {/* Role Badge */}
      <section className="rounded-3xl border border-border-low bg-card p-5 shadow-lg">
        <p className="text-xs text-muted uppercase tracking-widest">Tipo de Cuenta</p>
        <p className="mt-2 text-lg font-bold text-foreground capitalize">
          {role === "merchant" ? "🏪 Comercio" : "👤 Cliente"}
        </p>
      </section>

      {/* Wallet Info */}
      <section className="rounded-3xl border border-border-low bg-card p-5 shadow-lg">
        <h2 className="font-bold text-foreground">Información de Wallet</h2>
        
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs text-muted">Wallet Address</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">{walletAddress}</p>
          </div>

          <div className="rounded-2xl bg-cream/20 px-3 py-2 dark:bg-zinc-800/20">
            <p className="text-xs text-muted">Red: Devnet</p>
            <p className="mt-1 text-sm font-semibold text-green-600">✓ Conectado</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-low bg-card px-4 py-5 text-center">
          <p className="text-sm font-semibold text-muted">Cupones Comprados</p>
          <p className="mt-2 text-2xl font-bold text-foreground">0</p>
        </div>
        <div className="rounded-2xl border border-border-low bg-card px-4 py-5 text-center">
          <p className="text-sm font-semibold text-muted">Saldo Gastado</p>
          <p className="mt-2 text-2xl font-bold text-foreground">0 SOL</p>
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-3">
        <button
          onClick={() => navigate("/")}
          className="w-full rounded-2xl border border-border-low bg-card px-4 py-3 text-sm font-semibold text-foreground transition active:scale-95"
        >
          Ir al Marketplace
        </button>
        <button
          onClick={() => disconnect()}
          className="w-full rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-700 transition active:scale-95 dark:bg-amber-900/20 dark:text-amber-400"
        >
          Desconectar Wallet
        </button>
        <button
          onClick={handleLogout}
          className="w-full rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700 transition active:scale-95 dark:bg-red-900/20 dark:text-red-400"
        >
          Cerrar Sesión
        </button>
      </section>
    </div>
  );
}
