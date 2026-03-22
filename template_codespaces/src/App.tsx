import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navbar, BottomNav } from "./components/Navbar";
import { MarketplacePage } from "./pages/MarketplacePage";
import { MerchantPage } from "./pages/MerchantPage";
import { MyCouponsPage } from "./pages/MyCouponsPage";
import { OfferDetailPage } from "./pages/OfferDetailPage";
import { CreateProductPage } from "./pages/CreateProductPage";
import { MerchantProductScannerPage } from "./pages/MerchantProductScannerPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 pb-24">
          <Routes>
            <Route path="/" element={<MarketplacePage />} />
            <Route path="/merchant" element={<MerchantPage />} />
            <Route path="/merchant-scanner" element={<MerchantProductScannerPage />} />
            <Route path="/coupons" element={<MyCouponsPage />} />
            <Route path="/offer/:pda" element={<OfferDetailPage />} />
            <Route path="/create-product" element={<CreateProductPage />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
