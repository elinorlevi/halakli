// src/components/admin/AdminLayout.jsx
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useState, useEffect } from "react";
import "../../csscom/admin/AdminDashboard.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  faChartSimple,
  faBookOpen,
  faListCheck,
  faArrowRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../contexts/AuthContext";

function isMobileScreen() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  // בדסקטופ: פתוח, במובייל: סגור
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobileScreen());

  // רספונסיביות לפי שינוי גודל מסך
  useEffect(() => {
    function handleResize() {
      if (isMobileScreen()) {
        setSidebarOpen(false); // במובייל כברירת מחדל – סגור
      } else {
        setSidebarOpen(true); // בדסקטופ תמיד פתוח
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // סגירת התפריט אוטומטית בכל מעבר מסך במובייל
  useEffect(() => {
    if (isMobileScreen()) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  function handleLogout(e) {
    e.preventDefault();
    try {
      logout();
      localStorage.removeItem("isAdminView");
      navigate("/account?step=login", { replace: true });
    } catch (err) {
      console.error("logout failed", err);
    }
  }

  return (
    <div dir="rtl" className="admin-shell">
      <div className="admin-shell-inner">
        {/* סיידבר – בדסקטופ תמיד מוצג, במובייל תלוי ב־sidebarOpen */}
        {sidebarOpen && (
          <aside className="admin-shell-aside">
            <div className="adm-user-header">
              <div className="adm-user-text">
                <div className="adm-user-line1">
                  <img
                    src="/whitelogo.png"
                    alt="Halakli"
                    className="adm-user-logo"
                  />
                </div>
                <div className="adm-user-line2">קארין ניקיטין</div>
              </div>

              <div className="adm-user-avatar">
                <img src="/karin.png" alt="profile" />
              </div>

              {/* חץ סגירה – מוצג רק במובייל לפי CSS (.admin-menu-toggle) */}
              <button
                type="button"
                className="admin-menu-toggle admin-menu-toggle--close"
                onClick={() => setSidebarOpen(false)}
                aria-label="סגירת תפריט ניהול"
              >
                ‹
              </button>
            </div>

            <div className="admin-nav-list">
              {/* דשבורד */}
              <NavLink
                end
                to="/admin"
                className={({ isActive }) =>
                  isActive ? "adm-link is-active" : "adm-link"
                }
                onClick={() => isMobileScreen() && setSidebarOpen(false)}
              >
                <div className="adm-link-main">
                  <span className="adm-link-icon">
                    <FontAwesomeIcon icon={faChartSimple} />
                  </span>
                  <span className="adm-link-text">הכנסות ונתונים</span>
                </div>
                <div className="adm-link-side" />
              </NavLink>

              {/* ניהול הזמנות */}
              <NavLink
                to="/admin/orders"
                className={({ isActive }) =>
                  isActive ? "adm-link is-active" : "adm-link"
                }
                onClick={() => isMobileScreen() && setSidebarOpen(false)}
              >
                <div className="adm-link-main">
                  <span className="adm-link-icon">
                    <FontAwesomeIcon icon={faListCheck} />
                  </span>
                  <span className="adm-link-text">ניהול הזמנות</span>
                </div>
                <div className="adm-link-side" />
              </NavLink>

              {/* ניהול מוצרים */}
              <NavLink
                to="/admin/products"
                className={({ isActive }) =>
                  isActive ? "adm-link is-active" : "adm-link"
                }
                onClick={() => isMobileScreen() && setSidebarOpen(false)}
              >
                <div className="adm-link-main">
                  <span className="adm-link-icon">
                    <FontAwesomeIcon icon={faPlus} className="adm-icon-thick" />
                  </span>
                  <span className="adm-link-text">ניהול מוצרים</span>
                </div>
                <div className="adm-link-side" />
              </NavLink>

              {/* ניהול וולוגים */}
              <NavLink
                to="/admin/vlogs"
                className={({ isActive }) =>
                  isActive ? "adm-link is-active" : "adm-link"
                }
                onClick={() => isMobileScreen() && setSidebarOpen(false)}
              >
                <div className="adm-link-main">
                  <span className="adm-link-icon">
                    <FontAwesomeIcon icon={faBookOpen} />
                  </span>
                  <span className="adm-link-text">ניהול וולוגים</span>
                </div>
                <div className="adm-link-side" />
              </NavLink>

              <br />
              <span className="hl-divider" />

              {/* התנתקות */}
              <Link
                to="/"
                className="adm-link"
                style={{ marginTop: 20 }}
                onClick={handleLogout}
              >
                <div className="adm-link-main">
                  <span className="adm-link-icon">
                    <FontAwesomeIcon icon={faArrowRightFromBracket} />
                  </span>
                  <span className="adm-link-text">התנתקי</span>
                </div>
                <div className="adm-link-side" />
              </Link>
            </div>
          </aside>
        )}

        {/* כפתור פתיחה צף – מוצג רק במובייל כשהסיידבר סגור */}
        {!sidebarOpen && (
          <button
            type="button"
            className="admin-menu-toggle admin-menu-toggle--floating"
            onClick={() => setSidebarOpen(true)}
            aria-label="פתיחת תפריט ניהול"
          >
            ›
          </button>
        )}

        {/* אזור התוכן */}
        <main className="admin-shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
