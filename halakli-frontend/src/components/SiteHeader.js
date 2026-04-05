// src/components/SiteHeader.js
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping, faUserShield } from "@fortawesome/free-solid-svg-icons";
import { faUser } from "@fortawesome/free-regular-svg-icons";
import { useCart } from "../contexts/CartContext";
import "../csscom/Account.css";
import ShoppingCart from "./Shoppingcart";
import UserMenu from "./UserMenu";
import { useAuth } from "../contexts/AuthContext";

export default function SiteHeader({
  variant,
  onCheckout = () => {},
  freeShippingThreshold = 699,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname, search } = location;
  const kind = variant || (pathname === "/" ? "home" : "account");

  const { items, setQty, remove, incQty } = useCart();
  const cartCount = useMemo(
    () => items.reduce((n, it) => n + (Number(it.qty) || 0), 0),
    [items]
  );

  const { user, logout } = useAuth();

  const [isAdminView, setIsAdminView] = useState(false);
  const [active, setActive] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(search);
    const adminFromQuery = sp.get("admin");

    if (adminFromQuery === "1") {
      localStorage.setItem("isAdminView", "1");
      setIsAdminView(true);
    } else if (adminFromQuery === "0") {
      localStorage.removeItem("isAdminView");
      setIsAdminView(false);
    } else {
      const fromLS =
        typeof window !== "undefined" &&
        localStorage.getItem("isAdminView") === "1";
      setIsAdminView(fromLS);
    }
  }, [search]);

  useEffect(() => {
    if (isAdminView) {
      document.body.classList.add("admin-view");
    } else {
      document.body.classList.remove("admin-view");
    }
  }, [isAdminView]);

  useEffect(() => {
    const body = document.body;
    if (active) {
      setCartOpen(false);
      const y = window.scrollY || 0;
      body.style.position = "fixed";
      body.style.top = `-${y}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.classList.add("menu-open");
      body.dataset.overlay = "menu";
      const onEsc = (e) => e.key === "Escape" && setActive(false);
      window.addEventListener("keydown", onEsc);
      return () => window.removeEventListener("keydown", onEsc);
    } else {
      const top = Math.abs(parseInt(body.style.top || "0", 10)) || 0;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      if (top) window.scrollTo(0, top);
      body.classList.remove("menu-open");
      if (body.dataset.overlay === "menu") delete body.dataset.overlay;
    }
  }, [active]);

  useEffect(() => {
    const onOpen = () => setCartOpen(true);
    window.addEventListener("cart:open", onOpen);
    return () => window.removeEventListener("cart:open", onOpen);
  }, []);

  useEffect(() => {
    const body = document.body;
    if (cartOpen) {
      setActive(false);
      body.dataset.overlay = "cart";
      body.classList.add("no-scroll");
    } else {
      if (body.dataset.overlay === "cart") delete body.dataset.overlay;
      body.classList.remove("no-scroll");
    }
  }, [cartOpen]);

  const adminSuffix = isAdminView ? "?admin=1&bare=1" : "";

  return (
    <>
      {kind === "home" ? (
        <div className="account-topbar__icons">
          {/* עגלה */}
          <button
            type="button"
            aria-label={`פתח עגלה (${cartCount} פריטים)`}
            className={`account-icon account-icon--cart cart-btn-with-badge ${
              isAdminView ? "account-icon--cart-admin" : ""
            }`}
            onClick={() => setCartOpen(true)}
          >
            <FontAwesomeIcon
              icon={faCartShopping}
              size="2x"
              className="icon-cart"
            />
            {cartCount > 0 && (
              <span className="cart-badge" aria-hidden="true">
                {cartCount}
              </span>
            )}
          </button>

          {isAdminView ? (
            <button
              type="button"
              className="admin-back-btn--home"
              onClick={() => navigate("/admin")}
              aria-label="חזרה לניהול מוצרים"
            >
              <FontAwesomeIcon icon={faUserShield} />
            </button>
          ) : user ? (
            <UserMenu
              user={user}
              onLogout={() => {
                logout();
                navigate("/account?step=login", { replace: true });
              }}
            />
          ) : (
            <FontAwesomeIcon
              icon={faUser}
              className="icon-user"
              role="button"
              tabIndex={0}
              onClick={() => navigate("/account?step=login")}
              onKeyDown={(e) =>
                e.key === "Enter" && navigate("/account?step=email")
              }
            />
          )}

          <div
            className={`menu__item--hamburger ${active ? "active" : ""}`}
            tabIndex={1}
            onClick={() => setActive((v) => !v)}
          >
            <div className="hamburger-lines">
              <div className="line" />
              <div className="line" />
              <div className="line" />
            </div>
            <span className="menu-label">MENU</span>
          </div>
        </div>
      ) : (
        <div className="topbar topbar--static">
          <div className="topbar__bar" aria-hidden="true" />

          {/* 🔹 הלוגו – תמיד מחזיר ל-/home */}
          <div
            className="topbar__logo-wrapper"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/home")}
            onKeyDown={(e) => e.key === "Enter" && navigate("/home")}
            style={{ cursor: "pointer" }}
          >
            <img src="/blacklogo.png" alt="Halakli" className="topbar__logo" />
          </div>

          <div className="account-topbar__icons">
            <button
              type="button"
              aria-label={`פתח עגלה (${cartCount} פריטים)`}
              className="account-icon account-icon--cart cart-btn-with-badge"
              onClick={() => setCartOpen(true)}
            >
              <FontAwesomeIcon icon={faCartShopping} size="2x" />
              {cartCount > 0 && (
                <span className="cart-badge" aria-hidden="true">
                  {cartCount}
                </span>
              )}
            </button>

            {isAdminView ? (
              <button
                type="button"
                className="admin-back-btn admin-back-btn--account"
                onClick={() => navigate("/admin/products")}
                aria-label="חזרה ללוח ניהול"
                title="חזרה ללוח ניהול"
              >
                <FontAwesomeIcon icon={faUserShield} />
              </button>
            ) : user ? (
              <UserMenu
                user={user}
                onLogout={() => {
                  logout();
                  navigate("/account?step=login", { replace: true });
                }}
              />
            ) : (
              <FontAwesomeIcon
                icon={faUser}
                className="account-icon account-icon--user"
                role="button"
                tabIndex={0}
                onClick={() => navigate("/account?step=login")}
                onKeyDown={(e) =>
                  e.key === "Enter" && navigate("/account?step=login")
                }
              />
            )}

            <div
              className={`account-hamburger ${active ? "active" : ""}`}
              tabIndex={1}
              onClick={() => setActive((v) => !v)}
            >
              <div className="account-hamburger__line" />
              <div className="account-hamburger__line" />
              <div className="account-hamburger__line" />
              <span className="account-menu__label">MENU</span>
            </div>
          </div>
        </div>
      )}

      {/* רקע של התפריט */}
      <div
        className={`menu-backdrop ${active ? "show" : ""}`}
        onClick={() => setActive(false)}
        aria-hidden={!active}
      />

      {/* תפריט צדדי */}
      <aside
        className={`menu-drawer ${active ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobileMenuTitle"
      >
        <nav className="drawer-nav" aria-label="תפריט ראשי">
          <br />
          <br />
          <br />
          <ul onClick={() => setActive(false)}>
            <li className="drawer-sep" aria-hidden="true"></li>
            <li>
              <Link to={`/products${adminSuffix}`}>כל המוצרים</Link>
            </li>
            <li>
              <Link to={`/smooties${adminSuffix}`}>החלקות ביתיות</Link>
            </li>
            <li>
              <Link to={`/kits${adminSuffix}`}>ערכות ביתיות</Link>
            </li>
            <li>
              <Link to={`/productshair${adminSuffix}`}>מוצרי שיער</Link>
            </li>
            <br />
            <br />
            <br />
            <br />
            <br />
            <br />
            <li className="drawer-sep" aria-hidden="true"></li>
            <li>
              <Link to={`/vlog${adminSuffix}`}>בלוג</Link>
            </li>
            <li>
              <Link to={`/qa${adminSuffix}`}>שאלות תשובות</Link>
            </li>
            <li>
              <a href="#about">about me</a>
            </li>
          </ul>
        </nav>
      </aside>

      <ShoppingCart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        onQtyChange={(id, nextQty, shade) => setQty(id, shade, nextQty)}
        onInc={(id, shade) => incQty(id, shade, +1)}
        onDec={(id, shade) => incQty(id, shade, -1)}
        onRemove={(id, shade) => remove(id, shade)}
        onCheckout={() => {
          onCheckout?.();
          setCartOpen(false);
        }}
        freeShippingThreshold={freeShippingThreshold}
      />
    </>
  );
}
