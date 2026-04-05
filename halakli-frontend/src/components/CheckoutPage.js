import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { useCartSubscribe } from "../hooks/useCartBroadcast"; // ✅ מנוי לעגלה
import "../csscom/CheckoutPage.css";
import "../csscom/Shoppingcart.css";

function money(n) {
  return (Number(n) || 0).toFixed(2);
}

// ✅ נרמול פריטים ממקורות שונים (API/LocalStorage/Bus)
function normalizeCartItems(arr = []) {
  return (arr || []).map((it) => ({
    ...it,
    unit_price: Number(it.unit_price ?? it.price ?? 0),
    qty: Number(it.qty) || 1,
    title: it.title ?? it.name ?? "",
    image_url: it.image_url ?? it.img ?? "",
  }));
}

export default function CheckoutPage() {
  const loc = useLocation();
  const { pathname } = loc;

  const CODE_HOME = "home";
  const CODE_PICKUP = "pickup";

  // ✅ שליפה בטוחה של סף משלוח חינם
  const RAW_THR = localStorage.getItem("free_shipping_threshold");
  const PARSED_THR = Number(RAW_THR);
  const FREE_THRESHOLD_RESOLVED =
    Number.isFinite(PARSED_THR) && PARSED_THR > 0 ? PARSED_THR : 699;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const [cart, setCart] = useState(null);
  const [items, setItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);

  // טלפון מפורק
  const [p3, setP3] = useState("");
  const [p7, setP7] = useState("");
  const p3Ref = useRef(null);
  const p7Ref = useRef(null);

  // משלוח / קופון
  const [methods, setMethods] = useState([]);
  const [shippingCode, setShippingCode] = useState(CODE_HOME);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);

  // כולל גם הנחת משלוח אם יש (FREE_SHIPPING)
  const discount = useMemo(() => {
    if (!couponApplied) return 0;
    const base = Number(couponApplied.discount || 0);
    const ship = Number(couponApplied.shipping_discount || 0);
    return base + ship;
  }, [couponApplied]);

  const [form, setForm] = useState({
    email: "",
    newsOptIn: true,
    firstName: "",
    lastName: "",
    country: "IL",
    city: "",
    street: "",
    houseNumber: "",
    apt: "",
    floor: "",
    zip: "",
    phone: "",
    saveForNext: true,
    notes: "",
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ✅ שיחזור מיידי של עגלה מלוקאלסטורג'
  useEffect(() => {
    try {
      const rawItems = localStorage.getItem("cart_items");
      const rawSubtotal = localStorage.getItem("cart_subtotal");
      if (rawItems) {
        const parsed = JSON.parse(rawItems);
        if (Array.isArray(parsed)) setItems(normalizeCartItems(parsed));
      }
      if (rawSubtotal) setSubtotal(Number(rawSubtotal) || 0);
    } catch (e) {
      console.warn("cannot restore cart from localStorage", e);
    }
  }, []);

  useCartSubscribe("items", (incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    try {
      setItems(normalizeCartItems(incoming));
    } catch {
      // במקרה קצה: אם incoming שגוי, לא מוחקים את הקיים
    }
  });

  // === Auth & API base ===
  const API_BASE =
    import.meta?.env?.VITE_API_BASE ||
    process.env.REACT_APP_API_BASE ||
    "";

  const getToken = () => localStorage.getItem("auth_token");

  const [authState, setAuthState] = useState("unknown"); // 'unknown' | 'ok' | 'none'
  const canPersistProfile = authState === "ok";

  async function verifyAuth() {
    const t = getToken();
    if (!t) {
      setAuthState("none");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${t}`,
        },
        credentials: "include",
      });
      setAuthState(res.ok ? "ok" : "none");
    } catch {
      setAuthState("none");
    }
  }

  useEffect(() => {
    verifyAuth();

    const onStorage = (e) => {
      if (e.key === "auth_token") verifyAuth();
    };
    const onFocus = () => verifyAuth();

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useCartSubscribe("subtotal", (incomingSubtotal) => {
    setSubtotal(Number(incomingSubtotal) || 0);
  });

  const threshold = FREE_THRESHOLD_RESOLVED;
  const isPickup = shippingCode === CODE_PICKUP;
  const HOME_PRICE_FALLBACK = 45;

  const homeMethod = useMemo(() => {
    return methods.find((m) => {
      const code = String(m.code || "");
      return code === CODE_HOME || /home|door|house|delivery/i.test(code);
    });
  }, [methods]);

  const resolvedHomePrice = useMemo(() => {
    const p = Number(homeMethod?.price);
    return Number.isFinite(p) && p > 0 ? p : HOME_PRICE_FALLBACK;
  }, [homeMethod]);

  // ✅ חישוב משלוח חינם
  const flagFromNav = loc?.state?.isFreeShipping;
  const flagFromStorage = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("cart_is_free_shipping") || "false"
      );
    } catch {
      return false;
    }
  }, []);

  const hasFree = useMemo(() => {
    return (
      subtotal >= threshold ||
      flagFromNav === true ||
      flagFromStorage === true
    );
  }, [subtotal, threshold, flagFromNav, flagFromStorage]);

  const shippingPriceEffective = useMemo(() => {
    if (shippingCode === CODE_PICKUP) return 0;
    if (shippingCode === CODE_HOME) return hasFree ? 0 : resolvedHomePrice;
    return 0;
  }, [shippingCode, hasFree, resolvedHomePrice]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discount + shippingPriceEffective);
  }, [subtotal, discount, shippingPriceEffective]);

  // ✅ טלפון מחולק
  useEffect(() => {
    const phone = p3 && p7 ? `${p3}-${p7}` : p3 || p7 || "";
    setForm((f) => (f.phone === phone ? f : { ...f, phone }));
  }, [p3, p7]);

  const onP3Change = (e) => {
    const digits = e.target.value.replace(/\D+/g, "").slice(0, 3);
    setP3(digits);
    if (digits.length === 3) setTimeout(() => p7Ref.current?.focus(), 0);
  };
  const onP7Change = (e) =>
    setP7(e.target.value.replace(/\D+/g, "").slice(0, 7));
  const onP3Paste = (e) => {
    const text = (e.clipboardData?.getData("text") || "").replace(
      /\D+/g,
      ""
    );
    if (!text) return;
    if (text.length > 3) {
      e.preventDefault();
      setP3(text.slice(0, 3));
      setP7(text.slice(3, 10));
      setTimeout(() => p7Ref.current?.focus(), 0);
    }
  };
  const onP7KeyDown = (e) => {
    if (e.key === "Backspace" && e.currentTarget.value.length === 0) {
      e.preventDefault();
      p3Ref.current?.focus();
    }
  };

  // ✅ טען עגלה / שיטות משלוח מהשרת
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const cartRes = await fetch("/api/carts/get-or-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const cartJson = await cartRes.json();
        setCart(cartJson);

        const itRes = await fetch(`/api/carts/${cartJson.id}/items`);
        const itJson = await itRes.json();
        if (Array.isArray(itJson.items) && itJson.items.length > 0) {
          setItems(normalizeCartItems(itJson.items));
        }

        const smRes = await fetch(
          `/api/checkout/shipping-methods?country=${form.country || "IL"}`
        );
        const smJson = await smRes.json();
        setMethods(smJson.methods || []);

        setErr("");
      } catch (e) {
        console.error(e);
        setErr("לא ניתן לטעון את עמוד הקופה. נסי לרענן.");
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ שמירת ברירת מחדל לשיטת משלוח
  useEffect(() => {
    if (hasFree && shippingCode !== CODE_HOME) {
      setShippingCode(CODE_HOME);
    }
  }, [hasFree, shippingCode]);

  // ==== APPLY COUPON – גרסה יחידה ונכונה ====
  async function handleApplyCoupon(e) {
  e.preventDefault();
  if (!coupon) return;

  try {
    const payload = {
      code: coupon.trim().toUpperCase(),
      subtotal,
      shipping: shippingPriceEffective,
      items: items.map((it) => ({
        product_id: it.product_id || it.id,
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price ?? it.price ?? 0),
        // אם כבר קיים לך category_id בפריטים – נהדר; אם לא, זה יהיה null
        category_id: it.category_id ?? it.categoryId ?? null,
      })),
    };

    const res = await fetch("/api/coupons/coupons/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await res.json();

    if (!res.ok || j.error) {
      setCouponApplied(null);
      alert(j.error || "קופון לא תקין");
      return;
    }

    setCouponApplied(j);
  } catch (e) {
    console.error(e);
    alert("שגיאה ביישום קופון");
  }
}


  async function handlePayNow(e) {
    e?.preventDefault?.();

    if (!items || items.length === 0) {
      alert("העגלה ריקה.");
      return;
    }

    if (!form.firstName && !form.lastName) {
      alert("נא למלא שם");
      return;
    }
    if (!form.email) {
      alert("נא למלא אימייל");
      return;
    }

    const isHome = shippingCode === CODE_HOME;

    const shippingText = isHome
      ? [
          [
            (form.city || "").trim(),
            (form.street || "").trim() +
              (form.houseNumber ? " " + form.houseNumber : ""),
          ]
            .filter(Boolean)
            .join(", "),
          [
            form.floor ? `קומה ${form.floor}` : "",
            form.apt ? `דירה ${form.apt}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        ]
          .filter(Boolean)
          .join(" | ")
      : "איסוף עצמי – קרית עקרון, רבי מאיר בעל הנס 36";

    const payload = {
      customer: {
        name: [form.firstName, form.lastName].filter(Boolean).join(" "),
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || (p3 && p7 ? `${p3}-${p7}` : ""),
      },
      shipping: isHome
        ? {
            country: form.country || "IL",
            city: form.city || "",
            street: form.street || "",
            houseNumber: form.houseNumber || "",
            apartment: form.apt || "",
            floor: form.floor || "",
            zip: form.zip || "",
            notes: form.notes || "",
          }
        : {},
      shipping_address_text: shippingText,
      billing_address_text: shippingText,
      customer_notes: (form.notes || "").trim() || null,
      shippingMethod: isHome ? "DOOR" : "PICKUP",
      couponCode: couponApplied?.ok ? couponApplied.code : coupon || null,
      totals: {
        subtotal,
        discount,
        shipping: shippingPriceEffective,
        grandTotal,
      },
      items: items.map((it) => ({
        product_id: it.product_id || it.id,
        title: it.title,
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price ?? it.price ?? 0),
      })),
    };

    setSubmitting(true);
    try {
      const resp = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        console.error("checkout/start failed", data);
        alert(data.error || "שגיאה ביצירת ההזמנה");
        setSubmitting(false);
        return;
      }

      try {
        await fetch("/api/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "SHIPPING",
            city: form.city,
            street: `${form.street} ${form.houseNumber}`.trim(),
            floor: form.floor || null,
            apartment: form.apt || null,
            zip: form.zip || null,
            remarks: form.notes || null,
            order_id: data.orderId,
          }),
        });
      } catch (e) {
        console.warn("cannot save address:", e);
      }

      sessionStorage.setItem(
        "thankyou_order",
        JSON.stringify({
          order_id: data.orderId,
          order_number: data.orderNumber,
          paid: grandTotal,
        })
      );

      window.location.href = "/pay";
    } catch (err) {
      console.error(err);
      alert("שגיאה ביצירת ההזמנה");
      setSubmitting(false);
    }
  }

  // === Helpers for checkout autofill ===

  function mergeIfEmpty(current, incoming) {
    const next = { ...current };
    for (const [k, v] of Object.entries(incoming || {})) {
      if (next[k] == null || next[k] === "") next[k] = v ?? "";
    }
    return next;
  }

  function splitStreetAndHouse(streetCombined = "") {
    const m = String(streetCombined)
      .trim()
      .match(/^(.*?)[\s,.-]*(\d+)\s*$/);
    return m
      ? { street: m[1].trim(), houseNumber: m[2].trim() }
      : { street: streetCombined.trim(), houseNumber: "" };
  }

  function normalizePhoneIL(raw = "") {
    const digits = String(raw).replace(/\D+/g, "");
    let d = digits.replace(/^0*(972)?0?/, "");
    if (d.length > 10) d = d.slice(-10);
    if (d.length === 9) d = "0" + d;
    if (d.length !== 10) return { p3: "", p7: "", full: "" };
    return {
      p3: d.slice(0, 3),
      p7: d.slice(3),
      full: `${d.slice(0, 3)}-${d.slice(3)}`,
    };
  }

  // ✅ אוטופיל מה-AccountSettings (localStorage) — רק כשמחוברת
  useEffect(() => {
    if (authState !== "ok") return;

    try {
      const raw = localStorage.getItem("profile_autofill");
      if (raw) {
        const p = JSON.parse(raw) || {};
        const streetSplit = splitStreetAndHouse(p.street || "");
        const phoneNorm = normalizePhoneIL(p.phone || "");

        setForm((f) =>
          mergeIfEmpty(f, {
            email: p.email || "",
            firstName: p.first_name || "",
            lastName: p.last_name || "",
            city: p.city || "",
            street: streetSplit.street || "",
            houseNumber: streetSplit.houseNumber || "",
            apt: p.apt || "",
            floor: p.floor || "",
            zip: p.zip || "",
            notes: p.address_notes || "",
          })
        );

        if (phoneNorm.p3 && phoneNorm.p7) {
          setP3((prev) => prev || phoneNorm.p3);
          setP7((prev) => prev || phoneNorm.p7);
        }
      }
    } catch {}

    const onStorage = (e) => {
      if (e.key === "profile_autofill" && e.newValue) {
        try {
          const p = JSON.parse(e.newValue);
          const streetSplit = splitStreetAndHouse(p.street || "");
          const phoneNorm = normalizePhoneIL(p.phone || "");

          setForm((f) =>
            mergeIfEmpty(f, {
              email: p.email || "",
              firstName: p.first_name || "",
              lastName: p.last_name || "",
              city: p.city || "",
              street: streetSplit.street || "",
              houseNumber: streetSplit.houseNumber || "",
              apt: p.apt || "",
              floor: p.floor || "",
              zip: p.zip || "",
              notes: p.address_notes || "",
            })
          );
          if (phoneNorm.p3 && phoneNorm.p7) {
            setP3((v) => v || phoneNorm.p3);
            setP7((v) => v || phoneNorm.p7);
          }
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ אוטופיל מהשרת (משתמש + כתובת) — רק כשהתחברות מאומתת
  useEffect(() => {
    if (authState !== "ok") return;

    (async () => {
      try {
        const t = getToken();

        const meRes = await fetch(`${API_BASE}/api/users/me`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          setForm((f) =>
            mergeIfEmpty(f, {
              email: me.email || "",
              firstName: me.first_name || "",
              lastName: me.last_name || "",
            })
          );
          const phoneNorm = normalizePhoneIL(me.phone || "");
          if (phoneNorm.p3 && phoneNorm.p7) {
            setP3((v) => v || phoneNorm.p3);
            setP7((v) => v || phoneNorm.p7);
          }
        }

        const addrRes = await fetch(`${API_BASE}/api/addresses?type=SHIPPING`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
        });
        if (addrRes.ok) {
          const list = await addrRes.json();
          const addr = Array.isArray(list) ? list[0] : list?.[0];
          if (addr) {
            const streetSplit = splitStreetAndHouse(addr.street || "");
            setForm((f) =>
              mergeIfEmpty(f, {
                city: addr.city || "",
                street: streetSplit.street || "",
                houseNumber: streetSplit.houseNumber || "",
                apt: addr.apartment || "",
                floor: addr.floor || "",
                zip: addr.zip || "",
                notes: addr.remarks || "",
              })
            );
          }
        }
      } catch {
        /* UX בלבד — ממשיכים בשקט */
      }
    })();
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authState === "none") {
      try {
        localStorage.removeItem("profile_autofill");
      } catch {}
    }
  }, [authState]);

  if (err) {
    return (
      <>
        <SiteHeader />
        <main className="acct-wrap">
          <section className="acct-section" dir="rtl">
            <div className="acct-error">{err}</div>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader variant="account" />

      <main className="acct-wrap">
        <section className="acct-section" dir="rtl">
          {/* פירורי לחם */}
          <nav className="acct-breadcrumb" aria-label="breadcrumb">
            <ol>
              <li>
                <Link to="/">דף הבית</Link>
              </li>
              <li>
                <Link
                  to={pathname}
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent("cart:open"));
                  }}
                >
                  עגלה
                </Link>
              </li>
              <li aria-current="page">קופה</li>
            </ol>
          </nav>

          {/* Shipping method */}
          <h2 className="acct-mini-title">שיטת משלוח</h2>
          <div className="acct-form">
            {methods.length === 0 && (
              <p className="acct-sub">טוען שיטות משלוח…</p>
            )}

            {(() => {
              const PickupLi = (
                <li
                  className={`ship-item ${
                    shippingCode === CODE_PICKUP ? "is-active" : ""
                  }`}
                >
                  <label className="ship-radio">
                    <input
                      type="radio"
                      name="ship"
                      checked={shippingCode === CODE_PICKUP}
                      onChange={() => setShippingCode(CODE_PICKUP)}
                    />
                    <span className="ship-title">
                      איסוף עצמי{"\u00A0"}
                      <span
                        className="ship-sub"
                        style={{ color: "#666", fontSize: 13 }}
                      >
                        קרית עקרון, רבי מאיר בעל הנס 36
                      </span>
                    </span>
                    <span className="ship-price">
                      <span className="_free">חינם</span>
                    </span>
                  </label>
                </li>
              );

              if (hasFree) {
                return (
                  <>
                    <ul
                      className="ship-list"
                      role="radiogroup"
                      aria-label="בחירת משלוח"
                    >
                      <li
                        className={`ship-item ${
                          shippingCode === CODE_HOME ? "is-active" : ""
                        }`}
                      >
                        <label className="ship-radio">
                          <input
                            type="radio"
                            name="ship"
                            checked={shippingCode === CODE_HOME}
                            onChange={() => setShippingCode(CODE_HOME)}
                          />
                          <span className="ship-title">
                            משלוח עד הבית תוך 4–6 ימי עסקים
                          </span>
                          <span className="ship-price">
                            <span className="_free">חינם</span>
                          </span>
                        </label>
                      </li>

                      {PickupLi}
                    </ul>

                    <p className="ship-note">
                      משלוח חינם הופעל — בחרי משלוח עד הבית או איסוף עצמי
                    </p>
                  </>
                );
              }

              return (
                <ul
                  className="ship-list"
                  role="radiogroup"
                  aria-label="בחירת משלוח"
                >
                  <li
                    className={`ship-item ${
                      shippingCode === CODE_HOME ? "is-active" : ""
                    }`}
                  >
                    <label className="ship-radio">
                      <input
                        type="radio"
                        name="ship"
                        checked={shippingCode === CODE_HOME}
                        onChange={() => setShippingCode(CODE_HOME)}
                      />
                      <span className="ship-title">
                        משלוח עד הבית תוך 4–6 ימי עסקים
                      </span>
                      <span className="ship-price">
                        {`₪${money(resolvedHomePrice)}`}
                      </span>
                    </label>
                  </li>

                  {PickupLi}
                </ul>
              );
            })()}
          </div>

          <div className="co-grid">
            {/* LEFT: forms */}
            <div className="co-forms">
              {/* Contact */}
              <h2 className="acct-mini-title">פרטי התקשרות</h2>
              <div className="acct-form">
                <label className="acct-label">Email*</label>
                <input
                  className="acct-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="name@example.com"
                />
                <label className="acct-check"></label>
              </div>

              {/* Delivery */}
              <h2 className="acct-mini-title">משלוח</h2>
              <div className="acct-form">
                <div className="co-row" dir="rtl">
                  <div className="co-col">
                    <label className="acct-label">שם פרטי*</label>
                    <input
                      className="acct-input"
                      value={form.firstName}
                      onChange={(e) => update("firstName", e.target.value)}
                    />
                  </div>
                  <div className="co-col">
                    <label className="acct-label">שם משפחה*</label>
                    <input
                      className="acct-input"
                      value={form.lastName}
                      onChange={(e) => update("lastName", e.target.value)}
                    />
                  </div>
                </div>

                <div className="co-row">
                  <div className="co-col">{/* ריק במכוון */}</div>
                  <div className="co-col" dir="rtl">
                    <label className="acct-label">עיר*</label>
                    <input
                      className="acct-input"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                      required={!isPickup}
                      disabled={isPickup}
                      aria-required={!isPickup}
                      aria-disabled={isPickup}
                    />
                  </div>
                </div>

                <label className="acct-label" dir="rtl">
                  רחוב*
                </label>
                <input
                  className="acct-input acct-input--street"
                  value={form.street}
                  onChange={(e) => update("street", e.target.value)}
                  dir="rtl"
                  required={!isPickup}
                  disabled={isPickup}
                  aria-required={!isPickup}
                  aria-disabled={isPickup}
                />

                <div className="co-row co-inline">
                  <div className="co-col co-col--sm">
                    <label className="acct-label">מס' בית*</label>
                    <input
                      className="acct-input acct-input--sm"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.houseNumber}
                      onChange={(e) =>
                        update(
                          "houseNumber",
                          e.target.value.replace(/\D/g, "")
                        )
                      }
                      onInput={(e) =>
                        (e.target.value = e.target.value.replace(/\D/g, ""))
                      }
                      maxLength={4}
                      aria-label="מספר בית"
                      required={!isPickup}
                      disabled={isPickup}
                      aria-required={!isPickup}
                      aria-disabled={isPickup}
                    />
                  </div>

                  <div className="co-col co-col--sm">
                    <label className="acct-label">דירה (אופציונלי)</label>
                    <input
                      className="acct-input acct-input--sm"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.apt}
                      onChange={(e) =>
                        update("apt", e.target.value.replace(/\D/g, ""))
                      }
                      onInput={(e) =>
                        (e.target.value = e.target.value.replace(/\D/g, ""))
                      }
                      maxLength={3}
                      aria-label="מספר דירה"
                    />
                  </div>

                  <div className="co-col co-col--sm">
                    <label className="acct-label">קומה (אופציונלי)</label>
                    <input
                      className="acct-input acct-input--sm"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.floor || ""}
                      onChange={(e) =>
                        update("floor", e.target.value.replace(/\D/g, ""))
                      }
                      onInput={(e) =>
                        (e.target.value = e.target.value.replace(/\D/g, ""))
                      }
                      maxLength={2}
                      aria-label="קומה"
                    />
                  </div>
                </div>

                <div className="co-row">
                  <div className="co-col">
                    <label className="acct-label label-right">מיקוד</label>
                    <input
                      className="acct-input ltr-input"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.zip}
                      onChange={(e) =>
                        update("zip", e.target.value.replace(/\D/g, ""))
                      }
                      onInput={(e) =>
                        (e.target.value = e.target.value.replace(/\D/g, ""))
                      }
                      maxLength={7}
                      aria-label="מיקוד"
                    />
                  </div>

                  <label className="acct-label label-right">טלפון*</label>
                  <div className="acct-phone">
                    <input
                      ref={p3Ref}
                      type="tel"
                      className="acct-input acct-input--digits"
                      placeholder="XXX"
                      value={p3}
                      onChange={onP3Change}
                      onPaste={onP3Paste}
                      inputMode="numeric"
                      maxLength={3}
                      pattern="^[0-9]{3}$"
                      aria-label="קידומת"
                      required
                    />
                    <span className="acct-phone-sep">-</span>
                    <input
                      ref={p7Ref}
                      type="tel"
                      className="acct-input acct-input--digits"
                      placeholder="XXXXXXX"
                      value={p7}
                      onChange={onP7Change}
                      onKeyDown={onP7KeyDown}
                      inputMode="numeric"
                      maxLength={7}
                      pattern="^[0-9]{7}$"
                      aria-label="מספר"
                      style={{ width: "295px" }}
                      required
                    />
                  </div>
                </div>

                <label className="acct-label">
                  הערות למשלוח (אופציונלי)
                </label>
                <textarea
                  className="acct-input acct-input--notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  dir="rtl"
                  style={{ textAlign: "right" }}
                />
              </div>

              {/* Payment box */}
              <h2 className="acct-mini-title">תשלום</h2>
              <div className="acct-form">
                <p className="acct-sub">
                  לאחר לחיצה על <b>לתשלום</b> תועברי למסך התשלום המאובטח של
                  חברת הסליקה, בסיום תחזרי לאתר עם אישור הזמנה
                </p>
              </div>
            </div>

            {/* RIGHT: summary */}
            <aside className="co-summary" aria-label="סיכום הזמנה">
              <div className="acct-form">
                <h3
                  className="acct-mini-title"
                  style={{ marginBottom: 12 }}
                >
                  הזמנה
                </h3>
                <div
                  className={`order-list ${
                    items.length > 3 ? "is-scroll" : ""
                  }`}
                >
                  <ul className="cart-list">
                    {items.map((it) => {
                      const qty = Number(it.qty) || 1;
                      const price = Number(
                        it.unit_price ?? it.price ?? 0
                      );
                      return (
                        <li
                          key={`${it.id}-${it.shade ?? ""}`}
                          className="cart-item"
                        >
                          <div className="cart-item__info">
                            <img
                              src={it.image_url}
                              alt={it.title}
                              className="cart-item__img"
                              loading="lazy"
                            />
                            <div className="cart-item__text">
                              <div className="cart-item__title">
                                {it.title}
                              </div>
                              {it.shade && (
                                <div className="cart-item__meta">
                                  גוון: {it.shade}
                                </div>
                              )}
                              <div className="cart-item__price">
                                ₪{price.toFixed(2)} × {qty}
                              </div>
                            </div>
                          </div>

                          <div className="cart-item__controls">
                            <div className="cart-item__total">
                              ₪{(price * qty).toFixed(2)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* קופון */}
                <form
                  onSubmit={handleApplyCoupon}
                  style={{
                    display: "-webkit-inline-flex",
                    gap: 8,
                    alignItems: "baseline",
                    marginTop: 16,
                  }}
                >
                  <input
                    className="acct-input"
                    placeholder="קוד קופון"
                    value={coupon}
                    onChange={(e) =>
                      setCoupon(e.target.value.toUpperCase())
                    }
                  />

                  <button
                    type="submit"
                    className="acct-btn"
                    style={{ width: "100%", height: "52%" }}
                  >
                    החל
                  </button>
                </form>

                {couponApplied?.ok && (
                  <div className="acct-sub">
                    קופון הופעל: {couponApplied.code} (−₪
                    {money(discount)})
                  </div>
                )}

                {/* סכומים כוללים */}
                <div
                  className="co-lines"
                  style={{ display: "grid", gap: 6, marginTop: 12 }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>סכום ביניים</span>
                    <b>₪{money(subtotal)}</b>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>הנחות</span>
                    <b>−₪{money(discount)}</b>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>משלוח</span>
                    <b>
                      {shippingPriceEffective === 0
                        ? "חינם"
                        : `₪${money(shippingPriceEffective)}`}
                    </b>
                  </div>
                </div>

                <div
                  className="co-total"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 10,
                    fontWeight: 700,
                  }}
                >
                  <span>סה״כ לתשלום</span>
                  <b>₪{money(grandTotal)}</b>
                </div>

                <button
                  className="acct-btn"
                  style={{ marginTop: 10 }}
                  disabled={submitting || items.length === 0}
                  onClick={handlePayNow}
                >
                  {submitting ? "שולח לסליקה…" : "לתשלום"}
                </button>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
