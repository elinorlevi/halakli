// src/components/ProductPage.js
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import ShoppingCart from "./Shoppingcart";
import { useCart } from "../contexts/CartContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping, faPhone, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import "../csscom/Account.css";

/* ================= Favorites helpers (מודול-לבל) ================= */
const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "";

const getToken = () => localStorage.getItem("auth_token");
const getStoredUserId = () => {
  const v = localStorage.getItem("user_id");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function jsonFetch(path, { method = "GET", token, body, extraHeaders } = {}) {
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
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const favoritesApi = {
  list: (extraHeaders) =>
    jsonFetch(`/api/userfav/favorites`, { token: getToken(), extraHeaders }),
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

// לב קלאסי – חלול/מלא לפי currentColor
const HeartIcon = ({ filled, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {filled ? (
      // מלא
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="currentColor"
      />
    ) : (
      // חלול דק ועדין
      <path
        d="M16.5 3c-1.74 0-3.41.81-4.5 2.09A6.06 6.06 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 3 2.2 5.7 6.55 9.54L12 21.35l3.45-3.31C19.8 14.2 22 11.5 22 8.5A5.5 5.5 0 0 0 16.5 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);


// ================= Component =================
export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // מהקונטקסט של העגלה
  const { items, add, remove, setQty: setQtyCtx } = useCart();

  // Drawer לעגלה
  const [cartOpen, setCartOpen] = useState(false);

  // --- סלאגים ---
  const HAIR_SLUG =
    (import.meta?.env?.VITE_CAT_HAIR_SLUG) ||
    process.env.REACT_APP_CAT_HAIR_SLUG ||
    "hair-products";

  const SMOOTHIES_SLUG =
    (import.meta?.env?.VITE_CAT_SMOOTHING_SLUG) ||
    process.env.REACT_APP_CAT_SMOOTHING_SLUG ||
    "home-smoothing";

  const HOME_KITS_SLUG =
    (import.meta?.env?.VITE_CAT_HOME_KITS_SLUG) ||
    process.env.REACT_APP_CAT_HOME_KITS_SLUG ||
    "home-kits";

  const RECO_MAP = useMemo(() => ({
    [HAIR_SLUG]:      [SMOOTHIES_SLUG],
    [SMOOTHIES_SLUG]: [HOME_KITS_SLUG],
    [HOME_KITS_SLUG]: [HAIR_SLUG],
    __default:        [HOME_KITS_SLUG],
  }), [HAIR_SLUG, SMOOTHIES_SLUG, HOME_KITS_SLUG]);

  // ===== מוצר וגלריה =====
  const [item, setItem]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [active, setActive]   = useState(0);

  // גלריה ממוזערות
  const VISIBLE_THUMBS = 4;
  const [thumbStart, setThumbStart] = useState(0);

  // זום
  const [zoomOn, setZoomOn] = useState(false);
  const [zoom, setZoom]     = useState(2);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  // טרנזישן תמונות
  const [prevSrc, setPrevSrc] = useState(null);
  const [swapDir, setSwapDir] = useState("up");
  const [transitionKey, setTransitionKey] = useState(0);

  // אקורדיון הוראות שימוש
  const [usageOpen, setUsageOpen] = useState(false);
  const panelRef = useRef(null);
  const bodyRef  = useRef(null);

  const thumbRefs = useRef([]);

  // כמות לעגלה (סטייט מקומי למוצר הנוכחי)
  const [qty, setQtyLocal] = useState(1);

  // ==== בועה דביקה בתוך עמודת המידע ====
  const helpRef     = useRef(null);
  const infoRef     = useRef(null);
  const infoBodyRef = useRef(null);
  const stopRef     = useRef(null);

  // עוזרים
  const getAbsTop  = (el) => (el?.getBoundingClientRect().top  || 0) + window.scrollY;
  const getAbsLeft = (el) => (el?.getBoundingClientRect().left || 0) + window.scrollX;

  // === Favorites: משתמש + מצב אהוב (לפני כל return) ===
  const [userId, setUserId] = useState(getStoredUserId());
  const [liked, setLiked] = useState(false);
  const isAuthed = Boolean(getToken() && userId);

  // טעינת מוצר
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error("המוצר לא נמצא");
        const json = await res.json();

        setItem(json.data);
        setActive(0);
        setThumbStart(0);
        setUsageOpen(false);
        setPrevSrc(null);
        setSwapDir("up");
        setTransitionKey(0);
        setQtyLocal(1); // ← לא לקונטקסט, רק הכמות לטופס בדף
      } catch (e) {
        setErr(e.message || "שגיאה בטעינת המוצר");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // אם אין userId אבל יש טוקן – ננסה להביא /me פעם אחת
  useEffect(() => {
    if (userId) return;
    const t = getToken();
    if (!t) return;
    (async () => {
      try {
        const me = await jsonFetch(`/api/users/me`, { token: t });
        const uid = me?.id ?? me?.user_id ?? me?.userId ?? me?.data?.id;
        if (uid) {
          setUserId(uid);
          try { localStorage.setItem("user_id", String(uid)); } catch {}
        }
      } catch {}
    })();
  }, [userId]);

  // לאחר טעינת מוצר – בדיקה אם מסומן במועדפים
  useEffect(() => {
    if (!userId || !item?.id) return;
    const extraHeaders = { "X-User-Id": String(userId) };
    (async () => {
      try {
        const favRes = await favoritesApi.list(extraHeaders);
        const favs = Array.isArray(favRes?.favorites) ? favRes.favorites : [];
        const setIds = new Set(favs.map(f => Number(f.product_id)));
        setLiked(setIds.has(Number(item.id)));
      } catch {
        // מתעלמים
      }
    })();
  }, [userId, item?.id]);

  async function toggleFavoriteSingle() {
    if (!item?.id) return;

    if (!isAuthed) {
      alert("כדי לשמור למועדפים צריך להתחבר");
      return;
    }

    const extraHeaders = { "X-User-Id": String(userId) };
    const was = liked;

    // עדכון אופטימי
    setLiked(!was);

    try {
      if (was) {
        await favoritesApi.remove(item.id, extraHeaders);
      } else {
        await favoritesApi.add(item.id, extraHeaders);
      }
    } catch {
      // החזרה אחורה במקרה כשל
      setLiked(was);
      alert("לא ניתן לעדכן מועדפים כרגע");
    }
  }

  // פורמט מחיר
  const format2 = (v) =>
    new Intl.NumberFormat("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(Number(v) || 0);

  // תמונות
  const images = (Array.isArray(item?.images) && item.images.length)
    ? item.images
    : [item?.image_url, item?.hover_image_url].filter(Boolean);

  const VISIBLE_THUMBS2 = VISIBLE_THUMBS; // לשמירת המשמעות
  const lastStart = Math.max(0, images.length - VISIBLE_THUMBS2);
  const start = Math.min(thumbStart, lastStart);
  const visibleThumbs = images.slice(start, start + VISIBLE_THUMBS2);

  const mainSrc =
    images?.[active] ?? (item ? `https://picsum.photos/seed/prod${item?.id}/800/800` : "");

  function ensureVisible(index) {
    setThumbStart(prev => {
      const curr = Math.min(prev, lastStart);
      if (index < curr) return index;
      if (index > curr + VISIBLE_THUMBS2 - 1) return index - (VISIBLE_THUMBS2 - 1);
      return prev;
    });
  }

  const resolveDir = (nextIndex, prevIndex = active) => {
    if (nextIndex === prevIndex) return "up";
    return nextIndex > prevIndex ? "up" : "down";
  };

  function selectImage(i, dir) {
    const d = dir ?? resolveDir(i, active);
    setSwapDir(d);
    setPrevSrc(images[active] ?? null);

    setActive(i);
    ensureVisible(i);
    setZoomOn(false);
    setZoom(2);
    setOrigin({ x: 50, y: 50 });

    requestAnimationFrame(() => {
      thumbRefs.current[i]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });
  }

  function goPrev() {
    if (!images.length) return;
    const i = (active - 1 + images.length) % images.length;
    selectImage(i, "down");
  }
  function goNext() {
    if (!images.length) return;
    const i = (active + 1) % images.length;
    selectImage(i, "up");
  }

  // זום
  function handleMouseMove(e) {
    if (!zoomOn) return;
    const img = e.currentTarget.querySelector("img");
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    setOrigin({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }
  function handleWheel(e) {
    if (!zoomOn) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom(z => Math.max(1.2, Math.min(5, +(z + delta).toFixed(2))));
  }
  function toggleZoom() {
    if (!zoomOn) { setZoom(2); setOrigin({ x: 50, y: 50 }); setZoomOn(true); }
    else { setZoomOn(false); }
  }

  // הנדלרים של העגלה (ל־SiteHeader)
  const handleQtyChange = (id, nextQty, shade = null) => {
    setQtyCtx(id, shade, Number(nextQty) || 0);
  };
  const handleRemove = (id, shade = null) => {
    remove(id, shade);
  };

  // קיצורי מקלדת
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowLeft")  { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowDown" || e.key === "ArrowRight"){ e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, images.length]);

  // אקורדיון שימוש
  useEffect(() => {
    const panel = panelRef.current;
    const body  = bodyRef.current;
    if (!panel || !body) return;

    const DUR = 350;

    const onOpen = () => {
      const h = body.scrollHeight;
      panel.style.overflow   = "hidden";
      panel.style.transition = "none";
      panel.style.maxHeight  = "0px";
      panel.style.padding    = "0px";
      requestAnimationFrame(() => {
        panel.style.transition = `max-height ${DUR}ms ease, padding 200ms ease`;
        panel.style.maxHeight  = `${h}px`;
        panel.style.padding    = "8px 0 16px 0";
      });
    };

    const onClose = () => {
      const h = body.scrollHeight;
      panel.style.overflow   = "hidden";
      panel.style.transition = "none";
      panel.style.maxHeight  = `${h}px`;
      panel.style.padding    = "8px 0 16px 0";
      requestAnimationFrame(() => {
        panel.style.transition = `max-height ${DUR}ms ease, padding 200ms ease`;
        panel.style.maxHeight  = "0px";
        panel.style.padding    = "0px";
      });
    };

    if (usageOpen) {
      onOpen();
      const ro = new ResizeObserver(() => {
        panel.style.maxHeight = `${body.scrollHeight}px`;
      });
      ro.observe(body);
      const fontReady = document.fonts && document.fonts.ready;
      if (fontReady?.then) fontReady.then(() => {
        panel.style.maxHeight = `${body.scrollHeight}px`;
      });
      return () => ro.disconnect();
    } else {
      onClose();
    }
  }, [usageOpen]);

  // הוספה לעגלה – עם בדיקת מלאי
  async function handleAddToCart() {
    if (!item?.id) return;

    const stockQty = Number(item.stock_qty ?? 0);
    if (stockQty <= 0) {
      alert("המוצר אזל מהמלאי ולא ניתן להוסיפו לעגלה כרגע.");
      return;
    }

    const qtyToAdd = Number(qty) || 1;
    const unitPrice = item.final_price ?? item.price ?? 0;

    // 1) קודם UI – שהמשתמש יראה מיד
    add({
      id: item.id,
      title: item.name || item.title || "ללא שם",
      price: Number(unitPrice) || 0,
      qty: qtyToAdd,
      img: item.image_url || item.image || "/placeholder.png",
      shade: item.shade || item.variant || null,
    });
    setCartOpen(true);

    // 2) עכשיו נוודא שיש עגלה אמיתית בשרת
    try {
      // ננסה לקרוא cart_id מהלוקאל
      let cartId = localStorage.getItem("cart_id");
      let numericCartId = cartId ? Number(cartId) : null;

      // אם מה שיש בלוקאל לא מספר (למשל cart_123...), נבקש מהשרת
      if (!numericCartId) {
        const resCart = await fetch("/api/carts/get-or-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const cartJson = await resCart.json();
        numericCartId = cartJson.id;
        // נשמור מספר אמיתי
        localStorage.setItem("cart_id", String(numericCartId));
      }

      // 3) עכשיו להוסיף את הפריט הזה גם ל־DB
      await fetch("/api/cartitem/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart_id: numericCartId,
          product_id: item.id,
          qty: qtyToAdd,
          unit_price: Number(unitPrice) || 0,
        }),
      });
    } catch (e) {
      console.warn("cannot sync product to server cart", e);
      // לא מפילים את המסך, כי בפרונט זה כבר נכנס
    }
  }

  // LOOK / גריד וידאו קטן
const videos = [
  {
    src: "https://www.w3schools.com/html/mov_bbb.mp4",
    poster: "https://picsum.photos/800/450?random=1",
  },
  {
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    poster: "https://picsum.photos/800/450?random=2",
  },
  {
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    poster: "https://picsum.photos/800/450?random=3",
  },
  {
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    poster: "https://picsum.photos/800/450?random=4",
  },
  {
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    poster: "https://picsum.photos/800/450?random=5",
  },
];
  const uniqueVideos = useMemo(() => {
    const seen = new Set();
    return videos.filter(v => {
      const key = (v.src || v.poster || "").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [videos]);

  const trackRef = useRef(null);
  const vidsRef  = useRef([]);
  const pauseAll    = useCallback(() => vidsRef.current.forEach(v => v?.pause()), []);
  const handleEnter = useCallback((i) => { const v = vidsRef.current[i]; if (v) { v.muted = true; v.playsInline = true; v.play().catch(()=>{}); } }, []);
  const handleLeave = useCallback((i) => { vidsRef.current[i]?.pause(); }, []);

  // ========= מוצרים שאולי תאהבי =========
  const [likes, setLikes] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesErr, setLikesErr] = useState("");

  const getRecoSlugsFor = useCallback((product) => {
    const currentSlug =
      product?.category_slug ||
      product?.categories?.[0]?.slug ||
      null;
    return RECO_MAP[currentSlug] || RECO_MAP.__default;
  }, [RECO_MAP]);

  useEffect(() => {
    if (!item?.id) return;

    let ignore = false;
    (async () => {
      try {
        setLikesLoading(true);
        setLikesErr("");

        const recSlugs = getRecoSlugsFor(item);
        const results = await Promise.all(
          recSlugs.map(async (slug) => {
            const qs = new URLSearchParams({ slug, page: "1", pageSize: "24" });
            const res = await fetch(`/api/products/by-category?${qs.toString()}`);
            if (!res.ok) throw new Error("שגיאה בטעינת המלצות");
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
          })
        );

        if (ignore) return;

        const merged = results.flat();
        const seen = new Set([item.id]);
        const filtered = merged.filter(p => {
          if (!p || seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        for (let i = filtered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
        }

        setLikes(filtered.slice(0, 5));
      } catch (e) {
        if (!ignore) setLikesErr(e.message || "שגיאה בטעינת המלצות");
      } finally {
        if (!ignore) setLikesLoading(false);
      }
    })();

    return () => { ignore = true; };
  }, [item?.id, getRecoSlugsFor]);

  // ===== בועה דביקה
  const snap = (v) => Math.round(v * (window.devicePixelRatio || 1)) / (window.devicePixelRatio || 1);
  const getAbsBottom = (el) => (el?.getBoundingClientRect().bottom || 0) + window.scrollY;
  const getFooterTopAbs = (el) => (el?.getBoundingClientRect().top || 0) + window.scrollY;

  useEffect(() => {
    const anchor  = infoBodyRef.current;
    const mini    = helpRef.current;
    const column  = infoRef.current;
    const stopper = stopRef.current;
    if (!anchor || !mini || !column || !stopper) return;

    const TARGET_TOP = 1;
    const EXTRA_GAP  = 0;
    const SAFE_GAP   = 50;

    const placeHorizontally = () => {
      const colRect = column.getBoundingClientRect();
      const colLeft = colRect.left + window.scrollX;
      mini.style.left  = `${colLeft}px`;
      mini.style.width = `var(--help-w, 360px)`;
    };

    let ticking = false;
    let smoothTimer;

    const update = () => {
      mini.classList.add("is-scrolling");
      clearTimeout(smoothTimer);
      smoothTimer = setTimeout(() => mini.classList.remove("is-scrolling"), 150);

      placeHorizontally();

      const dynTop = getAbsBottom(anchor) - window.scrollY + EXTRA_GAP;
      let desiredTop = Math.max(TARGET_TOP, dynTop);

      const miniH        = mini.offsetHeight || 0;
      const footerTopAbs = getFooterTopAbs(stopper);
      const maxTop       = footerTopAbs - window.scrollY - miniH - SAFE_GAP;
      desiredTop         = Math.min(desiredTop, maxTop);

      const ty = snap(desiredTop - TARGET_TOP);
      mini.style.transform = `translate3d(0, ${ty}px, 0)`;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { update(); ticking = false; });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", update);

    const ro = new ResizeObserver(onScroll);
    ro.observe(document.documentElement);
    ro.observe(mini);
    ro.observe(column);
    ro.observe(anchor);
    ro.observe(stopper);

    const t = setTimeout(update, 300);

    return () => {
      clearTimeout(t);
      clearTimeout(smoothTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("load", update);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isAuthed || !item?.id) return;
    const extraHeaders = { "X-User-Id": String(userId) };
    (async () => {
      try {
        const favRes = await favoritesApi.list(extraHeaders);
        const favs = Array.isArray(favRes?.favorites) ? favRes.favorites : [];
        const setIds = new Set(favs.map(f => Number(f.product_id)));
        setLiked(setIds.has(Number(item.id)));
      } catch {
        // מתעלמים
      }
    })();
  }, [isAuthed, userId, item?.id]);

  // ====== רינדור ======
  if (loading) {
    return (
      <>
        <SiteHeader
          cartItems={items}
          onQtyChange={handleQtyChange}
          onRemove={handleRemove}
        />
        <main className="acct-wrap">
          <section className="acct-section">
            <p className="acct-sub">טוען…</p>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }
  if (err || !item) {
    return (
      <>
        <SiteHeader
          cartItems={items}
          onQtyChange={handleQtyChange}
          onRemove={handleRemove}
        />
        <main className="acct-wrap">
          <section className="acct-section">
            <p className="acct-error">{err || "שגיאה בטעינה"}</p>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const mainImg =
    (Array.isArray(item.images) && item.images[0]) ||
    item.image_url ||
    item.hover_image_url ||
    `https://picsum.photos/seed/prod${item.id}/800/800`;

  const stockQty  = Number(item.stock_qty ?? 0);
  const isSoldOut = stockQty <= 0;

  return (
    <>
      <SiteHeader
        cartItems={items}
        onQtyChange={handleQtyChange}
        onRemove={handleRemove}
      />

      <main className="acct-wrap">
        <section className="acct-section" dir="rtl">
          {/* פירורי לחם */}
          <nav className="acct-breadcrumb" aria-label="breadcrumb">
            <ol>
              <li><Link to="/">דף הבית</Link></li>
              <li><Link to="/products">כל המוצרים</Link></li>
              <li aria-current="page">{item.title}</li>
            </ol>
          </nav>

          <div className="product-page">
            {/* גלריה */}
            <div className="pp-gallery">
              <div className="pp-stage">
                {images.length > 1 && (
                  <div className="pp-thumbs-wrap">
                    {images.length > VISIBLE_THUMBS && (
                      <button
                        type="button"
                        className="pp-nav-btn pp-nav-prev"
                        aria-label="תמונה קודמת"
                        onClick={goPrev}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 7l-6 6h12z" fill="currentColor"/>
                        </svg>
                      </button>
                    )}

                    <div className="pp-thumbs-vert" aria-label="גלריית תמונות">
                      {visibleThumbs.map((src, idx) => {
                        const i = start + idx;
                        return (
                          <button
                            key={`${i}-${src}`}
                            type="button"
                            ref={(el) => (thumbRefs.current[i] = el)}
                            className={`pp-thumb ${i === active ? "is-active" : ""}`}
                            onClick={() => selectImage(i)}
                            aria-label={`תמונה ${i + 1}`}
                          >
                            <img src={src} alt={`${item.title} ${i + 1}`} loading="lazy" />
                          </button>
                        );
                      })}
                    </div>

                    {images.length > VISIBLE_THUMBS && (
                      <button
                        type="button"
                        className="pp-nav-btn pp-nav-next"
                        aria-label="תמונה הבאה"
                        onClick={goNext}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 17l6-6H6z" fill="currentColor"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}

                {/* תמונה ראשית */}
                <div
                  className={`pp-main ${zoomOn ? "is-zoomed" : ""}`}
                  onMouseMove={handleMouseMove}
                  onWheel={handleWheel}
                >
                  <button
                    type="button"
                    className="pp-zoom-btn"
                    aria-label={zoomOn ? "כיבוי זום" : "הגדלת תמונה"}
                    title={zoomOn ? "כיבוי זום" : "הגדלה"}
                    onClick={toggleZoom}
                  >
                    {zoomOn ? (
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="8.5" y1="11" x2="13.5" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="17" y1="17" x2="21.5" y2="21.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>

                  {isAuthed && (
                    <button
                      type="button"
                      className="pp-fav-btn"
                      onClick={toggleFavoriteSingle}
                      aria-pressed={liked}
                      aria-label={liked ? "הסר ממועדפים" : "הוסף למועדפים"}
                      data-liked={liked ? "true" : "false"}
                    >
                      <HeartIcon filled={liked} />
                    </button>
                  )}
  {isSoldOut && (
   <div
      className="sold-out-badge"
      style={{
    position: "absolute",
    top: 10,
    left: 70,
    width: 48,        // 👈 קוטר העיגול
    height: 48,       // 👈 קוטר העיגול
    background: "rgba(0, 0, 0, 0.93)",
    color: "#fff",
    fontSize: 10,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",   // 👈 עיגול מושלם
    zIndex: 5,
    textAlign: "center",
    lineHeight: 1.1,
    padding: 4,
  }}
    >
      SOLD OUT
    </div>
  )}
                  <div className="pp-main-stack">
                    {!zoomOn && prevSrc && (
                      <div
                        key={`leave-${transitionKey}-${swapDir}`}
                        className={`pp-slide ${swapDir === 'up' ? 'fx-leave-up' : 'fx-leave-down'}`}
                        aria-hidden="true"
                        onAnimationEnd={() => setPrevSrc(null)}
                      >
                        <img src={prevSrc} alt="" className="pp-main-img" />
                      </div>
                    )}

                    <div
                      key={`enter-${transitionKey}-${mainSrc}`}
                      className={`pp-slide ${!zoomOn ? (swapDir === 'up' ? 'fx-enter-up' : 'fx-enter-down') : ''}`}
                    >
                      <img
                        src={mainImg}
                        alt={item.title}
                        className="pp-main-img"
                        loading="eager"
                        style={zoomOn ? {
                          transform: `scale(${zoom})`,
                          transformOrigin: `${origin.x}% ${origin.y}%`,
                        } : undefined}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* פרטי מוצר */}
            <div className="pp-info" ref={infoRef}>
              {/* הבועה הצפה */}
              <aside ref={helpRef} className="pp-help-stick" aria-label="מידע ושירות">
                <div className="help-row">
                  <span className="help-ico" aria-hidden="true">
                    <FontAwesomeIcon icon={faPhone} />
                  </span>
                  <a className="help-link1" href="/contact">צור/י קשר</a>
                  <p className="help-sub"> צרו קשר אם נתקלתם בבעיה או צריכים ייעוץ.</p>
                </div>

                <div className="help-row">
                  <span className="help-ico" aria-hidden="true">
                    <FontAwesomeIcon icon={faCircleInfo} />
                  </span>
                  <a className="help-link2" href="/services">שירותי HALAKLI</a>
                  <p className="help-sub">
                    משלוח חינם מעל 699 ש"ח, תשלום מאובטח ואריזה ממותגת.
                  </p>
                </div>
              </aside>

              {/* גוף תוכן העמודה — לזיהוי “נגיעה” */}
              <div ref={infoBodyRef}>
                <h1 className="pp-title-main">{item.title}</h1>

                <div className="pp-price">
                  {item.final_price != null && item.final_price !== item.price ? (
                    <>
                      <span className="price-old">₪{format2(item.price)}</span>
                      <span className="price-now">₪{format2(item.final_price)}</span>
                    </>
                  ) : (
                    <span className="price-now">₪{format2(item.price)}</span>
                  )}
                </div>

                <p className="pp-text">{item.description}</p>

                {item.description && (
                  <>
                    <h3 className="pp-title">תיאור</h3>
                    <p className="pp-text">{item.components_text}</p>
                  </>
                )}

                {item.usage_text && (
                  <div className="pp-acc" dir="rtl">
                    <details className="pp-acc-usage" open={usageOpen}>
                      <summary
                        role="button"
                        aria-expanded={usageOpen}
                        onClick={(e) => {
                          e.preventDefault();
                          setUsageOpen(v => !v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setUsageOpen(v => !v);
                          }
                        }}
                      >
                        <span>הוראות שימוש</span>
                        <svg className="acc-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </summary>

                      <div className="acc-panel acc-js" ref={panelRef} style={{ maxHeight: 0, padding: 0 }}>
                        <div className="acc-body" ref={bodyRef}>{item.usage_text}</div>
                      </div>
                    </details>
                  </div>
                )}

                {/* כמות + עגלה */}
                <div className="addtocart-row" dir="rtl">
                  <label className="qty-wrap" htmlFor="qty">כמות</label>

                  <div className="qty-control" role="group" aria-label="בחירת כמות">
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQtyLocal(q => Math.max(1, q - 1))}
                      disabled={qty <= 1 || isSoldOut}
                    >
                      −
                    </button>
                    <input
                      id="qty"
                      className="qty-input"
                      type="number"
                      min={1}
                      step={1}
                      value={qty}
                      disabled={isSoldOut}
                      onChange={e =>
                        setQtyLocal(Math.max(1, Math.floor(+e.target.value || 1)))
                      }
                      onBlur={e => {
                        const v = +e.target.value;
                        if (!Number.isFinite(v) || v < 1) setQtyLocal(1);
                      }}
                    />
                    <button
                      type="button"
                      className="qty-btn"
                      onClick={() => setQtyLocal(q => q + 1)}
                      disabled={isSoldOut}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn-primary as-button"
                    onClick={handleAddToCart}
                    disabled={isSoldOut}
                  >
                    <span className="btn-text">
                      {isSoldOut ? "אזל מהמלאי" : "הוספה לעגלה"}
                    </span>
                    {!isSoldOut && (
                      <FontAwesomeIcon icon={faCartShopping} className="btn-icon" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* וידאו קטן (גריד, בלי חצים) */}
          <section className="look-section look--sm">
            <div className="look-wrapper">
              <div className="look-track" ref={trackRef} dir="ltr">
                {uniqueVideos.map((v, i) => (
                  <div key={v.src || v.poster || i} className="look-card">
                    <video
                      ref={(el) => (vidsRef.current[i] = el)}
                      src={v.src}
                      poster={v.poster}
                      preload="metadata"
                      muted
                      playsInline
                      onMouseEnter={() => handleEnter(i)}
                      onMouseLeave={() => { handleLeave(i); pauseAll(); }}
                      onTouchStart={() => handleEnter(i)}
                      onTouchEnd={() => handleLeave(i)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* מוצרים שאולי תאהבי */}
          <section
            className="acct-section acct-section--right"
            aria-label="מוצרים שאולי תאהבי"
            dir="rtl"
          >
            <h2 className="acct-h1" style={{ fontSize: 20, marginTop: 35 }}>
              מוצרים שאולי תאהבי
            </h2>

            {likesLoading && <p className="acct-sub">טוען המלצות…</p>}
            {likesErr && <div className="acct-error">{likesErr}</div>}

            {!likesLoading && !likesErr && likes.length > 0 && (
              <div className="products-grid products-grid--right" >
                {likes.map(p => (
                  <MiniCard
                    key={p.id}
                    p={p}
                    userId={userId}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ← כאן נרצה לעצור את הבועה */}
          <div ref={stopRef} aria-hidden="true" style={{ height: 1 }} />
        </section>
      </main>

      {/* Drawer */}
      <ShoppingCart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        onQtyChange={(idForChange, nextQty, shade) => setQtyCtx(idForChange, shade, nextQty)}
        onRemove={(idToRemove, shade) => remove(idToRemove, shade)}
        onCheckout={() => { setCartOpen(false); }}
        freeShippingThreshold={699}
      />

      <br />

      <SiteFooter />
    </>
  );
}

// ===== כרטיס קטן ל"אהבתי" =====
function MiniCard({ p, userId }) {
  const mainSrc  = p.image_url || `https://picsum.photos/seed/prod${p.id}/600/600`;
  const rawHover = p.hover_image_url || null;
  const hoverSrc = rawHover && rawHover !== mainSrc ? rawHover : null;
  const hasHover = Boolean(hoverSrc);

  // האם המשתמש באמת מחובר?
  const isAuthed = Boolean(getToken() && userId);

  // מצב לוקלי ללב של הכרטיס
  const [likedLocal, setLikedLocal] = React.useState(false);

  async function toggleFavMini(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthed) {
      alert("כדי לשמור למועדפים צריך להתחבר 💖");
      return;
    }

    const extraHeaders = { "X-User-Id": String(userId) };
    const was = likedLocal;

    // עדכון אופטימי
    setLikedLocal(!was);
    try {
      if (was) {
        await favoritesApi.remove(p.id, extraHeaders);
      } else {
        await favoritesApi.add(p.id, extraHeaders);
      }
    } catch {
      // החזרה אחורה
      setLikedLocal(was);
      alert("לא ניתן לעדכן מועדפים כרגע");
    }
  }

  return (
    <article
      className={`product-card ${hasHover ? "has-hover" : ""}`}
      style={{ position: "relative" }}
    >
      <Link
        to={`/product/${p.id}`}
        className="product-card-link"
        aria-label={`לצפייה במוצר: ${p.title || p.name}`}
      >
        <div className="product-thumb">
          <img
            className="img-main"
            src={mainSrc}
            alt={p.title || p.name || "מוצר"}
            loading="lazy"
            decoding="async"
          />
          {hasHover && (
            <img
              className="img-hover"
              src={hoverSrc}
              alt=""
              loading="lazy"
              decoding="async"
              onError={(e) => {
                e.currentTarget.remove();
                e.currentTarget
                  .closest(".product-card")
                  ?.classList.remove("has-hover");
              }}
            />
          )}
        </div>

        <div style={{ padding: 12, textAlign: "center" }}>
          <h3 style={{ margin: "10px 0 2px", lineHeight: 1.35 }}>
            {p.title || p.name || "ללא שם"}
          </h3>

          {p.description && (
            <p
              className="product-sub"
              style={{
                margin: 0,
                color: "#666",
                lineHeight: 1.5,
                maxWidth: "32ch",
                marginInline: "auto",
              }}
            >
              {p.description}
            </p>
          )}

          <div style={{ marginTop: 6, fontWeight: 700 }}>
            {p.final_price != null && p.final_price !== p.price ? (
              <>
                <span className="price-oldpage">₪ {p.price}</span>
                <span className="price-nowpage">₪ {p.final_price}</span>
              </>
            ) : (
              <span className="price-nowpage">₪ {p.price}</span>
            )}
          </div>
        </div>
      </Link>

      {/* לב קטן – רק אם באמת מחובר */}
      {isAuthed && (
        <button
          type="button"
          className="pp-fav-btn"
          style={{ top: "5px" }}
          onClick={toggleFavMini}
          aria-pressed={likedLocal}
          aria-label={
            likedLocal ? "הסר ממועדפים" : "הוסף למועדפים"
          }
          data-liked={likedLocal ? "true" : "false"}
        >
          <HeartIcon filled={likedLocal} />
        </button>
      )}
    </article>
  );
}
