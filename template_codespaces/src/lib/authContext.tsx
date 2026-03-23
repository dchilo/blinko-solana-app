import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useWalletConnection } from "@solana/react-hooks";

export type UserRole = "client" | "merchant";

interface AuthContextType {
  role: UserRole | null;
  isAuthenticated: boolean;
  loginAsClient: () => void;
  loginAsMerchant: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MERCHANT_PASSWORD = "kipo2024"; // Clave simple - en producción usar mejor sistema

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const { status } = useWalletConnection();

  // Cargar rol del localStorage al iniciar
  useEffect(() => {
    const savedRole = localStorage.getItem("blinko_role") as UserRole | null;
    if (savedRole) setRole(savedRole);
  }, []);

  // Limpiar rol si la wallet se desconecta
  useEffect(() => {
    if (status === "disconnected") {
      setRole(null);
      localStorage.removeItem("blinko_role");
    }
  }, [status]);

  const loginAsClient = () => {
    setRole("client");
    localStorage.setItem("blinko_role", "client");
  };

  const loginAsMerchant = (password: string): boolean => {
    if (password === MERCHANT_PASSWORD) {
      setRole("merchant");
      localStorage.setItem("blinko_role", "merchant");
      return true;
    }
    return false;
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem("blinko_role");
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        isAuthenticated: role !== null,
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
