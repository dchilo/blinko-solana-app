import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useWalletConnection } from "@solana/react-hooks";

export type UserRole = "client" | "merchant";

interface AuthContextType {
  role: UserRole | null;
  isAuthenticated: boolean;
  token: string | null;
  loginAsClient: () => void;
  loginAsMerchant: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MERCHANT_PASSWORD = "kipo2024"; // Clave simple - en producción usar mejor sistema

// Función simple para crear un JWT-like token
function createToken(walletAddress: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ 
    sub: walletAddress, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 // 24 horas
  }));
  // Nota: sin firma por ahora (el backend validará la estructura)
  return `${header}.${payload}.UNSIGNED`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { status, wallet } = useWalletConnection();

  // Cargar rol y token del localStorage al iniciar
  useEffect(() => {
    const savedRole = localStorage.getItem("blinko_role") as UserRole | null;
    const savedToken = localStorage.getItem("blinko_token");
    if (savedRole) setRole(savedRole);
    if (savedToken) setToken(savedToken);
  }, []);

  // Limpiar rol y token si la wallet se desconecta
  useEffect(() => {
    if (status === "disconnected") {
      setRole(null);
      setToken(null);
      localStorage.removeItem("blinko_role");
      localStorage.removeItem("blinko_token");
    }
  }, [status]);

  const loginAsClient = () => {
    if (!wallet?.account.address) return;
    const walletAddr = wallet.account.address.toString();
    const newToken = createToken(walletAddr);
    
    setRole("client");
    setToken(newToken);
    localStorage.setItem("blinko_role", "client");
    localStorage.setItem("blinko_token", newToken);
  };

  const loginAsMerchant = (password: string): boolean => {
    if (password !== MERCHANT_PASSWORD || !wallet?.account.address) return false;
    
    const walletAddr = wallet.account.address.toString();
    const newToken = createToken(walletAddr);
    
    setRole("merchant");
    setToken(newToken);
    localStorage.setItem("blinko_role", "merchant");
    localStorage.setItem("blinko_token", newToken);
    return true;
  };

  const logout = () => {
    setRole(null);
    setToken(null);
    localStorage.removeItem("blinko_role");
    localStorage.removeItem("blinko_token");
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        isAuthenticated: role !== null,
        token,
        loginAsClient,
        loginAsMerchant,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
