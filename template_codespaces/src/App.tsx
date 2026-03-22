import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar, BottomNav } from "./components/Navbar";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MerchantPage } from "./pages/MerchantPage";
import { MyCouponsPage } from "./pages/MyCouponsPage";
import { OfferDetailPage } from "./pages/OfferDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 pb-24">
          <Routes>
            <Route path="/" element={<MarketplacePage />} />
            <Route path="/merchant" element={<MerchantPage />} />
            <Route path="/coupons" element={<MyCouponsPage />} />
            <Route path="/offer/:pda" element={<OfferDetailPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
