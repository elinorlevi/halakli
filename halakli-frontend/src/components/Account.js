import { useEffect, useState, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping } from "@fortawesome/free-solid-svg-icons";
import { faUser } from "@fortawesome/free-regular-svg-icons";
import "../csscom/Account.css";
import ShoppingCart from "../components/Shoppingcart";
import SiteFooter from "./SiteFooter";
import { useCart } from "../contexts/CartContext"; // ✅ משתמשים בקונטקסט הסל
import UserMenu from "../components/UserMenu";
import "../csscom/Usermenu.css";
import { useAuth } from "../contexts/AuthContext";

/* ===================== API (module-scope) ===================== */
let BASE = "http://localhost:4000";
/* eslint-disable no-undef */
try {
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) {
    BASE = import.meta.env.VITE_API_BASE;
  }
} catch (_) {}
/* eslint-enable no-undef */
if (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) {
  BASE = process.env.REACT_APP_API_BASE;
}
async function jsonFetch(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  users: {
    exists: (email) => jsonFetch(`/api/users/exists?email=${encodeURIComponent(email)}`),
    login:    ({ email, password }) => jsonFetch(`/api/users/login`,    { method: "POST", body: { email, password } }),
    register: (payload)             => jsonFetch(`/api/users/register`, { method: "POST", body: payload } ),
    me: (token) => jsonFetch(`/api/users/me`, { token }),
    forgot: ({ email }) => jsonFetch(`/api/users/password/forgot`, { method: "POST", body: { email } }),
    reset:  ({ token, new_password }) => jsonFetch(`/api/users/password/reset`, { method: "POST", body: { token, new_password } })
  }
};

function saveToken(t){ localStorage.setItem("auth_token", t); }
function getToken(){ return localStorage.getItem("auth_token"); }
function clearToken(){ localStorage.removeItem("auth_token"); }
function saveLastEmail(v){ try { localStorage.setItem("last_reset_email", v); } catch {} }
function getLastEmail(){ try { return localStorage.getItem("last_reset_email") || ""; } catch { return ""; } }

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasNumber  = /\d/;
const hasSpecial = /[!@#$%^&*()[\]{};:'",.<>/?\\+=_\-]/;

/* ===================== Main Component ===================== */
export default function Account({}) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPersisted =
  typeof window !== "undefined" &&
  localStorage.getItem("isAdminView") === "1";
const adminSuffix = isAdminPersisted ? "?admin=1&bare=1" : "";

const { items, setQty, remove, count } = useCart();
const { loginWithToken, setUser } = useAuth();


  const initialEmailFromLink =
    (location.state && location.state.email) ||
    new URLSearchParams(location.search).get("email") ||
    getLastEmail();

  const initialStep = new URLSearchParams(location.search).get("step") || "email";
  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState(() => (initialEmailFromLink || "").trim().toLowerCase());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // אם הגיע אימייל ב־URL/State – נשמור גם ב־localStorage
  useEffect(() => {
    if (email) saveLastEmail(email);
  }, [email]);


  // ודא שאין קלאס וריאנט חנות כשמגיעים למסך החשבון
  useEffect(() => {
    document.body.classList.remove("header-variant-shop");
  }, []);

function isAdminOnly(u) {
  return String(u?.role ?? "").trim().toUpperCase() === "ADMIN";
}



 useEffect(() => {
  const onStorage = (e) => {
    if (e.key === "auth_token") {
      const t = getToken();
      if (!t) setMe(null);
      else api.users.me(t).then(setMe).catch(() => setMe(null));
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}, []);


  const [me, setMe] = useState(null);

  // סנכרון אימייל ל-localStorage בכל שינוי
  useEffect(() => {
    const clean = (email || "").trim().toLowerCase();
    if (clean) saveLastEmail(clean);
  }, [email]);

  // בדיקת קיום אימייל מול השרת
  async function checkEmailExists(mail) {
    const { exists } = await api.users.exists(mail);
    return { exists };
  }

  // המשך משלב אימייל
  async function handleEmailSubmit(e) {
    e.preventDefault();
    setErr("");
    const clean = (email || "").trim().toLowerCase();
    if (!emailRe.test(clean)) return setErr("האימייל לא תקין");
    setLoading(true);
    try {
      saveLastEmail(clean);
      const { exists } = await checkEmailExists(clean);
      setStep(exists ? "login" : "register");
    } catch {
      setErr("שגיאה בבדיקת אימייל, נסי שוב");
    } finally {
      setLoading(false);
    }
  }

  // ניקוי קלאסים + גלילה לראש
  useEffect(() => {
    document.body.classList.remove("header-variant-shop");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

    useEffect(() => {
  const t = getToken();
  if (!t) { setMe(null); return; }
  api.users.me(t).then(setMe).catch(() => setMe(null));
}, []);

  // סנכרון step -> URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const current = params.get("step") || "email";
    if (current !== step) {
      params.set("step", step);
      navigate({ pathname: location.pathname, search: params.toString() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // טעינת אימייל אחרון כשנכנסים למסך login
  useEffect(() => {
    if (step === "login") {
      const last = getLastEmail();
      if (last) setEmail(last);
    }
  }, [step]);

  // סנכרון URL -> step (לחיצות אחורה/קדימה)
  useEffect(() => {
    const s = new URLSearchParams(location.search).get("step") || "email";
    if (s !== step) setStep(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // סגור מגירה כשמחליפים נתיב (ליתר בטחון)
  useEffect(() => {
    setActive(false);
  }, [location.pathname]);

  // נעילת גלילה כשמגירה פתוחה
  useEffect(() => {
    const body = document.body;
    if (active) {
      const y = window.scrollY || 0;
      body.style.position = "fixed";
      body.style.top = `-${y}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.classList.add("menu-open");
      const onEsc = (e) => e.key === "Escape" && setActive(false);
      window.addEventListener("keydown", onEsc);
      return () => window.removeEventListener("keydown", onEsc);
    } else {
      const top = Math.abs(parseInt(body.style.top || "0", 10)) || 0;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      if (top) window.scrollTo(0, top);
      body.classList.remove("menu-open");
    }
  }, [active]);

  return (
    <>
      {/* 🔔 אותו רכיב עגלה — מקבל פריטים ופעולות מהקונטקסט */}
      <ShoppingCart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        onQtyChange={(id, nextQty, shade) => setQty(id, shade, Number(nextQty) || 0)}
        onRemove={(id, shade) => remove(id, shade)}
        onCheckout={() => setCartOpen(false)}
        freeShippingThreshold={699}
      />

      {/* TOPBAR – סטטי לעמוד ACCOUNT */}
      <div className="topbar topbar--static">
        <div className="topbar__bar" aria-hidden="true" />
        <img src="/blacklogo.png" alt="Halakli" className="topbar__logo" />
        <div className="account-topbar__icons">
       <button
  type="button"
  aria-label={`פתח עגלה (${count} פריטים)`}
  className="account-icon--cart"
  onClick={() => setCartOpen(true)}
>
  <FontAwesomeIcon icon={faCartShopping} className="account-icon" />
  {count > 0 && (
    <span className="cart-badge" aria-hidden="true">{count}</span>
  )}
</button>

{me ? (
  <UserMenu
    user={me}
    onLogout={() => {
      clearToken();      // יש לך פונקציה כזו בקובץ
      setMe(null);
    }}
  />
) : (
  <FontAwesomeIcon
    icon={faUser}
    className="account-icon account-icon--user"
    role="button"
    tabIndex={0}
    onClick={() => navigate("/account?step=login")}
    onKeyDown={(e) => e.key === "Enter" && navigate("/account?step=login")}
  />
)}
{isAdminOnly(me) && (
  <button
    type="button"
    className="account-admin-link"
    onClick={() => navigate("/admin")}
    style={{
      marginInlineStart: 8,
      padding: "6px 10px",
      border: "1px solid #ddd",
      borderRadius: 8,
      background: "#fff",
      cursor: "pointer"
    }}
    title="לוח ניהול"
  >
    לוח ניהול
  </button>
)}



          <div
            className={`account-hamburger ${active ? "active" : ""}`}
            tabIndex={1}
            onClick={() => setActive(v => !v)}
          >
            <div className="account-hamburger__line" />
            <div className="account-hamburger__line" />
            <div className="account-hamburger__line" />
            <span className="account-menu__label">MENU</span>
          </div>
        </div>
      </div>

      {/* Overlay + מגירת תפריט */}
      <div
        className={`menu-backdrop ${active ? "show" : ""}`}
        onClick={() => setActive(false)}
        aria-hidden={!active}
      />
      <aside
        id="mobileMenu"
        className={`menu-drawer ${active ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobileMenuTitle"
      >
        <nav className="drawer-nav" aria-label="תפריט ראשי">
          <br /><br /><br />
          <ul onClick={() => setActive(false)}>
  <li className="drawer-sep" aria-hidden="true"></li>
  <li><Link to={`/products${adminSuffix}`}>כל המוצרים</Link></li>
  <li><Link to={`/smooties${adminSuffix}`}>החלקות ביתיות</Link></li>
  <li><Link to={`/kits${adminSuffix}`}>ערכות ביתיות</Link></li>
  <li><Link to={`/productshair${adminSuffix}`}>מוצרי שיער</Link></li>
                <br></br>     <br></br>     <br></br>     <br></br>

  <li className="drawer-sep" aria-hidden="true"></li>
  <li><Link to={`/vlog${adminSuffix}`}>בלוג</Link></li>
  <li><Link to={`/qa${adminSuffix}`}>שאלות תשובות</Link></li>
            <li><a href="#about">about me</a></li>
          </ul>
        </nav>
      </aside>
      {/* תוכן העמוד */}
      <main className="acct-wrap">
        {step === "email" && (
          <section className="acct-section">
            <nav className="acct-breadcrumb" aria-label="breadcrumb" dir="rtl">
              <ol>
                <li><Link to="/">דף הבית</Link></li>
                <li aria-current="page">החשבון שלי</li>
              </ol>
            </nav>
            <h1 className="acct-h1">MY HALAKLI ACCOUNT </h1>
            <p className="acct-sub">התחברי עם האימייל והסיסמה שלך, או צרי פרופיל אם זו הפעם הראשונה</p>

            <form onSubmit={handleEmailSubmit} className="acct-form">
              <label className="acct-label">אימייל*</label>
              <input
                type="email"
                className="acct-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                inputMode="email"
                autoComplete="email"
              />
              {err && <div className="acct-error">{err}</div>}
              <button type="submit" className="acct-btn" disabled={loading}>
                {loading ? "בודק..." : "המשך"}
              </button>
            </form>

            <div className="acct-benefits">
              <h2 className="acct-mini-title">JOIN HALAKLI</h2>
              <ul className="acct-benefits-grid">
                <li>
                  <strong>החלקות ביתיות</strong>
                  <p>.החלקות מותאמות אישית, שמירה על בריאות השיער וברק</p>
                </li>
                <li>
                  <strong>ייעול תהליך התשלום</strong>
                  <p>.תשלום מהיר עם שיטות תשלום שמורות</p>
                </li>
                <li>
                  <strong>קבע תור</strong>
                  <p>.שרייני תור במספרה בזמן שנוח לך</p>
                </li>
              </ul>
            </div>
          </section>
        )}

{step === "login" && (
  <LoginForm
    email={email}
    onBack={() => setStep("email")}
    onSuccess={async ({ token }) => {
      try {
        // שמירה מפורשת כדי שה־storage event יתפוס בכל הטאבים
        saveToken(token);

        // מעדכן את ה־AuthContext (הפונקציה שלך)
        loginWithToken(token);

        // שולפים את המשתמש העדכני
        const u = await api.users.me(token).catch(() => null);

        // מעדכנים גם את הקונטקסט וגם את ה־state המקומי כדי שה־UI יתעדכן מייד
        if (u && typeof setUser === "function") setUser(u);
        if (u) setMe(u);

navigate(isAdminOnly(u) ? "/admin" : "/");      } catch {
        navigate("/");
      }
    }}
    onForgot={() => setStep("forgot")}
  />
)}



{step === "register" && (
  <RegisterForm
    email={email}
    onBack={() => setStep("email")}
    onSuccess={async ({ token }) => {
      try {
        saveToken(token);
        loginWithToken(token);
        const u = await api.users.me(token).catch(() => null);
        if (u && typeof setUser === "function") setUser(u);
        if (u) setMe(u);
navigate(isAdminOnly(u) ? "/admin" : "/");      } catch {
        navigate("/");
      }
    }}
  />
)}


{step === "forgot" && (
  <ForgotForm
    email={email}
    onBack={() => setStep("login")}
  />
)}

      </main>
 <SiteFooter />
    </>
  );
}

/* ===================== Forms ===================== */
function LoginForm({ email, onBack, onSuccess, onForgot }) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  // מתיר רק תווים מודפסים באנגלית (ASCII 0x20–0x7E)
  const asciiOnly = (s) => s.replace(/[^\u0020-\u007E]/g, "");

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { token } = await api.users.login({ email, password });
 onSuccess?.({ token });
    } catch (error) {
      if (error?.status === 401 || error?.status === 400) {
        setErr("אימייל או סיסמה שגויים");
      } else {
        setErr("לא ניתן להתחבר כרגע. נסי שוב מאוחר יותר");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="acct-section">
      <button className="acct-back" type="button" onClick={onBack}>חזרה</button>

      <h1 className="acct-h1">CONTINUE WITH YOUR EMAIL ADDRESS</h1>
      <p className="acct-sub">היכנס באמצעות כתובת הדוא"ל והסיסמה שלך</p>

      <form onSubmit={handleLogin} className="acct-form">
        {/* Email (read only) */}
        <label className="acct-label">אימייל*</label>
        <div className="acct-field acct-field--email">
          <input
            type="email"
            className="acct-input acct-input--readonly"
            dir="ltr"
            value={email}
            readOnly
            required
          />
        </div>

        {/* Password + eye */}
        <label className="acct-label">סיסמא*</label>
        <div className="acct-field acct-field--password">
          <input
            type={showPass ? "text" : "password"}
            className="acct-input acct-input--password"
            placeholder="Password*"
            value={password}
            onChange={(e) => setPassword(asciiOnly(e.target.value))}
            autoComplete="current-password"
            dir="ltr"
            pattern="^[ -~]+$"
            title="סיסמה באנגלית בלבד (אותיות/מספרים/תווי ASCII)"
            required
          />
          <button
            type="button"
            className="acct-eye"
            aria-label={showPass ? "Hide password" : "Show password"}
            aria-pressed={showPass}
            onClick={() => setShowPass(v => !v)}
          >
            {/* eye-off */}
            <svg className="eye-off" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {/* eye-on */}
            <svg className="eye-on" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        {/* שכחת סיסמה */}
        <a
          href="#forgot"
          className="acct-link"
          onClick={(e) => { e.preventDefault(); onForgot?.(); }}
        >
          שכחת סיסמא?
        </a>

        {err && <div className="acct-error">{err}</div>}

        <button type="submit" className="acct-btn" disabled={loading || !password}>
          {loading ? "...נכנס" : "כניסה"}
        </button>
      </form>

      <div className="acct-benefits">
        <h2 className="acct-mini-title">JOIN HALAKLI</h2>
        <ul className="acct-benefits-grid">
          <li>
            <strong>החלקות ביתיות</strong>
            <p>.החלקות מותאמות אישית, שמירה על בריאות השיער וברק</p>
          </li>
          <li>
            <strong>ייעול תהליך התשלום</strong>
            <p>.תשלום מהיר עם שיטות תשלום שמורות</p>
          </li>
          <li>
            <strong>קבע תור</strong>
            <p>.שרייני תור במספרה בזמן שנוח לך</p>
          </li>
        </ul>
      </div>
    </section>
  );
}

function ForgotForm({ email: initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function handleForgot(e) {
    e.preventDefault();
    setErr("");
    setSent(false);

    const clean = (email || "").trim().toLowerCase();
    if (!emailRe.test(clean)) {
      setErr("האימייל לא תקין");
      return;
    }

    setLoading(true);
    try {
      const { exists } = await api.users.exists(clean);
      if (!exists) {
        setErr("לא נמצא חשבון עם האימייל הזה");
        return;
      }

      await api.users.forgot({ email: clean });
      localStorage.setItem("last_reset_email", clean);
      setSent(true);
    } catch (error) {
      setErr(error.message || "לא ניתן לשלוח כרגע. נסי שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="acct-section">
      <button className="acct-back" type="button" onClick={onBack}>חזרה</button>
      <h1 className="acct-h1">איפוס סיסמה</h1>
      <p className="acct-sub">.הזיני את כתובת האימייל ונשלח לך קישור לאיפוס</p>

      <form onSubmit={handleForgot} className="acct-form">
        <label className="acct-label">אימייל*</label>
        <input
          type="email"
          className="acct-input"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          inputMode="email"
          autoComplete="email"
        />

        {err && <div className="acct-error">{err}</div>}
        {sent && <div className="acct-success"> שלחנו קישור לאיפוס סיסמה </div>}

        <button type="submit" className="acct-btn" disabled={loading}>
          {loading ? "שולח..." : "שליחת קישור איפוס"}
        </button>
      </form>
    </section>
  );
}

function RegisterForm({ email, onBack, onSuccess }) {
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [mm, setMm] = useState("");
  const [dd, setDd] = useState("");
  const [yyyy, setYyyy] = useState("");
  const [phone, setPhone] = useState("");   // אופציונלי
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [p3, setP3] = useState("");
  const [p7, setP7] = useState("");
  const p3Ref = useRef(null);
  const p7Ref = useRef(null);

  const digits = (s) => s.replace(/\D/g, "");
  const passOk = password.length >= 8 && hasNumber.test(password) && hasSpecial.test(password);

  function onP3Change(e){
    const v = digits(e.target.value).slice(0, 3);
    setP3(v);
    setPhone(v + p7);
    if (v.length === 3) p7Ref.current?.focus();
  }
  function onP7Change(e){
    const v = digits(e.target.value).slice(0, 7);
    setP7(v);
    setPhone(p3 + v);
  }
  function onP7KeyDown(e){
    if (e.key === "Backspace" && e.currentTarget.selectionStart === 0 && !p7){
      p3Ref.current?.focus();
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setErr("");

    if (!passOk) return setErr("הסיסמה לא עומדת בדרישות");
    if (!(mm && dd && yyyy)) return setErr("מלאי תאריך לידה");

    const mm2 = String(mm).padStart(2, "0");
    const dd2 = String(dd).padStart(2, "0");
    const birth_date = `${yyyy}-${mm2}-${dd2}`;
  setLoading(true);
  try {
    const payload = {
      first_name: first,
      last_name: last,
      email,
      password,
      birth_date,
      phone,
    };

    const { token } = await api.users.register(payload);
    onSuccess?.({ token });     // ⬅️ מעבירים טוקן להורה

  } catch (error) {
    setErr(
      error?.status === 409
        ? "האימייל כבר קיים. נסי להתחבר."
        : (error?.message || "לא ניתן להשלים הרשמה כרגע")
    );
  } finally {
    setLoading(false);
  }
}
  const mmRef = useRef(null);
  const ddRef = useRef(null);
  const yyyyRef = useRef(null);

  const onlyDigits = (s) => s.replace(/\D/g, "");

 function onDDChange(e) {
  const v = onlyDigits(e.target.value).slice(0, 2);
  setDd(v);
  if (v.length === 2) mmRef.current?.focus(); // אחרי DD → MM
}

function onMMChange(e) {
  const v = onlyDigits(e.target.value).slice(0, 2);
  setMm(v);
  if (v.length === 2) yyyyRef.current?.focus(); // אחרי MM → YYYY
}

function onYYYYChange(e) {
  const v = onlyDigits(e.target.value).slice(0, 4);
  setYyyy(v);
}
  /* חזרה לשדה הקודם כשהשדה ריק ולוחצים Backspace */
  function onBackspaceNav(e, prevRef){
    if (e.key === "Backspace" && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0){
      prevRef?.current?.focus();
    }
  }

  const mmOk   = /^(0[1-9]|1[0-2])$/.test(mm);
  const ddOk   = /^(0[1-9]|[12]\d|3[01])$/.test(dd);
  const yyyyOk = /^\d{4}$/.test(yyyy);

  // טלפון: לא חובה. אם התחילו למלא — חייב 3+7 ספרות
  const phoneProvided = (p3?.length || 0) > 0 || (p7?.length || 0) > 0;
  const phoneOk = !phoneProvided || (p3.length === 3 && p7.length === 7);

  const allFilled =
    passOk &&
    first.trim().length > 0 &&
    last.trim().length  > 0 &&
    mm.length === 2 &&
    dd.length === 2 &&
    yyyy.length === 4;

  const allValid = Boolean(allFilled && phoneOk);

  return (
    <section className="acct-section">
      <button className="acct-back" type="button" onClick={onBack}>חזרה</button>
      <h1 className="acct-h1">MY HALAKLI ACCOUNT</h1>
      <p className="acct-sub">.צרי פרופיל חדש  <strong>{email}</strong> לא מצאנו חשבון עבור</p>

      <form onSubmit={handleRegister} className="acct-form">
        <label className="acct-label">אימייל*</label>
        <input type="email" className="acct-input" value={email} readOnly required />

        <label className="acct-label">סיסמה*</label>
        <div className="acct-field acct-field--password">
          <input
            type={showPass ? "text" : "password"}
            className="acct-input acct-input--password"
            placeholder="מינ' 8 תווים, מספר ותו מיוחד"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="acct-eye"
            aria-label={showPass ? "הסתר סיסמה" : "הצג סיסמה"}
            aria-pressed={showPass}
            onClick={() => setShowPass(v => !v)}
          >
            {/* eye-off */}
            <svg className="eye-off" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {/* eye-on */}
            <svg className="eye-on" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        <ul className="acct-rules">
          <li className={password.length >= 8 ? "ok" : ""}>לפחות 8 תווים</li>
          <li className={hasNumber.test(password) ? "ok" : ""}>ספרה אחת לפחות</li>
          <li className={hasSpecial.test(password) ? "ok" : ""}>תו מיוחד אחד לפחות (!, +, -, /, ? …)</li>
        </ul>

        {/* שם פרטי */}
        <label className="acct-label">שם פרטי*</label>
        <input
          className="acct-input acct-input--rtl"
          value={first}
          onChange={(e) => setFirst(e.target.value)}
          required
        />

        {/* שם משפחה */}
        <label className="acct-label">שם משפחה*</label>
        <input
          className="acct-input acct-input--rtl"
          value={last}
          onChange={(e) => setLast(e.target.value)}
          required
        />

        {/* תאריך לידה */}
        <label className="acct-label">תאריך לידה*</label>
        <div className="acct-dob">
         

         {/* DD */}
<input
  ref={ddRef}
  className="acct-input"
  placeholder="DD*"
  value={dd}
  onChange={onDDChange}                  // כשממלאים 2 ספרות → עובר ל-MM
  onKeyDown={(e) => onBackspaceNav(e, null)}   // אין לאן לחזור לפני DD
  inputMode="numeric"
  dir="ltr"
  maxLength={2}
  pattern="^[0-9]{2}$"
  required
/>

{/* MM */}
<input
  ref={mmRef}
  className="acct-input"
  placeholder="MM*"
  value={mm}
  onChange={onMMChange}                  // כשממלאים 2 ספרות → עובר ל-YYYY
  onKeyDown={(e) => onBackspaceNav(e, ddRef)}  // Backspace ריק → חזרה ל-DD
  inputMode="numeric"
  dir="ltr"
  maxLength={2}
  pattern="^[0-9]{2}$"
  required
/>

{/* YYYY */}
<input
  ref={yyyyRef}
  className="acct-input"
  placeholder="YYYY"
  value={yyyy}
  onChange={onYYYYChange}                // אין קפיצה קדימה
  onKeyDown={(e) => onBackspaceNav(e, mmRef)}  // Backspace ריק → חזרה ל-MM
  inputMode="numeric"
  dir="ltr"
  maxLength={4}
  pattern="^[0-9]{4}$"
  required
/>

        </div>

        {/* מספר פלאפון – לא חובה */}
        <label className="acct-label">מספר פלאפון (לא חובה)</label>
        <div className="acct-phone" dir="ltr">
          <input
            ref={p3Ref}
            type="tel"
            className="acct-input acct-input--digits"
            placeholder="XXX"
            value={p3}
            onChange={onP3Change}
            inputMode="numeric"
            maxLength={3}
            pattern="^05[0-9]$"
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
          />
        </div>

        {err && <div className="acct-error">{err}</div>}

        {/* הסכמות */}
        <div className="acct-consents" dir="rtl">
          <label className="acct-check">
            <input type="checkbox" name="accept_terms" required />
            <span>
              אני מאשר/ת את <a href="/terms" target="_blank" rel="noopener">תנאי השימוש</a> באתר
            </span>
          </label>

          <label className="acct-check">
            <input type="checkbox" name="marketing_optin" />
            <span>
              אני רוצה לקבל מ־HALAKLI מידע ופרסומים על הטבות ועדכונים באמצעי תקשורת שונים
              (דוא״ל / SMS / וואטסאפ וכד׳). אפשר לבטל בכל עת. למידע נוסף ראו את
              <a href="/privacy" target="_blank" rel="noopener"> מדיניות הפרטיות</a>.
            </span>
          </label>
        </div>

        <button type="submit" className="acct-btn" disabled={loading || !allValid}>
          {loading ? "...יוצר פרופיל" : "כניסה"}
        </button>
      </form>
    </section>
  );
}
