// src/components/AccountSettings.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:4000";

const getToken = () => localStorage.getItem("auth_token");

async function jsonFetch(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const addressesApi = {
  list: (type) =>
    jsonFetch(`/api/addresses${type ? `?type=${type}` : ""}`, {
      token: getToken(),
    }),
  get: (id) =>
    jsonFetch(`/api/addresses/${id}`, {
      token: getToken(),
    }),
  create: (payload) =>
    jsonFetch(`/api/addresses`, {
      method: "POST",
      body: payload,
      token: getToken(),
    }),
  update: (id, payload) =>
    jsonFetch(`/api/addresses/${id}`, {
      method: "PATCH",
      body: payload,
      token: getToken(),
    }),
  remove: (id) =>
    jsonFetch(`/api/addresses/${id}`, {
      method: "DELETE",
      token: getToken(),
    }),
};

// פונקציה קטנה: האם כרגע דסקטופ
function isDesktop() {
  if (typeof window === "undefined") return true;
  return window.innerWidth > 768;
}

export default function AccountSettings() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [addressId, setAddressId] = useState(null);

  // סטייט יחיד – האם הסיידבר פתוח
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop());

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    birth_date: "",
    phone: "",
    city: "",
    street: "",
    house_number: "",
    apt: "",
    floor: "",
    zip: "",
    address_notes: "",
  });

  // טעינת פרופיל + כתובת
  useEffect(() => {
    const t = getToken();
    if (!t) {
      nav("/account?step=login");
      return;
    }

    (async () => {
      try {
        const me = await jsonFetch("/api/users/me", { token: t });
        setForm((f) => ({
          ...f,
          first_name: me.first_name || "",
          last_name: me.last_name || "",
          email: me.email || "",
          birth_date: me.birth_date?.slice(0, 10) || "",
          phone: me.phone || "",
        }));

        try {
          const list = await addressesApi.list("SHIPPING");
          const addr = list?.[0];
          if (addr) {
            setAddressId(addr.id);

            const streetOnly = addr.street?.replace(/\s+\d+$/, "") || "";
            const houseNo = addr.street?.match(/(\d+)\s*$/)?.[1] || "";

            setForm((f) => ({
              ...f,
              city: addr.city || "",
              street: streetOnly,
              house_number: houseNo,
              apt: addr.apartment || "",
              floor: addr.floor || "",
              zip: addr.zip || "",
              address_notes: addr.remarks || "",
            }));
          }
        } catch {
          // אין כתובת
        }
      } catch (e) {
        setErr("נכשל בטעינת הפרופיל");
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  // שינוי שדות
  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // שמירה
  async function onSave(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setSaving(true);
    const t = getToken();

    try {
      await jsonFetch("/api/users/me", {
        method: "PATCH",
        token: t,
        body: {
          first_name: form.first_name,
          last_name: form.last_name,
          birth_date: form.birth_date || null,
          phone: form.phone || null,
        },
      });

      const streetCombined = `${form.street || ""} ${
        form.house_number || ""
      }`.trim();
      const payload = {
        type: "SHIPPING",
        city: form.city || "",
        street: streetCombined || "",
        floor: form.floor || null,
        apartment: form.apt || null,
        zip: form.zip || null,
        remarks: form.address_notes || null,
      };

      if (addressId) {
        await addressesApi.update(addressId, payload);
      } else {
        const created = await addressesApi.create(payload);
        if (created?.id) setAddressId(created.id);
      }

      localStorage.setItem(
        "profile_autofill",
        JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          city: form.city,
          street: streetCombined,
          apt: form.apt,
          floor: form.floor,
          zip: form.zip,
          address_notes: form.address_notes,
          email: form.email,
        })
      );

      setMsg("נשמר בהצלחה");
    } catch (e) {
      setErr(e.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  // שינוי גודל מסך – בדסקטופ תמיד לפתוח
  useEffect(() => {
    const onResize = () => {
      if (isDesktop()) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleLogout() {
    localStorage.removeItem("auth_token");
    nav("/", { replace: true });
  }

  if (loading)
    return (
      <main className="acct-wrap">
        <p>טוען…</p>
      </main>
    );

  return (
    <>
      <SiteHeader />

      <main className="acct-wrap">
        {/* פירורי לחם */}
        <nav className="acct-breadcrumb" aria-label="breadcrumb" dir="rtl">
          <ol>
            <li>
              <Link to="/">דף הבית</Link>
            </li>
            <li aria-current="page">הגדרות חשבון</li>
          </ol>
        </nav>

        <h1 className="acct-h1">הגדרות חשבון</h1>
        <p className="acct-sub">
          .עדכני את פרטי הפרופיל והמשלוח שלך. נשמור למילוי אוטומטי בקופה
        </p>

        <div
          className="acct-two-cols"
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "flex-start",
            gap: 24,
          }}
        >
          {/* === Sidebar === */}
          {sidebarOpen && (
            <>
              <aside
                className="acct-sidebar"
                aria-label="תפריט חשבון"
                style={{ minWidth: 300, maxWidth: 300, paddingInlineStart: 0 }}
              >
                <div className="acct-side-header">
                  <div className="acct-side-title">החשבון שלי</div>

                  {/* חץ סגירה – יוצג רק במובייל דרך CSS */}
                  <button
                    type="button"
                    className="acct-side-toggle acct-side-toggle--close"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="סגירת תפריט חשבון"
                  >
                    ‹
                  </button>
                </div>

                <nav className="acct-side-nav" role="menu" dir="rtl">
                  <button
                    type="button"
                    className="usermenu__item"
                    role="menuitem"
                    onClick={() => nav("/account/dashboard")}
                    style={{ width: "100%", textAlign: "right" }}
                  >
                    היסטוריית הזמנות
                  </button>

                  <button
                    type="button"
                    className="usermenu__item"
                    role="menuitem"
                    onClick={() => nav("/favorites")}
                    style={{ width: "100%", textAlign: "right" }}
                  >
                    מועדפים
                  </button>

                  <button
                    type="button"
                    className="usermenu__item"
                    role="menuitem"
                    onClick={() => nav("/account/settings")}
                    style={{ width: "100%", textAlign: "right" }}
                  >
                    הגדרות חשבון
                  </button>

                  <div className="usermenu__sep" />

                  <button
                    type="button"
                    className="usermenu__item usrm--danger"
                    role="menuitem"
                    onClick={handleLogout}
                    style={{ width: "100%", textAlign: "right" }}
                  >
                    התנתק
                  </button>
                </nav>
              </aside>

              <div
                aria-hidden="true"
                className="acct-side-sep"
                style={{
                  alignSelf: "stretch",
                  width: 1,
                  background: "#E6E6E6",
                }}
              />
            </>
          )}

          {/* חץ פתיחה צף – מובייל בלבד (דרך CSS) */}
          {!sidebarOpen && (
            <button
              type="button"
              className="acct-side-toggle acct-side-toggle--floating"
              onClick={() => setSidebarOpen(true)}
              aria-label="פתיחת תפריט חשבון"
            >
              ›
            </button>
          )}

          {/* === Main Content === */}
          <section className="acct-content" style={{ flex: 1, maxWidth: 810 }}>
            <form className="acct-form" onSubmit={onSave}>
              <label className="acct-label">אימייל</label>
              <input
                className="acct-input"
                value={form.email}
                name="email"
                readOnly
              />

              <label className="acct-label">שם פרטי</label>
              <input
                className="acct-input acct-input--rtl"
                value={form.first_name}
                name="first_name"
                onChange={onChange}
                required
              />

              <label className="acct-label">שם משפחה</label>
              <input
                className="acct-input acct-input--rtl"
                value={form.last_name}
                name="last_name"
                onChange={onChange}
                required
              />

              <label className="acct-label">תאריך לידה</label>
              <input
                className="acct-input"
                type="date"
                name="birth_date"
                value={form.birth_date}
                onChange={onChange}
              />

              <label className="acct-label">טלפון</label>
              <input
                className="acct-input"
                name="phone"
                value={form.phone}
                onChange={onChange}
              />

              <hr className="usermenu__sep" />

              <h2 className="acct-mini-title">כתובת למשלוח</h2>

              <label className="acct-label">עיר</label>
              <input
                className="acct-input acct-input--rtl"
                name="city"
                value={form.city}
                onChange={onChange}
              />

              <label className="acct-label">רחוב</label>
              <input
                className="acct-input acct-input--rtl"
                name="street"
                value={form.street}
                onChange={onChange}
                required
              />

              <label className="acct-label">מס' בית</label>
              <input
                className="acct-input"
                name="house_number"
                value={form.house_number}
                onChange={onChange}
                required
              />

              <div className="acct-row-3">
                <div>
                  <label className="acct-label">דירה </label>
                  <input
                    className="acct-input"
                    name="apt"
                    value={form.apt}
                    onChange={onChange}
                  />
                </div>
                <div>
                  <label className="acct-label">קומה </label>
                  <input
                    className="acct-input"
                    name="floor"
                    value={form.floor}
                    onChange={onChange}
                  />
                </div>
                <div>
                  <label className="acct-label">מיקוד</label>
                  <input
                    className="acct-input"
                    name="zip"
                    value={form.zip}
                    onChange={onChange}
                  />
                </div>
              </div>

              <label className="acct-label">הערות למשלוח</label>
              <textarea
                className="acct-input acct-input--rtl"
                name="address_notes"
                value={form.address_notes}
                onChange={onChange}
                rows={3}
              />

              {err && <div className="acct-error">{err}</div>}
              {msg && <div className="acct-success">{msg}</div>}

              <button className="acct-btn" type="submit" disabled={saving}>
                {saving ? "שומר..." : "שמירה"}
              </button>
            </form>
          </section>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}
