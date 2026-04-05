import React, { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping } from "@fortawesome/free-solid-svg-icons";
import { faCircleCheck } from "@fortawesome/free-regular-svg-icons";
import { useCartBroadcast } from "../hooks/useCartBroadcast";

// ✅ מבטיח cart_id בלוקאלסטורג'
// ✅ מבטיח עגלה אמיתית ב-DB וגם שומר את ה-id בלוקאלסטורג'
// ✅ מבטיח עגלה אמיתית מהשרת
// ✅ ישן: רק לוקאלסטורג' – לא מושלם אבל לא יפיל את הקומפוננטה
function ensureCartId() {
  try {
    let id = localStorage.getItem("cart_id");
    if (!id) {
      id = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem("cart_id", id);
    }
    return id;
  } catch {
    return null;
  }
}

// ✅ חדש: יוצר עגלה אמיתית בשרת
async function ensureCartOnServer() {
  try {
    const res = await fetch("/api/carts/get-or-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("failed to create/get cart");
    const cart = await res.json();
    if (cart?.id) {
      localStorage.setItem("cart_id", String(cart.id)); // שומר מספר אמיתי
    }
    return cart;
  } catch (e) {
    console.error("ensureCartOnServer error:", e);
    return { id: null };
  }
}


export default function ShoppingCart({
  open,
  onClose,
  items = [],
  onQtyChange = () => {},
  onRemove = () => {},
  onCheckout = () => {},
  freeShippingThreshold = 699, // לא נסמוך עליו בחישוב הדגל, רק אם תרצי בעתיד
  onInc,   // אופציונלי
  onDec,   // אופציונלי
}) {
  const [agreed, setAgreed] = useState(false);

  // סכום ביניים לפי פריטים
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const price = Number(it.price) || 0;
      const qty   = Number(it.qty)   || 1;
      return sum + price * qty;
    }, 0);
  }, [items]);

  // 🔗 משדרים items+subtotal באופן יציב (BroadcastChannel + storage + window event)
  useCartBroadcast(items, subtotal);

  // כפתור תשלום מושבת אם לא אישרו תנאים או שאין פריטים
  const isDisabled = !agreed || items.length === 0;

  // כלל קשיח למשלוח חינם באתר (שיהיה מסונכרן עם הקופה)
  const threshold = 699;
  const remaining = Math.max(0, threshold - subtotal);
  const progress  = Math.min(100, Math.round((subtotal / threshold) * 100));

  // דגל משלוח חינם לפי הסף
  const isFreeShipping = subtotal >= threshold;

async function handleQtyChange(id, nextQty, shade) {
  // 1) קודם לעדכן פרונט
  if (nextQty <= 0) {
    onRemove?.(id, shade);
  } else {
    onQtyChange?.(id, nextQty, shade);
  }

  // 2) נחפש את הפריט כדי לדעת את המחיר
  const currentItem = items.find(
    (it) => it.id === id && (shade ? it.shade === shade : true)
  );
  const unitPrice = currentItem ? Number(currentItem.price) || 0 : 0;

  // 3) עכשיו נסנכרן לשרת
  try {
    // לוודא שיש עגלה אמיתית
    const cartIdLS = localStorage.getItem("cart_id");
    const cartIdNum = cartIdLS ? Number(cartIdLS) : null;
    const realCart = cartIdNum ? { id: cartIdNum } : await ensureCartOnServer();
    const realCartId = realCart.id;

    if (nextQty <= 0) {
      // מחיקה
      await fetch("/api/cartitem/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart_id: realCartId,
          product_id: id,
          shade,
        }),
      });
    } else {
      // הוספה / עדכון כמות
      await fetch("/api/cartitem/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart_id: realCartId,
          product_id: id,
          qty: nextQty,
          unit_price: unitPrice, // ← זה במקום ההערה
          shade,                  // אם יש לך שדה כזה בשרת
        }),
      });
    }
  } catch (e) {
    console.warn("cannot sync cart qty to server", e);
  }
}


  // ודא cart_id פעם אחת
 useEffect(() => {
  // נוודא שיש עגלה אמיתית ברגע שהמגירה נטענת
  ensureCartOnServer();
}, []);


  // נעילת גלילה כשמגירה פתוחה
  useEffect(() => {
    const body = document.body;
    if (open) {
      const y = window.scrollY || 0;
      body.style.position = "fixed";
      body.style.top = `-${y}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.dataset.overlay = "cart";
    } else {
      const top = Math.abs(parseInt(body.style.top || "0", 10)) || 0;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      if (top) window.scrollTo(0, top);
      if (body.dataset.overlay === "cart") delete body.dataset.overlay;
    }
    return () => {
      const top = Math.abs(parseInt(document.body.style.top || "0", 10)) || 0;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      if (top) window.scrollTo(0, top);
      if (document.body.dataset.overlay === "cart") delete document.body.dataset.overlay;
    };
  }, [open]);

  // ESC לסגירה
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // עדכון לוקאלסטורג' להתמדה/סנכרון כללי (לא קשור ל-bus)
 useEffect(() => {
  try {
    localStorage.setItem("cart_items", JSON.stringify(items));
    localStorage.setItem("cart_subtotal", String(subtotal.toFixed(2)));
    localStorage.setItem(
      "cart_snapshot",
      JSON.stringify({
        updated_at: new Date().toISOString(),
        count: items.reduce((n, it) => n + (Number(it.qty) || 1), 0),
        subtotal: Number(subtotal.toFixed(2)),
      })
    );
  } catch {}
}, [items, subtotal]);

  function formatPrice(n) {
    return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS" }).format(n || 0);
  }

  // שמירת היסטוריית הזמנה (אופציונלי)
  function persistOrderHistory() {
    try {
      const order = {
        id: `ord_${Date.now()}`,
        created_at: new Date().toISOString(),
        items: items.map(it => ({
          id: it.id,
          title: it.title,
          price: Number(it.price) || 0,
          qty: Number(it.qty) || 1,
          img: it.img,
          shade: it.shade ?? null
        })),
        subtotal: Number(subtotal.toFixed(2)),
      };
      const raw = localStorage.getItem("orders_history");
      const parsed = raw ? JSON.parse(raw) : [];
      const history = Array.isArray(parsed) ? parsed : [];
      history.push(order);
      localStorage.setItem("orders_history", JSON.stringify(history));
    } catch {}
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`cart-overlay ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        className={`cart-drawer ${open ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        dir="rtl"
      >
        <header className="cart-header">
          <button className="cart-close" aria-label="סגור" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <line x1="18" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="12,6 6,12 12,18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h2 id="cart-title" className="cart-title">
            סל הקניות שלך{" "}
            <FontAwesomeIcon
              icon={faCartShopping}
              className="cart-title__icon"
              style={{ fontSize: 17, marginInlineStart: 8 }}
            />
          </h2>

          <p className="cart-free-msg">
            {remaining > 0 ? (
              <>עוד <strong>{formatPrice(remaining)}</strong> למשלוח חינם!</>
            ) : (
              <>
                יש לך <strong>משלוח חינם</strong>{" "}
                <FontAwesomeIcon icon={faCircleCheck} className="cart-free-icon" />
              </>
            )}
          </p>

          <div className="cart-progress" aria-label="התקדמות למשלוח חינם">
            <div className="cart-progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </header>

        <div className="cart-body">
          {items.length === 0 ? (
            <p className="cart-empty">העגלה שלך ריקה ×</p>
          ) : (
            <ul className="cart-list">
              {items.map((it) => {
                const qty = Number(it.qty) || 1;
                return (
                  <li key={`${it.id}-${it.shade ?? ""}`} className="cart-item">
                    <div className="cart-item__info">
                      <img src={it.img} alt={it.title} className="cart-item__img" />
                      <div className="cart-item__text">
                        <div className="cart-item__title">{it.title}</div>
                        {it.shade && <div className="cart-item__meta">Shade: {it.shade}</div>}
                        <div className="cart-item__price">{formatPrice(it.price)}</div>
                      </div>
                    </div>

                    <div className="cart-item__controls">
                      <div className="cart-qty">
                        <button
                          type="button"
                          className="cart-qty__btn"
                          aria-label="הקטן כמות"
                          onClick={() => {
                            if (typeof onDec === "function") onDec(it.id, it.shade);
                            else handleQtyChange(it.id, Math.max(0, qty - 1), it.shade);
                          }}
                        >
                          −
                        </button>

                        <div className="cart-qty__val">{qty}</div>

                        <button
                          type="button"
                          className="cart-qty__btn"
                          aria-label="הגדל כמות"
                          onClick={() => {
                            if (typeof onInc === "function") onInc(it.id, it.shade);
                            else handleQtyChange(it.id, qty + 1, it.shade);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="cart-footer">
          <div className="cart-row">
            <div className="cart-col">סכום</div>
            <div className="cart-col cart-col--val">{formatPrice(subtotal)}</div>
          </div>

          <label className="cart-terms acct-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>אני מאשר/ת שקראתי את תקנון האתר.</span>
          </label>

          <button
            type="button"
            className="cart-paybtn"
            disabled={isDisabled}
           onClick={async () => {
  if (isDisabled) return;
  persistOrderHistory();

  try {
    localStorage.setItem("free_shipping_threshold", String(threshold));
    localStorage.setItem("cart_is_free_shipping", JSON.stringify(isFreeShipping));
  } catch {}

  // ✅ קודם נוודא שיש עגלה אמיתית
  let cartIdLS = localStorage.getItem("cart_id");
let numericId = Number(cartIdLS);

// אם זה לא מספר תקין – נייצר מהשרת
if (!Number.isFinite(numericId) || numericId <= 0) {
  const cart = await ensureCartOnServer();
  numericId = cart.id;
}


  const url = numericId
    ? `/checkoutpage?cartId=${encodeURIComponent(numericId)}`
    : `/checkoutpage`;

  window.location.assign(url);
  onCheckout?.();
}}

          >
            לתשלום
          </button>
        </footer>
      </aside>
    </>
  );
}
