import { NavLink, useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { useAuth } from "../lib/authContext";

export function Navbar() {
  const { connectors, connect, disconnect, wallet, status } = useWalletConnection();

  const address = wallet?.account.address.toString();
  const short = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border-low bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <span className="rounded-xl bg-primary px-3 py-1 text-sm font-bold text-primary-fg">
            Blinko
          </span>
          <span className="hidden text-xs font-medium text-muted sm:block">Local Marketplace</span>
        </NavLink>

        {/* Wallet */}
        {status === "connected" ? (
          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl border border-border-low bg-cream px-3 py-1.5 font-mono text-xs text-muted sm:block">
              {short}
            </span>
            <button
              onClick={() => disconnect()}
              className="rounded-xl border border-border-low bg-card px-3 py-2 text-xs font-medium text-muted transition active:scale-95"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {connectors.slice(0, 2).map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect(connector.id)}
                disabled={status === "connecting"}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-fg transition active:scale-95 disabled:opacity-40"
              >
                {status === "connecting" ? "Conectando..." : connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/* ── Bottom tab bar ─────────────────────────────────── */
export function BottomNav() {
  const { status } = useWalletConnection();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isMerchant = role === "merchant";

  // Tabs para CLIENTE
  const clientTabs = [
    {
      to: "/",
      end: true,
      label: "Inicio",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.092 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      to: "/",
      end: false,
      label: "Ofertas 💳",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h.008v.008H5.25v-.008zm2.25 0h.008v.008H7.5v-.008zm2.25 0h.008v.008H9.75v-.008zm2.25 0h.008v.008H12v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm-8.25 5.25h.008v.008H5.25v-.008zm2.25 0h.008v.008H7.5v-.008zm2.25 0h.008v.008H9.75v-.008zm2.25 0h.008v.008H12v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zM3.75 15a.75.75 0 00-.75.75v2.25c0 .414.336.75.75.75h16.5a.75.75 0 00.75-.75v-2.25a.75.75 0 00-.75-.75H3.75z" />
        </svg>
      ),
    },
    {
      to: "/coupons",
      end: false,
      label: "Billetera 👛",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9m0 6v-3m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
      ),
      requiresAuth: true,
    },
    {
      to: "/profile",
      end: false,
      label: "Perfil 👤",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      requiresAuth: true,
    },
  ];

  // Tabs para MERCHANT
  const merchantTabs = [
    {
      to: "/merchant",
      end: true,
      label: "Dashboard 📊",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 6.75c0-.621.504-1.125 1.125-1.125h2.25C13.496 5.625 14 6.129 14 6.75v13.5c0 .621-.504 1.125-1.125 1.125h-2.25c-.621 0-1.125-.504-1.125-1.125V6.75zm6-6c-.621 0-1.125.504-1.125 1.125v19.5c0 .621.504 1.125 1.125 1.125h2.25c.621 0 1.125-.504 1.125-1.125V1.875c0-.621-.504-1.125-1.125-1.125h-2.25z" />
        </svg>
      ),
      requiresAuth: true,
    },
    {
      to: "/merchant-offers",
      end: false,
      label: "Ofertas 💳",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h.008v.008H5.25v-.008zm2.25 0h.008v.008H7.5v-.008zm2.25 0h.008v.008H9.75v-.008zm2.25 0h.008v.008H12v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm-8.25 5.25h.008v.008H5.25v-.008zm2.25 0h.008v.008H7.5v-.008zm2.25 0h.008v.008H9.75v-.008zm2.25 0h.008v.008H12v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zm2.25 0h.008v.008h-.008v-.008zM3.75 15a.75.75 0 00-.75.75v2.25c0 .414.336.75.75.75h16.5a.75.75 0 00.75-.75v-2.25a.75.75 0 00-.75-.75H3.75z" />
        </svg>
      ),
      requiresAuth: true,
    },
    {
      to: "/merchant-scanner",
      end: false,
      label: "Escanear 📱",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 006 21.75h12a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25h-1.5m-6 3.75V3m0 6h.008v.008H9m2 5h.008v.008H11m4 0h.008v.008H15" />
        </svg>
      ),
      requiresAuth: true,
    },
    {
      to: "/profile",
      end: false,
      label: "Perfil 👤",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      requiresAuth: true,
    },
  ];

  const tabs = isMerchant ? merchantTabs : clientTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-low bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 pb-safe">
        {tabs.map((tab) => {
          if (tab.requiresAuth && status !== "connected") return null;
          return (
            <NavLink
              key={tab.to + tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition ${
                  isActive
                    ? "text-primary"
                    : "text-muted"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`transition ${isActive ? "scale-110" : ""}`}>{tab.icon}</span>
                  <span className={`text-[10px] font-semibold ${isActive ? "text-primary" : "text-muted"}`}>
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}

        {/* Botón para crear oferta (solo comercios) */}
        {isMerchant && status === "connected" && (
          <button
            onClick={() => navigate("/create-product")}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-muted transition hover:text-primary"
            title="Crear nueva oferta"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-[10px] font-semibold">Nueva 🆕</span>
          </button>
        )}
      </div>
    </nav>
  );
}
