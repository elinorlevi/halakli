// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import Home from "./components/Home";
import Cardwindows from "./components/Cardwindows";
import Account, { api } from "./components/Account";
import ResetPassword from "./components/ResetPassword";
import AllProducts from "./components/AllProducts";
import Smoothies from "./components/Smoothies";
import ProductHair from "./components/ProductHair";
import ProductPage from "./components/ProductPage";
import Kits from "./components/Kits";
import Shoppingcart from "./components/Shoppingcart";
import QA from "./components/QA";
import Vlog from "./components/Vlog";
import VlogPage from "./components/VlogPage";
import CheckoutPage from "./components/CheckoutPage";
import UserMenu from "./components/UserMenu";
import { AuthProvider } from "./contexts/AuthContext";
import AccountSettings from "./components/AccountSettings";
import Favorites from "./components/Favorites";
import AdminDashboard from "./components/admin/AdminDashboard";
import AdminLayout from "./components/admin/AdminLayout";
import AdminOrders from "./components/admin/AdminOrders";
import AdminVlogs from "./components/admin/AdminVlogs";
import RequireAdmin from "./components/admin/RequireAdmin";
import Thanku from "./components/Thanku";
import PaymentPage from "./components/PaymentPage";
import AdminProducts from "./components/admin/AdminProducts";
import AdminShopView from "./components/admin/AdminShopView";

import "./csscom/Home.css";
import "./csscom/Cardwindows.css";
import "./csscom/Account.css";
import "./csscom/Product.css";
import "./csscom/ProductPage.css";
import "./csscom/Shoppingcart.css";
import "./csscom/QA.css";
import "./csscom/Vlog.css";
import "./csscom/VlogPage.css";
import "./csscom/Usermenu.css";
import "./csscom/favorites.css";
import "./csscom/admin/AdminDashboard.css";
import "./csscom/admin/AdminEdit.css";

import { useCart } from "./contexts/CartContext";

import {
  ensureSession,
  heartbeat,
  setupUnloadHook,
  logPageView,
} from "./contexts/analytics";

export default function App() {
  const { items, add, setQty, remove } = useCart();
  const { pathname, search } = useLocation();

  // ---- Helper קטן: בודק אם אנחנו באזור אדמין ----
  function isAdminPath(p) {
    return p.startsWith("/admin");
  }

  // אפקט 1
  useEffect(() => {
    if (isAdminPath(window.location.pathname)) {
      return;
    }
    ensureSession();
    setupUnloadHook();
    const beat = setInterval(() => {
      if (!isAdminPath(window.location.pathname)) {
        heartbeat();
      }
    }, 30_000);
    return () => clearInterval(beat);
  }, []);

  // אפקט 2
  useEffect(() => {
    if (isAdminPath(pathname)) {
      return;
    }
    logPageView(pathname, document.referrer);
    ensureSession();
  }, [pathname]);

  // 👇 קומפוננטה קטנה שעוטפת את AllProducts למצב "מסך לקוח"
  function ClientAllProductsPage() {
    // אם נרצה בעתיד לקרוא פרמטרים מה-URL:
    // const params = new URLSearchParams(search);
    // אפשר לבדוק פה admin=1 וכו'
    return (
      <AllProducts
        adminMode={true}
        hideChrome={true}
      />
    );
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/home" />} />
        <Route path="home" element={<Home onAddToCart={add} />} />
        <Route path="card" element={<Cardwindows />} />
        <Route path="/thanku" element={<Thanku />} />
        <Route path="/account" element={<Account />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/products" element={<AllProducts onAddToCart={add} />} />
        <Route path="/smooties" element={<Smoothies onAddToCart={add} />} />
        <Route path="/productshair" element={<ProductHair onAddToCart={add} />} />
        <Route path="/kits" element={<Kits onAddToCart={add} />} />
        <Route path="/account/settings" element={<AccountSettings />} />
        <Route path="/product/:id" element={<ProductPage onAddToCart={add} />} />
        <Route path="/admin/shop-view" element={<AdminShopView />} />

        {/* 👇 הנה הראוט שחסר לך – מסך לקוח לעריכה */}
        <Route path="/all-products" element={<ClientAllProductsPage />} />

        <Route
          path="/shoppingcart"
          element={
            <Shoppingcart
              items={items}
              onQtyChange={(id, nextQty, shade) => setQty(id, shade, nextQty)}
              onRemove={(id, shade) => remove(id, shade)}
              onAdd={add}
            />
          }
        />
        <Route path="/reset" element={<ResetPassword api={api} />} />
        <Route path="/qa" element={<QA />} />
        <Route path="/checkoutpage" element={<CheckoutPage />} />
        <Route path="/usermenu" element={<UserMenu />} />
        <Route path="/pay" element={<PaymentPage />} />
        <Route path="/vlog" element={<Vlog />} />
        <Route path="/vlogs" element={<Vlog />} />
        <Route path="/vlogs/:id" element={<VlogPage />} />

        {/* אזור אדמין */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="vlogs" element={<AdminVlogs />} />
          <Route path="products" element={<AdminProducts />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
