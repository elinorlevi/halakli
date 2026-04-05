import React, { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export default function Thanku() {
  const params = new URLSearchParams(useLocation().search);
  const orderId = params.get("orderId");

  // כשעמוד תודה נטען → ודאי שהעגלה ריקה גם בזיכרון וגם ב-ui
  useEffect(() => {
    try {
      localStorage.removeItem("cart_items");
      localStorage.removeItem("cart_subtotal");
      localStorage.removeItem("cart_is_free_shipping");

      localStorage.setItem(
        "cart_snapshot",
        JSON.stringify({
          updated_at: new Date().toISOString(),
          count: 0,
          subtotal: 0,
        })
      );

      // לשדר לכל מי שמאזין
      window.dispatchEvent(
        new CustomEvent("cart:items", { detail: [] })
      );
      window.dispatchEvent(
        new CustomEvent("cart:subtotal", { detail: 0 })
      );
      window.dispatchEvent(
        new CustomEvent("cart:update", {
          detail: { items: [], subtotal: 0 },
        })
      );
    } catch (e) {
      console.warn("clear cart on thankyou failed", e);
    }
  }, []);

  return (
    <>
      <SiteHeader />

      <main className="acct-wrap" dir="rtl">
        <section className="acct-section" style={{ textAlign: "center" }}>
          <h1 className="acct-mini-title">תודה על ההזמנה!</h1>

          <p
            className="acct-sub"
            style={{ marginTop: "8px", lineHeight: 1.5 }}
          >
            ההזמנה התקבלה בהצלחה.
            <br />
            מספר הזמנה:{" "}
            <span style={{ fontWeight: 600 }}>
              {orderId ? `#${orderId}` : "—"}
            </span>
          </p>

          <p
            className="acct-sub"
            style={{ marginTop: "16px", lineHeight: 1.5 }}
          >
            קיבלנו את הפרטים ונשלח עדכון למייל שלך.
          </p>

          <Link
            to="/"
            className="acct-btn"
            style={{
              display: "inline-block",
              marginTop: "24px",
              minWidth: 200,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            חזרה לחנות
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
