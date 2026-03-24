import { useEffect, useState } from "react";
import { useWalletConnection } from "@solana/react-hooks";
import { useLocation } from "react-router-dom";
import { getStoredToken } from "../lib/auth";
import { 
  fetchMerchantStats, 
  fetchMerchantTransactions, 
  type MerchantStats, 
  type TransactionRecord 
} from "../lib/backend";

export function MerchantDashboard() {
  const { status } = useWalletConnection();
  const location = useLocation();
  
  // Estados de datos
  const [stats, setStats] = useState<MerchantStats | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  
  // Estados de control UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /**
   * Carga los datos desde Supabase.
   * @param isSilent Si es true, no activa el estado de 'loading' (evita parpadeo)
   */
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      
      const token = getStoredToken();
      if (!token) {
        setError("No se encontró una sesión activa (Token JWT faltante)");
        return;
      }

      // Ejecutamos ambas peticiones en paralelo para mayor velocidad
      const [statsData, txData] = await Promise.all([
        fetchMerchantStats(token),
        fetchMerchantTransactions(token),
      ]);

      setStats(statsData);
      setTransactions(txData);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error al actualizar el dashboard:", err);
      // Solo mostramos el error en grande si no tenemos datos previos en pantalla
      if (!stats) {
        setError(err instanceof Error ? err.message : "Error cargando datos del servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  // Efecto 1: Carga inicial cuando se conecta la wallet o cambia de página
  useEffect(() => {
    if (status === "connected") {
      loadData(false);
    }
  }, [status, location.pathname]);

  // Efecto 2: Polling (actualización automática) cada 10 segundos
  useEffect(() => {
    if (status !== "connected") return;

    const interval = setInterval(() => {
      loadData(true); // Actualización silenciosa en segundo plano
    }, 10000);

    return () => clearInterval(interval);
  }, [status]);

  // --- Renderizado de estados de carga y error ---

  if (status !== "connected") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
          📊
        </div>
        <div>
          <p className="font-bold text-foreground">Conectá tu wallet</p>
          <p className="mt-1 text-sm text-muted">Necesitás Phantom o Backpack en Devnet para ver tus métricas.</p>
        </div>
      </div>
    );
  }

  // Solo mostramos skeletons en la carga inicial
  if (loading && !stats) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="h-32 animate-pulse rounded-3xl border border-border-low bg-card" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-28 animate-pulse rounded-3xl border border-border-low bg-card" />
          <div className="h-28 animate-pulse rounded-3xl border border-border-low bg-card" />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-bold text-red-600">{error}</p>
          <button 
            onClick={() => loadData(false)}
            className="mt-4 text-xs font-bold underline text-red-700"
          >
            Reintentar conexión
          </button>
        </div>
      </div>
    );
  }

  // --- Lógica de visualización ---

  const maxEarnings = stats ? Math.max(...stats.weeklyEarnings.map((d) => d.earnings)) : 0;
  const today = new Date().toDateString();
  const todayTransactions = transactions.filter(
    (tx) => new Date(tx.timestamp).toDateString() === today
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      
      {/* Header con Indicador de Actualización */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted tracking-tight">Estado de tu comercio</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">En Vivo</span>
          </div>
          <p className="text-[10px] font-medium text-muted">
            Actualizado: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border-low bg-card p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Ingresos Totales</p>
          <p className="mt-3 text-3xl font-black text-foreground">
            {stats?.totalIncomeSol.toFixed(3)}
          </p>
          <p className="text-[10px] font-bold text-primary">SOL</p>
        </div>

        <div className="rounded-3xl border border-border-low bg-card p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Canjes de Hoy</p>
          <p className="mt-3 text-3xl font-black text-foreground">
            {stats?.couponsRedeemedToday}
          </p>
          <p className="text-[10px] font-bold text-primary">CUPONES</p>
        </div>
      </div>

      {/* Gráfico de Barras */}
      <div className="rounded-3xl border border-border-low bg-card p-6 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">Ganancias últimos 7 días</h2>
        <div className="mt-6 flex h-32 items-end gap-3">
          {stats?.weeklyEarnings.map((d, i) => (
            <div key={i} className="group relative flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-primary/20 transition-all duration-500 group-hover:bg-primary"
                style={{
                  height: `${maxEarnings > 0 ? (d.earnings / maxEarnings) * 100 : 0}%`,
                  minHeight: d.earnings > 0 ? "4px" : "2px",
                }}
              />
              <span className="text-[10px] font-bold text-muted">{d.day}</span>
              {/* Tooltip simple al pasar el mouse */}
              <div className="absolute -top-8 hidden rounded bg-foreground px-2 py-1 text-[10px] text-background group-hover:block">
                {d.earnings.toFixed(2)} SOL
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transacciones Recientes */}
      <div className="rounded-3xl border border-border-low bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-foreground">
          {todayTransactions.length > 0 ? "Actividad de hoy" : "Últimos canjes"}
        </h2>
        
        {transactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            Todavía no hay transacciones registradas.
          </div>
        ) : (
          <div className="space-y-3">
            {(todayTransactions.length > 0 ? todayTransactions : transactions.slice(0, 5)).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-2xl border border-border-low bg-background/40 p-4 transition hover:bg-background/60">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{tx.offerTitle}</p>
                  <p className="text-[10px] text-muted">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {new Date(tx.timestamp).toDateString() !== today ? ` · ${new Date(tx.timestamp).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary">+{tx.merchantEarningSol.toFixed(3)} SOL</p>
                  <p className="text-[10px] font-bold text-muted">NETO</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resumen de Comisiones */}
      <div className="rounded-3xl bg-primary/5 p-6 dark:bg-primary/10">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Resumen de Comisiones</h3>
           <span className="text-[10px] font-bold text-primary">Tasa: 5%</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted">Total facturado:</span>
            <span className="font-bold text-foreground">
              {transactions.reduce((sum, tx) => sum + tx.amountSol, 0).toFixed(3)} SOL
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted">Fee plataforma:</span>
            <span className="font-bold text-muted">
              {stats?.totalPlatformFee.toFixed(3)} SOL
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}