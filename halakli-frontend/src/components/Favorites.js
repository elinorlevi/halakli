// src/components/Favorites.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import "../csscom/favorites.css";

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:4000";

const getToken = () => localStorage.getItem("auth_token");
const getStoredUserId = () => {
  const v = localStorage.getItem("user_id");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** fetch JSON עם תמיכה ב-extraHeaders (ל-X-User-Id) */
async function jsonFetch(
  path,
  { method = "GET", token, body, extraHeaders } = {}
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders || {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** API מועדפים */
const favoritesApi = {
  list: (extraHeaders) =>
    jsonFetch(`/api/userfav/favorites`, {
      token: getToken(),
      extraHeaders,
    }),
  add: (productId, extraHeaders) =>
    jsonFetch(`/api/userfav/favorites/${productId}`, {
      method: "POST",
      token: getToken(),
      extraHeaders,
    }),
  remove: (productId, extraHeaders) =>
    jsonFetch(`/api/userfav/favorites/${productId}`, {
      method: "DELETE",
      token: getToken(),
      extraHeaders,
    }),
};

/** bulk מוצרים */
async function fetchProductsByIds(ids, token, extraHeaders) {
  if (!ids?.length) return [];
  const qs = encodeURIComponent(ids.join(","));
  const resp = await jsonFetch(`/api/products/bulk?ids=${qs}`, {
    token,
    extraHeaders,
  });
  return Array.isArray(resp?.data) ? resp.data : [];
}

function money(n) {
  return (Number(n) || 0).toFixed(2);
}

// האם כרגע דסקטופ
function isDesktop() {
  if (typeof window === "undefined") return true;
  return window.innerWidth > 768;
}

export default function Favorites() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [userId, setUserId] = useState(getStoredUserId());
  const [unfavvingIds, setUnfavvingIds] = useState(new Set());
  const [visibleCount, setVisibleCount] = useState(6);

  // סיידבר פתוח/סגור (כמו ב-AccountSettings)
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop());

  // אם אין user_id בלוקאל – ננסה להביא מ-/api/users/me (עם ה-token)
  useEffect(() => {
    const t = getToken();
    if (!t && !userId) {
      nav("/account?step=login");
      return;
    }
    if (userId) return;

    (async () => {
      try {
        const me = await jsonFetch(`/api/users/me`, { token: t });
        const uid = me?.id ?? me?.user_id ?? me?.userId ?? me?.data?.id;
        if (!uid) throw new Error("no user id");
        setUserId(uid);
        try {
          localStorage.setItem("user_id", String(uid));
        } catch {}
      } catch {
        nav("/account?step=login");
      }
    })();
  }, [nav, userId]);

  // טען מועדפים אחרי שיש userId
  useEffect(() => {
    const t = getToken();
    if (!userId) return;

    const extraHeaders = { "X-User-Id": String(userId) };

    (async () => {
      try {
        setLoading(true);
        setErr("");

        const favRes = await favoritesApi.list(extraHeaders);
        const favs = Array.isArray(favRes?.favorites) ? favRes.favorites : [];

        const ids = favs.map((f) => Number(f.product_id)).filter(Boolean);
        if (ids.length === 0) {
          setItems([]);
          return;
        }

        const products = await fetchProductsByIds(ids, t, extraHeaders);

        const byId = new Map(products.map((p) => [Number(p.id), p]));
        const merged = ids.map((id) =>
          byId.get(id) || {
            id,
            title: `מוצר #${id}`,
            price: 0,
            image_url: "",
            slug: id,
            _minimal: true,
          }
        );

        setItems(merged);
      } catch (e) {
        if (e?.status === 401) {
          nav("/account?step=login");
          return;
        }
        try {
          const raw = localStorage.getItem("wishlist_items");
          const parsed = raw ? JSON.parse(raw) : [];
          setItems(Array.isArray(parsed) ? parsed : []);
          setErr(
            "לא ניתן לטעון מהשרת. מוצגים פריטי מועדפים מקומיים (אם קיימים)."
          );
        } catch {
          setErr("לא ניתן לטעון מועדפים.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, nav]);

  // בדסקטופ – תמיד לפתוח סיידבר
  useEffect(() => {
    const onResize = () => {
      if (isDesktop()) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // הסרה בפועל
  async function removeFavorite(productId) {
    const prev = items;
    setItems((arr) => arr.filter((x) => String(x.id) !== String(productId)));
    try {
      await favoritesApi.remove(productId, { "X-User-Id": String(userId) });
    } catch {
      setItems(prev);
      setUnfavvingIds((s) => {
        const n = new Set(s);
        n.delete(productId);
        return n;
      });
      alert("שגיאה בהסרת הפריט מהמועדפים");
      throw new Error("unfavorite-failed");
    }
    try {
      localStorage.setItem(
        "wishlist_items",
        JSON.stringify(
          (prev || []).filter((x) => String(x.id) !== String(productId))
        )
      );
    } catch {}
  }

  // לחיצה על הלב
  function onUnfavoriteClick(productId) {
    if (unfavvingIds.has(productId)) return;
    setUnfavvingIds((prev) => new Set(prev).add(productId));
    setTimeout(() => {
      removeFavorite(productId).catch(() => {
        setUnfavvingIds((prev) => {
          const n = new Set(prev);
          n.delete(productId);
          return n;
        });
      });
    }, 350);
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
    nav("/", { replace: true });
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="acct-wrap">
          <p className="acct-sub" dir="rtl">
            טוען מועדפים…
          </p>
        </main>
        <SiteFooter />
      </>
    );
  }

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
            <li aria-current="page">מועדפים</li>
          </ol>
        </nav>

        <h1 className="acct-h1">מועדפים</h1>
        <p className="acct-sub" dir="rtl">
          כאן תמצאי את כל המוצרים שסימנת כמועדפים.
        </p>

        {/* סיידבר + תוכן */}
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
          {/* Sidebar – רק כשפתוח */}
          {sidebarOpen && (
            <>
              <aside
                className="acct-sidebar"
                aria-label="תפריט חשבון"
                style={{ minWidth: 300, maxWidth: 300, paddingInlineStart: 0 }}
              >
                <div className="acct-side-header">
                  <div className="acct-side-title">החשבון שלי</div>

                  {/* חץ סגירה – נראה רק במובייל דרך CSS */}
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

              {/* מפריד אנכי */}
              <div
                aria-hidden="true"
                className="acct-side-sep"
                style={{ alignSelf: "stretch", width: 1, background: "#E6E6E6" }}
              />
            </>
          )}

          {/* חץ פתיחה צף – יופיע רק במובייל כשסגור (CSS) */}
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

          {/* Main */}
          <section className="acct-content">
            {err && <div className="acct-error">{err}</div>}

            {items.length === 0 ? (
              <div className="acct-form" dir="rtl" style={{ marginRight: 210 }}>
                <p className="acct-sub">.אין עדיין פריטים במועדפים</p>
                <button
                  className="acct-btn"
                  type="button"
                  onClick={() => nav("/products")}
                >
                  חזרה לחנות
                </button>
              </div>
            ) : (
              <>
                <div className="fav-grid">
                  {items.slice(0, visibleCount).map((item) => {
                    const imgUrl =
                      (Array.isArray(item.images) && item.images.length > 0
                        ? item.images[0]
                        : null) ??
                      item.image_url ??
                      item.img ??
                      "";

                    return (
                      <article key={item.id} className="fav-card">
                        {/* תמונה + לב */}
                        <div className="fav-media">
                          <img
                            className="fav-thumb"
                            src={imgUrl}
                            alt={
                              item.title ||
                              item.name ||
                              `מוצר #${item.id}`
                            }
                            loading="lazy"
                            decoding="async"
                            srcSet={`${imgUrl}?w=400 1x, ${imgUrl}?w=800 2x`}
                            sizes="(min-width: 1024px) 230px, (min-width: 640px) 33vw, 50vw"
                            style={{ objectFit: "contain" }}
                          />

                          <button
                            type="button"
                            className={`fav-heart ${
                              unfavvingIds.has(item.id) ? "" : "is-active"
                            }`}
                            onClick={() => onUnfavoriteClick(item.id)}
                            aria-label="הסר ממועדפים"
                            title="הסר ממועדפים"
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              {unfavvingIds.has(item.id) ? (
                                <path
                                  d="M16.5 3c-1.74 0-3.41.81-4.5 2.09A6.06 6.06 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 3.0 2.2 5.7 6.55 9.54L12 21.35l3.45-3.31C19.8 14.2 22 11.5 22 8.5A5.5 5.5 0 0 0 16.5 3z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              ) : (
                                <path
                                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                  fill="currentColor"
                                />
                              )}
                            </svg>
                          </button>
                        </div>

                        {/* טקסטים ופעולות */}
                        <div className="fav-body" dir="rtl">
                          <h3 className="fav-title">
                            {item.title || item.name || `מוצר #${item.id}`}
                          </h3>

                          <div className="fav-price">
                            {item.final_price != null &&
                            item.final_price !== item.price ? (
                              <>
                                <span className="old">
                                  ₪{money(item.price)}
                                </span>
                                <span>₪{money(item.final_price)}</span>
                              </>
                            ) : (
                              <span>
                                ₪
                                {money(
                                  item.price ?? item.unit_price ?? 0
                                )}
                              </span>
                            )}
                          </div>

                          <div className="fav-actions">
                            <button
                              className="acct-btn"
                              type="button"
                              onClick={() =>
                                nav(`/product/${item.slug || item.id}`)
                              }
                            >
                              לפריט
                            </button>
                          </div>

                          {item._minimal && (
                            <small className="fav-note">
                              (פרטי מוצר חלקיים — אין API bulk לפרטי מוצרים)
                            </small>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* טען עוד */}
                {visibleCount < items.length && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: 16,
                    }}
                  >
                    <button
                      type="button"
                      className="acct-btn1 btn-ghost-square"
                      onClick={() =>
                        setVisibleCount((c) =>
                          Math.min(items.length, c + 6)
                        )
                      }
                    >
                      ..טען עוד
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <br />
        <br />
        <br />
        <SiteFooter />
      </main>
    </>
  );
}
