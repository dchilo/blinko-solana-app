import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useWalletConnection } from "@solana/react-hooks";
import { AuthProvider, useAuth } from "./lib/authContext";
import { Navbar, BottomNav } from "./components/Navbar";
import { LoginPage } from "./pages/LoginPage";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MerchantPage } from "./pages/MerchantPage";
import { MyCouponsPage } from "./pages/MyCouponsPage";
import { OfferDetailPage } from "./pages/OfferDetailPage";
import { CreateProductPage } from "./pages/CreateProductPage";
import { MerchantProductScannerPage } from "./pages/MerchantProductScannerPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MerchantDashboard } from "./pages/MerchantDashboard";

function AppContent() {
  const { isAuthenticated, role } = useAuth();
  const { status } = useWalletConnection();
  const navigate = useNavigate();

  // Redirigir a login si wallet se desconecta
  useEffect(() => {
    if (status === "disconnected" && isAuthenticated) {
      navigate("/");
    }
  }, [status, isAuthenticated, navigate]);

  // Redirigir a dashboard si es merchant
  useEffect(() => {
    if (isAuthenticated && role === "merchant" && window.location.pathname === "/") {
      navigate("/merchant");
    }
  }, [isAuthenticated, role, navigate]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pb-24">
        <Routes>
          {/* Rutas Cliente */}
          {role === "client" && (
            <>
              <Route path="/" element={<MarketplacePage />} />
              <Route path="/coupons" element={<MyCouponsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/offer/:pda" element={<OfferDetailPage />} />
              <Route path="*" element={<MarketplacePage />} />
            </>
          )}

          {/* Rutas Comercio */}
          {role === "merchant" && (
            <>
              <Route path="/merchant" element={<MerchantDashboard />} />
              <Route path="/merchant-offers" element={<MerchantPage />} />
              <Route path="/merchant-scanner" element={<MerchantProductScannerPage />} />
              <Route path="/create-product" element={<CreateProductPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="*" element={<MerchantDashboard />} />
            </>
          )}
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
