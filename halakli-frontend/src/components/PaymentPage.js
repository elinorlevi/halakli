// src/pages/PaymentPage.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { useCart } from "../contexts/CartContext";

export default function PaymentPage() {
  const navigate = useNavigate();
  const { clear } = useCart();

  const [checkoutData, setCheckoutData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      // קודם ננסה את החדש
      const thankuRaw = sessionStorage.getItem("thankyou_order");
      if (thankuRaw) {
        setCheckoutData(JSON.parse(thankuRaw));
        return;
      }
      // אח"כ הישן
      const raw = sessionStorage.getItem("checkout_payload");
      if (raw) {
        setCheckoutData(JSON.parse(raw));
      }
    } catch {
      // לא נקריס
    }
  }, []);

  async function handleFakeCharge() {
    if (submitting) return;
    setSubmitting(true);

    try {
      const grandTotal =
        Number(checkoutData?.paid) ||
        Number(checkoutData?.totals?.grandTotal) ||
        Number(checkoutData?.grandTotal) ||
        0;

      // נשאיר את זה כדי שעמוד תודה ידע מה לשים
      sessionStorage.setItem(
        "thankyou_order",
        JSON.stringify({
          order_id: checkoutData?.order_id || "demo",
          order_number: checkoutData?.order_number || "ORD-DEMO",
          paid: grandTotal,
        })
      );
    } catch {}

    await clear();
    navigate("/thanku");
  }

  return (
    <>
      <SiteHeader />

      <main className="acct-wrap" dir="rtl">
        <section className="acct-section">
          <h1 className="acct-mini-title" style={{ textAlign: "center" }}>
            תשלום מאובטח
          </h1>

          <p
            className="acct-sub"
            style={{
              marginTop: 8,
              textAlign: "center",
              maxWidth: 400,
              marginInline: "auto",
              lineHeight: 1.5,
            }}
          >
            זה תשלום בדמו: לחיצה על "שלם עכשיו" תנקה את העגלה ותעביר לעמוד תודה ✔
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              marginTop: 16,
            }}
          >
            <div
              style={{
                background: "#fafafa",
                border: "1px solid #ccc",
                borderRadius: "6px",
                padding: "16px",
                maxWidth: "320px",
                width: "100%",
              }}
            >
              <div style={{ fontSize: 14, marginBottom: 8 }}>כרטיס אשראי</div>
              <input
                className="acct-input"
                placeholder="0000 0000 0000 0000"
                disabled
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input className="acct-input" placeholder="MM/YY" disabled />
                <input className="acct-input" placeholder="CVV" disabled />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#666",
                  marginTop: "8px",
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                (בגרסה הזו אין סליקה אמיתית, ההזמנה כבר נשמרה במסך הקודם)
              </div>
            </div>

            <button
              className="acct-btn"
              style={{ marginTop: 24, minWidth: 200, textAlign: "center" }}
              disabled={submitting}
              onClick={handleFakeCharge}
            >
              {submitting ? "מעבד תשלום…" : "שלם עכשיו"}
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
