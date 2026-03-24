import { useEffect, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { useLocation } from "react-router-dom";
import { getStoredToken } from "../lib/auth";
import { fetchMerchantStats, fetchMerchantTransactions, type MerchantStats, type TransactionRecord } from "../lib/backend";

export function MerchantDashboard() {
  const { status } = useWalletConnection();
  const location = useLocation();
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const loadData = async () => {
    try {
      setLoading(true);
      const token = getStoredToken();
      if (!token) {
        setError("No token found");
        return;
      }

      const [statsData, txData] = await Promise.all([
        fetchMerchantStats(token),
        fetchMerchantTransactions(token),
      ]);

      setStats(statsData);
      setTransactions(txData);
      setError(null);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error("Error loading dashboard:", err);
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar y cuando se vuelve a la ruta
  useEffect(() => {
    if (status === "connected") {
      loadData();
    }
  }, [status, location.pathname]);

  // Recargar datos cada 10 segundos (para ver actualizaciones en tiempo real)
  useEffect(() => {
    if (status !== "connected") return;

    const interval = setInterval(() => {
      loadData();
    }, 10000);

    return () => clearInterval(interval);
  }, [status]);

  if (status !== "connected") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-3xl">
          📊
        </div>
        <div>
          <p className="font-bold text-foreground">Conectá tu wallet</p>
          <p className="mt-1 text-sm text-muted">Necesitás Phantom o Backpack en Devnet.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="h-24 animate-pulse rounded-3xl border border-border-low bg-card" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 animate-pulse rounded-3xl border border-border-low bg-card" />
          <div className="h-28 animate-pulse rounded-3xl border border-border-low bg-card" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/20">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error || "Error cargando datos"}</p>
        </div>
      </div>
    );
  }

  const maxEarnings = Math.max(...stats.weeklyEarnings.map((d) => d.earnings));

  // Transacciones de hoy
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter(
    (tx) => new Date(tx.timestamp).toDateString() === today
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-foreground">Dashboard</h1>
        <p className="mt-2 text-sm text-muted">Estado de tu comercio hoy</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Total Income */}
        <div className="rounded-3xl border border-border-low bg-card p-5 shadow-lg">
          <p className="text-xs text-muted uppercase tracking-widest font-bold">Ingresos Totales</p>
          <p className="mt-3 text-3xl font-black text-foreground">{stats.totalIncomeSol.toFixed(2)}</p>
          <p className="mt-1 text-xs text-primary font-semibold">SOL</p>
        </div>

        {/* Coupons Redeemed Today */}
        <div className="rounded-3xl border border-border-low bg-card p-5 shadow-lg">
          <p className="text-xs text-muted uppercase tracking-widest font-bold">Canjeadas Hoy</p>
          <p className="mt-3 text-3xl font-black text-foreground">{stats.couponsRedeemedToday}</p>
          <p className="mt-1 text-xs text-primary font-semibold">cupones</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-3xl border border-border-low bg-card p-6 shadow-lg">
        <h2 className="font-bold text-foreground mb-4">Ganancias (Últimos 7 días)</h2>
        <div className="flex items-end gap-2 h-40">
          {stats.weeklyEarnings.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="w-full bg-gradient-to-t from-primary to-primary/60 rounded-t-xl transition hover:opacity-80"
                style={{
                  height: `${maxEarnings > 0 ? (d.earnings / maxEarnings) * 100 : 0}%`,
                  minHeight: d.earnings > 0 ? "4px" : "0px",
                }}
                title={`${d.day}: ${d.earnings.toFixed(2)} SOL`}
              />
              <p className="text-xs text-muted font-semibold">{d.day}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Fee Info */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-bold">Total Canjeados</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalCouponsRedeemed}</p>
          </div>
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-bold">Comisión App (5%)</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats.totalPlatformFee.toFixed(2)}</p>
            <p className="text-xs text-muted mt-1">SOL</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-3xl border border-border-low bg-card p-6 shadow-lg">
        <h2 className="font-bold text-foreground mb-4">
          {todayTransactions.length > 0 ? "Canjes de Hoy" : "Transacciones Recientes"}
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted">Sin transacciones aún</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(todayTransactions.length > 0 ? todayTransactions : transactions.slice(0, 4)).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-2xl border border-border-low bg-background/50 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{tx.offerTitle}</p>
                  <p className="text-xs text-muted">
                    {new Date(tx.timestamp).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {new Date(tx.timestamp).toDateString() !== today
                      ? ` · ${new Date(tx.timestamp).toLocaleDateString("es")}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary text-sm">+{tx.merchantEarningSol.toFixed(2)} SOL</p>
                  <p className="text-xs text-muted">Tu ganancia</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Earnings Breakdown */}
      {transactions.length > 0 && (
        <div className="rounded-3xl border border-amber-200/50 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10 p-5">
          <p className="text-xs text-amber-700 dark:text-amber-400 uppercase tracking-widest font-bold mb-3">
            Desglose de Ganancias
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Monto total canjeado:</span>
              <span className="font-semibold text-foreground">
                {transactions.reduce((sum, tx) => sum + tx.amountSol, 0).toFixed(2)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Tu ganancia (95%):</span>
              <span className="font-semibold text-primary">
                {transactions.reduce((sum, tx) => sum + tx.merchantEarningSol, 0).toFixed(2)} SOL
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Comisión app (5%):</span>
              <span className="font-semibold text-muted">
                {transactions.reduce((sum, tx) => sum + tx.platformFeeSol, 0).toFixed(2)} SOL
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
