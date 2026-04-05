import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping } from "@fortawesome/free-solid-svg-icons";
import { faUser } from "@fortawesome/free-regular-svg-icons";

// חשוב: ב-Account.js צריך להיות export ל-api:
// export const api = { users: { ... } }
import { api } from "./Account";

import "../csscom/Account.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(useLocation().search).get("token") || "";
const location = useLocation();
const emailQS  = new URLSearchParams(location.search).get("email")  || "";
  
  const [active, setActive] = useState(false);
  
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



  // שתי עיניים נפרדות + סינון ASCII
  const [showNewPass, setShowNewPass]         = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const asciiOnly = (s) => s.replace(/[^\u0020-\u007E]/g, "");

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");
  const [done,     setDone]     = useState(false);

  const hasNumber  = /\d/;
  const hasSpecial = /[!@#$%^&*()[\]{};:'",.<>/?\\+=_\-]/;
  const passOk     = password.length >= 8 && hasNumber.test(password) && hasSpecial.test(password);
  const canSubmit  = token && passOk && password === confirm && !loading;

  async function handleReset(e){
    e.preventDefault();
    setErr("");

    if (!token)               return setErr("הקישור לא תקין (חסר token).");
    if (!passOk)              return setErr("הסיסמה לא עומדת בדרישות.");
    if (password !== confirm) return setErr("אימות הסיסמה אינו תואם.");

    try {
      setLoading(true);
      await api.users.reset({ token, new_password: password });  // מאפס ב-DB
      setDone(true);           // מציג "מסך חדש" של הצלחה
      setPassword("");
      setConfirm("");
      // אין ניווט אוטומטי — נשארים במסך ההצלחה
      // setTimeout(() => navigate("/account?step=login"), 2000);
 } catch (e) {
  // אם השרת החזיר invalid/expired – נציג הודעה בעברית
  const msg =
    (e?.status === 400 && /invalid|expired/i.test(e?.message || "")) ||
    /invalid|expired/i.test(String(e))
      ? "הקישור פג תוקף אנא בקשי קישור חדש לאיפוס"
      : (e?.message || "שגיאה בביצוע איפוס, נסי שוב.");

  setErr(msg);
} finally {
  setLoading(false);
}

  }

  useEffect(() => {
  if (!done) return;
  const rememberedEmail =
  emailQS || localStorage.getItem("last_reset_email") || "";

  const id = setTimeout(() => navigate("/account?step=login"), 2500);
  return () => clearTimeout(id);
}, [done, navigate]);



  return (
    <>
      {/* TOPBAR – סטטי לעמוד */}
      <div className="topbar topbar--static">
        <div className="topbar__bar" aria-hidden="true" />
        <img src="/blacklogo.png" alt="Halakli" className="topbar__logo" />
        <div className="account-topbar__icons">
          <FontAwesomeIcon icon={faCartShopping} size="2x" className="account-icon account-icon--cart" />
          <FontAwesomeIcon
            icon={faUser}
            className="account-icon account-icon--user"
            role="button"
            tabIndex={0}
            onClick={() => navigate("/account")}
            onKeyDown={(e) => e.key === "Enter" && navigate("/account")}
          />
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
          <br /><br /><br /><br /><br />
          <ul>
            <li className="drawer-sep" aria-hidden="true"></li>
            <li><a href="#men">כל המוצרים</a></li>
            <li><a href="#new">החלקות ביתיות</a></li>
            <li><a href="#hair">מוצרי שיער</a></li>
            <br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
            <li className="drawer-sep" aria-hidden="true"></li>
            <li><a href="#blogs">בלוג</a></li>
            <li><a href="#Q&A">שאלות תשובות</a></li>
            <li><a href="#about">about me</a></li>
          </ul>
        </nav>
      </aside>

      {/* תוכן העמוד */}
      <main className="acct-wrap">
        <section className="acct-section">
          <nav className="acct-breadcrumb" aria-label="breadcrumb" dir="rtl">
            <ol>
              <li><Link to="/">דף הבית</Link></li>
              <li><Link to="/account">החשבון שלי</Link></li>
              <li aria-current="page">איפוס סיסמה</li>
            </ol>
          </nav>

        {/* הכותרת תוצג רק לפני ההצלחה */}
      {!done && <h1 className="acct-h1">איפוס סיסמה</h1>}

          {!done ? (
            <>
              {!token && <div className="acct-error">חסר token בכתובת. בדקי את הקישור במייל.</div>}

              <form onSubmit={handleReset} className="acct-form">
                {/* סיסמה חדשה */}
                <label className="acct-label">סיסמה חדשה*</label>
                <div className="acct-field acct-field--password">
                  <input
                    type={showNewPass ? "text" : "password"}
                    className="acct-input acct-input--password"
                    placeholder="מינ' 8 תווים, מספר ותו מיוחד"
                    value={password}
                    onChange={(e) => setPassword(asciiOnly(e.target.value))}
                    autoComplete="new-password"
                    dir="ltr"
                    pattern="^[ -~]+$"
                    title="סיסמה באנגלית בלבד (אותיות/מספרים/תוים באנגלית)"
                    required
                  />
                  <button
                    type="button"
                    className="acct-eye"
                    aria-label={showNewPass ? "הסתר סיסמה" : "הצג סיסמה"}
                    aria-pressed={showNewPass}
                    onClick={() => setShowNewPass(v => !v)}
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

                {/* אימות סיסמה */}
                <label className="acct-label">אימות סיסמה*</label>
                <div className="acct-field acct-field--password">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    className="acct-input acct-input--password"
                    value={confirm}
                    onChange={(e) => setConfirm(asciiOnly(e.target.value))}
                    dir="ltr"
                    pattern="^[ -~]+$"
                    title="סיסמה באנגלית בלבד (אותיות/מספרים/תוים באנגלית)"
                    required
                  />
                  <button
                    type="button"
                    className="acct-eye"
                    aria-label={showConfirmPass ? "הסתר סיסמה" : "הצג סיסמה"}
                    aria-pressed={showConfirmPass}
                    onClick={() => setShowConfirmPass(v => !v)}
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
                  <li className={password.length >= 8 ? "ok" : ""}> לפחות 8 תווים באנגלית</li>
                  <li className={hasNumber.test(password) ? "ok" : ""}>ספרה אחת לפחות</li>
                  <li className={hasSpecial.test(password) ? "ok" : ""}>תו מיוחד אחד לפחות</li>
                  <li className={password && confirm && password === confirm ? "ok" : ""}>הסיסמאות תואמות</li>
                </ul>

                {err && <div className="acct-error">{err}</div>}

                <button type="submit" className="acct-btn" disabled={!canSubmit}>
                  {loading ? "מעדכן..." : "איפוס סיסמה"}
                </button>
              </form>
            </>
) : (
  <div
    className="success-card"
    role="status"
    aria-live="polite"
    style={{ maxWidth: 520, margin: "24px auto", textAlign: "center" }}
  >
    
    <div className="success-card__icon" aria-hidden>✓</div>

    {/* כותרת במקום "איפוס סיסמה" */}
    <h1 className="success-card__title" style={{ marginBottom: 8 }}>
      הסיסמה אופסה בהצלחה
    </h1>

    {/* שורת הסבר באפור */}
    <p className="success-card__text" style={{ color: "#777", marginBottom: 16 }}>
    ...כבר מעבירים אותך למסך ההתחברות
    </p>
  </div>
)}

        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer" dir="ltr" aria-labelledby="footer-heading">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src="/whitelogo.png" alt="Halakli" className="footer-logo" />
            <ul className="social">
              <li><a aria-label="Facebook" href="#fb">f</a></li>
              <li>
                <a aria-label="Tiktok" href="#tk">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="20" fill="currentColor">
                    <path d="M224 88.8a88.5 88.5 0 0 1-52-17.2V160a64 64 0 1 1-64-64 64.2 64.2 0 0 1 12.8 1.3v33.7a32 32 0 1 0 19.2 29.4V24h32a56 56 0 0 0 56 56Z"/>
                  </svg>
                </a>
              </li>
              <li>
                <a aria-label="Instagram" href="#ig">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="15" height="15" fill="currentColor">
                    <path d="M160 24H96A72.08 72.08 0 0 0 24 96v64a72.08 72.08 0 0 0 72 72h64a72.08 72.08 0 0 0 72-72V96a72.08 72.08 0 0 0-72-72Zm48 136a48.05 48.05 0 0 1-48 48H96a48.05 48.05 0 0 1-48-48V96A48.05 48.05 0 0 1 96 48h64a48.05 48.05 0 0 1 48 48Zm-80-80a56 56 0 1 0 56 56 56.06 56.06 0 0 0-56-56Zm0 88a32 32 0 1 1 32-32 32 32 0 0 1-32 32Zm52-92a12 12 0 1 1 12-12 12 12 0 0 1-12 12Z"/>
                  </svg>
                </a>
              </li>
            </ul>
          </div>

          <nav className="footer-col" aria-label="About Us">
            <h4 className="footer-title">מידע</h4>
            <ul className="footer-list">
              <li><a href="#who">יצירת קשר</a></li>
              <li><a href="#what">שאלות תשובות</a></li>
              <li><a href="#portfolio">תקנון</a></li>
              <li><a href="#partners">הצהרת נגישות</a></li>
              <li><a href="#news">ביטול עסקה</a></li>
              <li><a href="#events">מדיניות הפרטיות</a></li>
              <li><a href="#blog">בלוג</a></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Our Offices">
            <h4 className="footer-title">כללי</h4>
            <ul className="footer-list offices">
              <li><a href="#who">ABOUT ME</a></li>
              <li><a href="#who">חנות</a></li>
            </ul>
          </nav>

          <nav className="footer-col" aria-label="Salon location">
            <h4 className="footer-title">מיקום המספרה</h4>
            <strong className="location">קרית עקרון, רבי מאיר בעל הנס 36</strong><br />
            <strong><a className="location">972-52-3647-207+</a></strong><br />
          </nav>
        </div>

        <div className="map-embed" aria-label="מפת גוגל של המספרה">
          <iframe
            title="Halakli – מיקום במספרה"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps?q=%D7%A7%D7%A8%D7%99%D7%AA%20%D7%A2%D7%A7%D7%A8%D7%95%D7%9F%2C%20%D7%A8%D7%91%D7%99%20%D7%9E%D7%90%D7%99%D7%A8%20%D7%91%D7%A2%D7%9C%20%D7%94%D7%A0%D7%A1%2036&hl=iw&z=16&output=embed"
            allowFullScreen
          ></iframe>
        </div>

        <div className="footer-bottom">
          <p className="copy"> ©digitle studio עיצוב ובנייה ע"י </p>
        </div>
      </footer>
    </>
  );
}

