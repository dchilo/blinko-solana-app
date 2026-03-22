import { NavLink } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";

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

  const tabs = [
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
      to: "/coupons",
      end: false,
      label: "Mis Cupones",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
        </svg>
      ),
      requiresAuth: true,
    },
    {
      to: "/merchant",
      end: false,
      label: "Mi Local",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.585a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
        </svg>
      ),
      requiresAuth: true,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-low bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 pb-safe">
        {tabs.map((tab) => {
          if (tab.requiresAuth && status !== "connected") return null;
          return (
            <NavLink
              key={tab.to}
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
      </div>
    </nav>
  );
}
