import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "../../csscom/admin/AdminDashboard.css";

export default function RequireAdmin({ children }) {
  const loc = useLocation();
  const { user: me } = useAuth();
  const hasToken = !!localStorage.getItem("auth_token");

  // יש טוקן אבל אין עדיין me → מסך לודינג עם אותו רקע
  if (hasToken && !me) {
    return (
      <div dir="rtl" className="admin-shell">
        <div className="admin-shell-inner" style={{ display: "contents" }}>
          <main
            className="admin-shell-main"
            style={{
              gridTemplateRows: "1fr",
              placeItems: "center",
              display: "grid",
            }}
          >
            <div className="adm-panel" style={{ textAlign: "center" }}>
              טוען הרשאות…
            </div>
          </main>
        </div>
      </div>
    );
  }

  // לא מחוברת → למסך התחברות
  if (!me) {
    return <Navigate to="/account?step=login" replace state={{ from: loc }} />;
  }

  // לא אדמין → הביתה
  if (String(me.role || "").toUpperCase() !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  // הכול טוב → מציג את תתי־המסכים (AdminLayout)
  return children;
}
