// utils/cartBus.js
let channel = null;
const TAB_ID = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const CH_NAME = "cart_bus_v1";

try {
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CH_NAME);
  }
} catch { /* ignore */ }

// שליחת הודעה לכל השכבות (BC + אירוע חלון + פולבק ל-storage)
function publish(type, payload) {
  const msg = {
    type,
    payload: safeClone(payload),
    sourceId: TAB_ID,
    ts: Date.now(),
  };

  // 1) בין טאבּים
  try { channel?.postMessage(msg); } catch {}

  // 2) באותו טאב
  try {
    window.dispatchEvent(new CustomEvent(`cart:${type}`, { detail: msg }));
  } catch {}

  // 3) פולבק לטאבים אחרים: "פינג" קצר ל-storage כדי להצית storage event
  try {
    localStorage.setItem("__cart_bus_ping", JSON.stringify(msg));
    // מיד מנקים כדי שלא ישאר לכלוך
    localStorage.removeItem("__cart_bus_ping");
  } catch {}
}

// מאזין אחוד
function subscribe(type, handler) {
  const onWindow = (ev) => {
    const msg = ev?.detail;
    if (!msg || msg.sourceId === TAB_ID) return;
    if (msg.type !== type) return;
    handler(msg.payload, msg);
  };

  const onStorage = (e) => {
    if (e.key !== "__cart_bus_ping" || !e.newValue) return;
    try {
      const msg = JSON.parse(e.newValue);
      if (msg.sourceId === TAB_ID) return;
      if (msg.type !== type) return;
      handler(msg.payload, msg);
    } catch {}
  };

  const onBC = (msg) => {
    if (!msg || msg.sourceId === TAB_ID) return;
    if (msg.type !== type) return;
    handler(msg.payload, msg);
  };

  window.addEventListener(`cart:${type}`, onWindow);
  window.addEventListener("storage", onStorage);
  channel?.addEventListener?.("message", (ev) => onBC(ev.data));

  // ביטול
  return () => {
    window.removeEventListener(`cart:${type}`, onWindow);
    window.removeEventListener("storage", onStorage);
    // אין removeListener ב־BroadcastChannel, נסגור לחלוטין אם רוצים
    // (לא חובה כאן; אפשר להשאיר פתוח גלובלית)
  };
}

function safeClone(obj) {
  try { return structuredClone(obj); } catch {}
  try { return JSON.parse(JSON.stringify(obj)); } catch {}
  return obj;
}

export const cartBus = {
  publish,
  subscribe,
  TAB_ID,
};
