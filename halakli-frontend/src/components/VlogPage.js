import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import "../csscom/VlogPage.css";

/* ===== API ===== */
const API = "/api";
async function fetchJSON(
  url,
  { method = "GET", headers, body, timeout = 15000 } = {}
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: ctrl.signal,
      credentials: "same-origin",
    });
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  } finally { clearTimeout(t); }
}

/* ===== Helpers ===== */
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
}
function fmtCompact(n) {
  const x = Number(n) || 0;
  if (x < 1000) return String(x);
  if (x < 1_000_000) return Math.round((x / 1000) * 10) / 10 + "K";
  if (x < 1_000_000_000) return Math.round((x / 1_000_000) * 10) / 10 + "M";
  return Math.round((x / 1_000_000_000) * 10) / 10 + "B";
}
function fmtFull(n) { return Number(n || 0).toLocaleString("he-IL"); }
function getSessionId() {
  try {
    const key = "x_session_id";
    let sid = localStorage.getItem(key);
    if (!sid) {
      const arr = new Uint8Array(16);
      (window.crypto || window.msCrypto)?.getRandomValues?.(arr);
      sid = Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
      if (!sid) sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return "anon-" + (typeof navigator !== "undefined" ? navigator.userAgent || "ua" : "ua");
  }
}

/* ===== API wrappers ===== */
const vlogsApi = {
  async get(id) {
    const res = await fetchJSON(`${API}/vlogs/${id}`);
    return res && (res.data ?? res);
  },
  addView(id, dateStr) {
    const headers = { "Content-Type": "application/json" };
    const body = dateStr ? JSON.stringify({ date: dateStr }) : JSON.stringify({});
    return fetchJSON(`${API}/vlogs/${id}/view`, { method: "POST", headers, body }).catch(() => {});
  },
  views(id, { from, to } = {}) {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return fetchJSON(`${API}/vlogs/${id}/views${qs ? `?${qs}` : ""}`);
  },
};

const likesApi = {
  status(id, sid) {
    const headers = { "X-Session-Id": sid };
    return fetchJSON(`${API}/vlogs/${id}/likes/status`, { headers });
  },
  count(id) { return fetchJSON(`${API}/vlogs/${id}/likes/count`); },
  like(id, sid) {
    const headers = { "Content-Type": "application/json", "X-Session-Id": sid };
    return fetchJSON(`${API}/vlogs/${id}/like`, { method: "POST", headers, body: JSON.stringify({}) });
  },
  unlike(id, sid) {
    const headers = { "X-Session-Id": sid };
    return fetchJSON(`${API}/vlogs/${id}/like`, { method: "DELETE", headers });
  },
};

/* ===== Vlog Page ===== */
export default function VlogPage() {
  const { id } = useParams();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewsTotal, setViewsTotal] = useState(0);
  const [likePending, setLikePending] = useState(false);
  const [animFrom, setAnimFrom] = useState(null);
  const [animTo, setAnimTo] = useState(null);

  const [email, setEmail] = useState("");

  // ----- מיקומים ו־refs -----
  const stopRef = useRef(null);     // גבול לפני הפוטר
  const triggerRef = useRef(null);  // נקודת העיגון (author line)
  const miniRef = useRef(null);     // הקופסה הצפה
  const contentRef = useRef(null);  // תוכן הפוסט

  // נתונים בסיסיים
  const shareUrl = useMemo(() => (typeof window !== "undefined" ? window.location.href : ""), []);
  const title   = item?.title || "";
  const created = item?.created_at || "";
  const cover   = item?.cover_image || "";

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

 useEffect(() => {
  const mini = miniRef.current;
  const content = contentRef.current;
  if (!mini || !content) return;

  const MIN_TOUCH = 12; // כמה פיקסלים של חפיפה כדי להחשב "נוגע"

  const isOverlap = () => {
    const m = mini.getBoundingClientRect();
    const c = content.getBoundingClientRect();
    const overlapX = Math.min(m.right, c.right) - Math.max(m.left, c.left);
    const overlapY = Math.min(m.bottom, c.bottom) - Math.max(m.top, c.top);
    return overlapX > MIN_TOUCH && overlapY > MIN_TOUCH;
  };

  let ticking = false;
  const update = () => {
    mini.classList.toggle("is-compact", isOverlap());
  };

  const onScrollOrResize = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  };

  update();
  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);

  const ro = new ResizeObserver(onScrollOrResize);
  ro.observe(document.documentElement);
  ro.observe(mini);
  ro.observe(content);

  return () => {
    window.removeEventListener("scroll", onScrollOrResize);
    window.removeEventListener("resize", onScrollOrResize);
    ro.disconnect();
  };
}, []);



  // ===== טעינת וולוג + סטטיסטיקות =====
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setErr("");
        const data = await vlogsApi.get(id);
        if (!alive) return;
        setItem(data);

        await vlogsApi.addView(id);
        const views = await vlogsApi.views(id).catch(() => ({ data: [] }));
        if (!alive) return;
        const totalViews = (views?.data || []).reduce((s, r) => s + Number(r?.views || 0), 0);
        setViewsTotal(totalViews);

        const sid = getSessionId();
        const [st, cnt] = await Promise.all([
          likesApi.status(id, sid).catch(() => ({ liked: false })),
          likesApi.count(id).catch(() => ({ count: 0 })),
        ]);
        if (!alive) return;
        setLiked(Boolean(st?.liked));
        setLikeCount(Number((cnt && (cnt.count ?? cnt.cnt)) || 0));
      } catch (e) {
        if (!alive) return;
        setErr(e.message || "שגיאה בטעינת הוולוג");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // ===== מיני צף: ירידה עם האזור, עצירה לפני פוטר =====
  const TARGET_TOP = 200;   // חייב להתאים ל-top של .meta-mini ב-CSS
  const EXTRA_GAP  = 0;
  const SAFE_GAP   = 50;

  const snap = (v) => Math.round(v * (window.devicePixelRatio || 1)) / (window.devicePixelRatio || 1);
  const getAbsBottom = (el) => (el?.getBoundingClientRect().bottom || 0) + window.scrollY;
  const getFooterTopAbs = (el) => (el?.getBoundingClientRect().top || 0) + window.scrollY;

  useEffect(() => {
    const anchor  = triggerRef.current;
    const mini    = miniRef.current;
    const stopper = stopRef.current;
    if (!anchor || !mini || !stopper) return;

    let ticking = false;

    const update = () => {
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
    window.addEventListener("resize", update);
    window.addEventListener("load", update);

    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    ro.observe(mini);
    ro.observe(stopper);

    const t = setTimeout(update, 300);

    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      window.removeEventListener("load", update);
      ro.disconnect();
    };
  }, []);

  // ===== חדש: כשהמיני “נוגע” בתוכן – להוסיף/להסיר is-compact =====
  useEffect(() => {
    const mini = miniRef.current;
    const content = contentRef.current;
    if (!mini || !content) return;

    let ticking = false;

    const checkOverlap = () => {
      ticking = false;
      const a = mini.getBoundingClientRect();
      const b = content.getBoundingClientRect();
      const overlap = !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
      mini.classList.toggle("is-compact", overlap);
    };

    const onScrollOrResize = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(checkOverlap);
      }
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    checkOverlap();

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  // ===== לייק =====
  async function toggleLike() {
    if (likePending) return;
    setLikePending(true);
    const sid = getSessionId();
    const prevLiked = liked, prevCount = likeCount;
    const goingToLike = !prevLiked;
    const nextCount = Math.max(0, prevCount + (goingToLike ? 1 : -1));

    if (goingToLike) { setAnimFrom(prevCount); setAnimTo(nextCount); }
    else { setAnimFrom(nextCount); setAnimTo(prevCount); }

    setLiked(goingToLike); setLikeCount(nextCount);

    try {
      const res = goingToLike ? await likesApi.like(id, sid) : await likesApi.unlike(id, sid);
      if (typeof res?.count === "number") setLikeCount(Math.max(0, res.count));
    } catch {
      setLiked(prevLiked); setLikeCount(prevCount);
    } finally {
      setLikePending(false);
      setTimeout(() => { setAnimFrom(null); setAnimTo(null); }, 400);
    }
  }

  // ===== Share =====
  const share = useMemo(() => ({
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`
  }), [shareUrl, title]);

  async function shareToFacebook(e) {
    e?.preventDefault?.();
    window.open(share.facebook, "_blank", "noopener,noreferrer");
  }
  async function shareToInstagram(e) {
    e?.preventDefault?.();
    const text = `${title}\n${shareUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url: shareUrl }); return; } catch {}
    }
    try { await navigator.clipboard?.writeText(text); } catch {}
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }

  /* === MetaBar (שימוש בתוך ה־meta-mini) === */
  function MetaBar() {
    return (
      <section className="vlogpage-meta" aria-label="פרטי וולוג" dir="rtl">
        <div className="vlogpage-meta__divider" />

        {/* SHARE WITH + אייקונים */}
        <div className="share-block" aria-label="שיתוף">
          <span className="share-label">SHARE WITH</span>
          <ul className="share-icons" aria-label="כפתורי שיתוף">
            <li>
              <a className="icon facebook" href={share.facebook} target="_blank" rel="noopener noreferrer"
                 aria-label="שיתוף בפייסבוק" onClick={shareToFacebook}>
                <span className="tooltip">Facebook</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.675 0h-21.35C.595 0 0 .592 0 1.324v21.352C0 23.406.595 24 1.325 24H12.82v-9.294H9.692V11.08h3.128V8.41c0-3.1 1.894-4.788 4.659-4.788 1.325 0 2.464.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.716-1.796 1.767v2.317h3.59l-.467 3.626h-3.123V24h6.127C23.406 24 24 23.406 24 22.676V1.324C24 .592 23.406 0 22.675 0z"/>
                </svg>
              </a>
            </li>
            <li>
              <a className="icon instagram" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer"
                 aria-label="שיתוף באינסטגרם" onClick={shareToInstagram}>
                <span className="tooltip">Instagram</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm6.5-3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                </svg>
              </a>
            </li>
            <li>
              <a className="icon whatsapp" href={share.whatsapp} target="_blank" rel="noopener noreferrer"
                 aria-label="שיתוף ב-WhatsApp">
                <span className="tooltip">WhatsApp</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.62-6.003C.122 5.281 5.403 0 12.057 0 18.71 0 24 5.281 24 11.834c0 6.554-5.29 11.835-11.943 11.835-2.044 0-3.965-.521-5.654-1.437L.057 24zm6.597-3.807c1.6.995 3.48 1.571 5.508 1.571 5.448 0 9.886-4.427 9.886-9.864 0-5.436-4.438-9.863-9.886-9.863-5.447 0-9.885 4.427-9.885 9.863 0 2.188.715 4.21 1.926 5.84l-.999 3.648 3.45-.995zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.03-.967-.272-.099-.47-.149-.668.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.149-.668-1.611-.916-2.207-.242-.579-.487-.5-.668-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                </svg>
              </a>
            </li>
          </ul>
        </div>

        {/* סטטיסטיקות */}
        <div className="vlogpage-meta__right" aria-label="שיתוף וסטטיסטיקות" style={{ gap: 12 }}>
          <div className={`hl-like ${likePending ? "is-pending" : ""}`}>
            <input
              id={`like-${id}`}
              className="hl-like__toggle"
              type="checkbox"
              checked={liked}
              onChange={toggleLike}
              aria-label={liked ? "בטל לייק" : "אהבתי"}
            />
            <label className="hl-like__click" htmlFor={`like-${id}`} aria-pressed={liked}
                   aria-label={`לייקים: ${fmtFull(likeCount)}`}>
              <svg className="hl-like__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
              </svg>
              <span className="hl-like__text">Likes</span>
            </label>
            <span className="hl-like__count one">{fmtCompact(animFrom ?? likeCount)}</span>
            <span className="hl-like__count two">{fmtCompact(animTo ?? likeCount)}</span>
          </div>

          <div className="hl-views" aria-label={`צפיות: ${fmtFull(viewsTotal)}`}>
            <div className="hl-views__left">
              <svg className="hl-views__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5c5.5 0 9.7 3.6 11 7-1.3 3.4-5.5 7-11 7S2.3 15.4 1 12c1.3-3.4 5.5-7 11-7zm0 3.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-6.5z"/>
              </svg>
              <span className="hl-views__text">Views</span>
            </div>
            <span className="hl-views__count">{fmtCompact(viewsTotal)}</span>
          </div>
        </div>
      </section>
    );
  }
return (
  <>
 <SiteHeader variant="account" />

      <main className="acct-wrap">
        {/* עוטף ברוחב נוח + RTL לכל התוכן */}
        <section className="acct-section" dir="rtl">
          {/* HERO עם רקע מה-cover */}
          <section
            className="vlog-hero"
            style={{ "--hero-bg": cover ? `url('${cover}')` : "none" }}
          >
            {/* Breadcrumbs */}
            <nav
              className="acct-breadcrumb acct-breadcrumb--on-hero"
              dir="rtl"
              aria-label="breadcrumb"
            >
              <ol>
                <li><Link to="/">דף הבית</Link></li>
                <li><Link to="/vlogs">בלוג</Link></li>
                <li aria-current="page">{title}</li>
              </ol>
            </nav>

            {/* כותרת */}
            <h1
              className="vlogpage-title vlogpage-title--masked"
              style={{
                "--vp-mask-img":
                  "linear-gradient(90deg, #f588beff 0%, #eb6a77a2 50%, #fa98b4ff 100%)",
              }}
            >
              {title || "…"}
            </h1>

            {/* מחבר/תאריך */}
            <div className="vlogpage-meta__left">
              <div className="vlogpage-author">
                <div className="avatar-soft">
                  <img
                    className="vlogpage-avatar"
                    src="/karin.png"
                    alt=""
                    width={44}
                    height={44}
                    decoding="async"
                  />
                </div>

                <div className="vlogpage-author__text" ref={triggerRef}>
                  <div className="vlogpage-authorline">
                    <span className="vlogpage-author__name">קארין ניקיטין </span>
                    <span className="vlogpage-author__role">
                      מומחית להחלקות שיער, בעלת מספרת חלקלי
                    </span>
                    <br />
                    <time className="vlogpage-date" dateTime={created}>
                      {fmtDate(created)}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* meta מינימלי צף/דביק */}
          <div
            ref={miniRef}
            className="meta-mini"
          >
            <section className="vlogpage-meta" aria-label="פרטי וולוג" dir="rtl">
              <div className="vlogpage-meta__divider" />

              {/* כפתורי שיתוף */}
              <div className="share-block" aria-label="שיתוף">
                <span className="share-label">SHARE WITH</span>
                <ul className="share-icons" aria-label="כפתורי שיתוף">
                  <li>
                    <a
                      className="icon facebook"
                      href={share.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="שיתוף בפייסבוק"
                      onClick={shareToFacebook}
                    >
                      <span className="tooltip">Facebook</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22.675 0h-21.35C.595 0 0 .592 0 1.324v21.352C0 23.406.595 24 1.325 24H12.82v-9.294H9.692V11.08h3.128V8.41c0-3.1 1.894-4.788 4.659-4.788 1.325 0 2.464.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.716-1.796 1.767v2.317h3.59l-.467 3.626h-3.123V24h6.127C23.406 24 24 23.406 24 22.676V1.324C24 .592 23.406 0 22.675 0z" />
                      </svg>
                    </a>
                  </li>

                  <li>
                    <a
                      className="icon instagram"
                      href="https://www.instagram.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="שיתוף באינסטגרם"
                      onClick={shareToInstagram}
                    >
                      <span className="tooltip">Instagram</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm5 3a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6zm6.5-3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" />
                      </svg>
                    </a>
                  </li>

                  <li>
                    <a
                      className="icon whatsapp"
                      href={share.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="שיתוף ב-WhatsApp"
                    >
                      <span className="tooltip">WhatsApp</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.62-6.003C.122 5.281 5.403 0 12.057 0 18.71 0 24 5.281 24 11.834c0 6.554-5.29 11.835-11.943 11.835-2.044 0-3.965-.521-5.654-1.437L.057 24zm6.597-3.807c1.6.995 3.48 1.571 5.508 1.571 5.448 0 9.886-4.427 9.886-9.864 0-5.436-4.438-9.863-9.886-9.863-5.447 0-9.885 4.427-9.885 9.863 0 2.188.715 4.21 1.926 5.84l-.999 3.648 3.45-.995zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.03-.967-.272-.099-.47-.149-.668.149-.198.297-.767.967-.94 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.173.198-.297.297-.495.099-.198.05-.372-.025-.521-.074-.149-.668-1.611-.916-2.207-.242-.579-.487-.5-.668-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
                      </svg>
                    </a>
                  </li>
                </ul>
              </div>

              {/* Likes + Views */}
              <div className="vlogpage-meta__right" aria-label="שיתוף וסטטיסטיקות" style={{ gap: 12 }}>
                <div className={`hl-like ${likePending ? "is-pending" : ""}`}>
                  <input
                    id={`like-${id}`}
                    className="hl-like__toggle"
                    type="checkbox"
                    checked={liked}
                    onChange={toggleLike}
                    aria-label={liked ? "בטל לייק" : "אהבתי"}
                  />
                  <label
                    className="hl-like__click"
                    htmlFor={`like-${id}`}
                    aria-pressed={liked}
                    aria-label={`לייקים: ${fmtFull(likeCount)}`}
                  >
                    <svg className="hl-like__icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
                    </svg>
                    <span className="hl-like__text">Likes</span>
                  </label>
                  <span className="hl-like__count one">{fmtCompact(animFrom ?? likeCount)}</span>
                  <span className="hl-like__count two">{fmtCompact(animTo ?? likeCount)}</span>
                </div>

                <div className="hl-views" aria-label={`צפיות: ${fmtFull(viewsTotal)}`}>
                  <div className="hl-views__left">
                    <svg className="hl-views__icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5c5.5 0 9.7 3.6 11 7-1.3 3.4-5.5 7-11 7S2.3 15.4 1 12c1.3-3.4 5.5-7 11-7zm0 3.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-6.5z" />
                    </svg>
                    <span className="hl-views__text">Views</span>
                  </div>
                  <span className="hl-views__count">{fmtCompact(viewsTotal)}</span>
                </div>
              </div>

              {/* הכרטיסון */}
              <div className="card">
                <div className="banner">
                  <span className="banner-text">JOIN US</span>
                  <span className="banner-text">HALAKLI</span>
                </div>

                <span className="card__title">הנחות ומבצעים</span>
                <p className="card__subtitle">
                  תרשמי לחלקלי לקבלת הנחות להחלקות ביתיות ומוצרי שיער.
                </p>

                <form className="card__form" onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="email"
                    placeholder="Your Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Link
                    to={`/account?email=${encodeURIComponent(email)}`}
                    className="sign-up"
                    role="button"
                  >
                    הרשמה
                  </Link>
                </form>
              </div>
            </section>
          </div>

          {/* תוכן הפוסט – כאן שמנו ref כדי לזהות "מגע" */}
          <article
            ref={contentRef}
            className="vlogpage-content"
            aria-label="תוכן הוולוג"
            dir="rtl"
          >
            {loading && <div className="vlogpage-skel">טוען…</div>}
            {err && <div className="vlogpage-error">{err}</div>}
            {!loading && !err && (
              item?.content
                ? <div dangerouslySetInnerHTML={{ __html: item.content }} />
                : <p className="acct-sub">אין תוכן להצגה.</p>
            )}
          </article>
        </section>

        {/* פוטר */}
        <div ref={stopRef}>
          <SiteFooter />
        </div>
      </main>
    </>
  );
}