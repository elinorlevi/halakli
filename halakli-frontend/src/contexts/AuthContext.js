// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthCtx = createContext(null);

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  ""; // "" => אותו origin (אם יש proxy), אחרת "http://localhost:4000"

function getToken() { return localStorage.getItem("auth_token") || null; }
function setToken(t) { t ? localStorage.setItem("auth_token", t) : localStorage.removeItem("auth_token"); }

async function fetchMe(token, { signal } = {}) {
  const res = await fetch(`${API_BASE}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (res.status === 401) throw new Error("UNAUTH");
  if (!res.ok) throw new Error("NET"); // שגיאת שרת/רשת אחרת
  return res.json();
}

export function AuthProvider({ children }) {
  const [token, setTok] = useState(getToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);

  // שימור token + משיכת me
  useEffect(() => {
    setToken(token);
    setUser(null);
    if (!token) { setLoading(false); return; }

    const ctrl = new AbortController();
    setLoading(true);
    fetchMe(token, { signal: ctrl.signal })
      .then(setUser)
      .catch((err) => {
        // מתנתקים רק אם זה 401 אמיתי; בשאר המקרים נשארים מחוברים עם user=null
        if (err?.message === "UNAUTH") {
          setTok(null);
          setUser(null);
        } else {
          // נפילת רשת/שרת – השאירי את ה-token כדי שלא "תעיפי" את המשתמש לריק
          setUser(null);
        }
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [token]);

  // סינכרון בין טאבים
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "auth_token") setTok(getToken());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({
    token,
    user,
    loading,
    loginWithToken: (t) => setTok(t), // שומר token וגורם ל-fetchMe לרוץ
    logout: () => setTok(null),
  }), [token, user, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() { return useContext(AuthCtx); }
