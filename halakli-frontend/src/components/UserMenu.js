// components/UserMenu.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser as faUserRegular } from "@fortawesome/free-regular-svg-icons"; // האייקון הישן
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

function getToken(){ return localStorage.getItem("auth_token"); }

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!btnRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => (e.key === "Escape") && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!getToken() || !user) return null;
// מציג שם פרטי (ואם קיים גם שם משפחה). נופל חזרה לאימייל אם חסר.
const displayName =
  [user.first_name ?? user.firstName?? user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim() || String(user.email || "").trim();

const shortEmail = String(user.email || "").trim(); // נשאר לטייטל/נגישות

  return (
    <div className="usermenu" dir="rtl">
      <button
        ref={btnRef}
        type="button"
        className={`usermenu__btn ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
        title={shortEmail}
      >
        {/* העיגול עם האייקון הישן */}
        <span className="usermenu__avatarCircle" aria-hidden="true">
          <FontAwesomeIcon icon={faUserRegular} />
        </span>
        {/* חץ קטן שמתהפך כשהתפריט פתוח */}
        <FontAwesomeIcon icon={faChevronDown} className="usermenu__chev" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="usermenu__panel"
          role="menu"
          aria-label="תפריט משתמש"
        >
<div className="usermenu__header">
  <span className="usermenu__email" title={`שלום ${displayName}`}>
    שלום {displayName}
  </span>

  {/* אייקון קטן מימין בהדר */}
  <span className="usermenu__headerAvatar" aria-hidden="true">
    <FontAwesomeIcon icon={faUserRegular} />
  </span>
</div>

          <div className="usermenu__sep" />

          <button
            className="usermenu__item"
            role="menuitem"
            onClick={() => { setOpen(false); nav("/account/dashboard"); }}
          >
           היסטוריית הזמנות
          </button>

          <button
            className="usermenu__item"
            role="menuitem"
            onClick={() => { setOpen(false); nav("/favorites"); }}
          >
           מועדפים
          </button>

       <button
  className="usermenu__item"
  role="menuitem"
  onClick={() => { setOpen(false); nav("/account/settings"); }}  // <-- היה /account/security
>
  הגדרות חשבון
</button>


          <button
            className="usermenu__item usrm--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              localStorage.removeItem("auth_token");
              onLogout?.();
              nav("/", { replace: true });
            }}
          >
            התנתק
          </button>
        </div>
      )}
    </div>
  );
}
