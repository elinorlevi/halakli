const API_BASE =
  (import.meta?.env?.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "http://localhost:4000/api";

// מזהה דפדפן קבוע בין טאבים/ריענונים
function getBrowserSessionId() {
  let sid = localStorage.getItem("hlk_browser_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem("hlk_browser_session_id", sid);
  }
  return sid;
}

// מזהה ביקור (שורה ב-analytics_sessions) שמור רק לטאב הזה
function getVisitId() {
  return sessionStorage.getItem("hlk_visit_id");
}
function setVisitId(id) {
  sessionStorage.setItem("hlk_visit_id", String(id));
}

// מזהה מאיפה בא היוזר לפי referrer
function detectChannel() {
  const ref = document.referrer || "";
  const lower = ref.toLowerCase();

  // קודם כל: אם ב-URL כבר יש utm_source ידני (קמפיין), זה ינצח.
  // נטפל בזה ב-ensureSession. הפונקציה הזאת רק מנחשת.

  // fb / instagram / tiktok / google בלבד
  if (lower.includes("facebook.com") || lower.includes("fb.com")) {
    return "facebook";
  }
  if (lower.includes("instagram.com")) {
    return "instagram";
  }
  if (lower.includes("tiktok.com")) {
    return "tiktok";
  }
  if (
    lower.includes("google.") || // google.com / google.co.il וכו
    lower.includes("gclid=")     // לינקים ממודעות גוגל ממילא לרוב עוברים דרך גוגל
  ) {
    return "google";
  }

  // אם אין referrer בכלל (מישהו נכנס ישיר, או וואטסאפ, או סטורי בלי referrer)
  if (!ref) {
    return "direct";
  }

  // referrer כלשהו שלא בא מארבעת המקורות -> גם נסמן כ-direct
  return "direct";
}

// דגל ברמת החלון כדי שלא נפתח פעמיים בטעות
if (!window.__hlkSessionInitInProgress) {
  window.__hlkSessionInitInProgress = false;
}

export async function ensureSession() {
  // אם כבר קיבלנו visit_id לטאב הזה — סיימנו
  if (getVisitId()) return;

  // אם כבר בתהליך פתיחה — סיימנו
  if (window.__hlkSessionInitInProgress) return;
  window.__hlkSessionInitInProgress = true;

  const qs = new URLSearchParams(window.location.search);
  const utmFromUrl = qs.get("utm_source");
  const resolvedSource = utmFromUrl || detectChannel();

  const body = {
    session_id: getBrowserSessionId(),
    user_id: localStorage.getItem("user_id") || null,
    utm_source: resolvedSource || "direct",
    utm_medium: null,
    utm_campaign: null,
    device: navigator.userAgent || null,
    country: null,
    started_at: new Date().toISOString(),
  };

  console.log("[DEBUG ensureSession] body I'm sending >>>", body);


  try {
    const res = await fetch(`${API_BASE}/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data?.visit_id) {
      setVisitId(data.visit_id);
    } else {
      console.warn("[analytics] no visit_id returned", data);
    }
  } finally {
    // שחרור הדגל
    window.__hlkSessionInitInProgress = false;
  }
}


// heartbeat כל חצי דקה
export async function heartbeat() {
  const vid = getVisitId();
  if (!vid) return;

  try {
    await fetch(`${API_BASE}/sessions/heartbeat`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visit_id: vid }),
    });
  } catch (err) {
    console.warn("[analytics] heartbeat failed", err);
  }
}

// נסיים ביקור כשסוגרים טאב
export function setupUnloadHook() {
  if (window.__hlkUnloadHookAttached) return;
  window.__hlkUnloadHookAttached = true;

  window.addEventListener("beforeunload", () => {
    const vid = getVisitId();
    if (!vid) return;

    const payload = {
      visit_id: vid,
      ended_at: new Date().toISOString(),
    };

    // primary
    navigator.sendBeacon?.(
      `${API_BASE}/sessions/end`,
      new Blob([JSON.stringify(payload)], { type: "application/json" })
    );

    // fallback
    try {
      fetch(`${API_BASE}/sessions/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: "omit",
      });
    } catch (_) {}
  });
}

// רישום צפיות בעמוד (אם יש לך /pageviews בצד שרת)
export async function logPageView(pathname, referrer) {
  const vid = getVisitId();
  if (!vid) return;

  try {
    await fetch(`${API_BASE}/pageviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visit_id: vid,
        page_url: pathname,
        referrer: referrer || document.referrer || null,
        time_on_page_seconds: null,
        exited_here: 0,
      }),
      keepalive: true,
      credentials: "omit",
    });
  } catch (err) {
    console.warn("[analytics] logPageView failed", err);
  }
}
