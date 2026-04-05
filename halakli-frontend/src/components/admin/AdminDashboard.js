import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ---------------- helpers ----------------
function monthNameHE(mIdx) {
  const names = [
    "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
    "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"
  ];
  return names[mIdx] || "";
}

function buildLabelForRange(point, range) {
  if (range === "day") {
    if (point.hour != null) {
      const h = String(point.hour).padStart(2, "0");
      return `${h}:00`;
    }
    if (point.bucket) {
      const parts = point.bucket.split(" ");
      if (parts[1]) return parts[1];
    }
    return point.bucket || point.key || "";
  }

  if (range === "month") {
    let yyyy, mm, dd;
    const src = point.day || point.bucket;
    if (src) {
      const parts = src.split("-");
      yyyy = parts[0];
      mm   = parts[1];
      dd   = parts[2];
    }
    if (dd && mm && yyyy) {
      const monthIdx = Number(mm) - 1;
      return `${dd} ${monthNameHE(monthIdx)}`;
    }
    return point.bucket || point.key || "";
  }

  if (range === "year") {
    if (point.month_idx != null && point.year != null) {
      return `${monthNameHE(point.month_idx)} ${point.year}`;
    }
    if (point.bucket) {
      const [yyyy, mm] = point.bucket.split("-");
      if (yyyy && mm) {
        return `${monthNameHE(Number(mm) - 1)} ${yyyy}`;
      }
    }
    return point.bucket || point.key || "";
  }

  return point.bucket || point.key || "";
}

function formatDurationClockStyle(sec) {
  if (sec == null) return "—";

  let total = Math.floor(sec);
  const days = Math.floor(total / (24 * 3600));
  total = total % (24 * 3600);

  let hours = Math.floor(total / 3600);
  total = total % 3600;

  const mins = Math.floor(total / 60);
  const secs = total % 60;

  if (days > 0) {
    hours += days * 24;
  }

  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${mm}:${ss} שע'`;
  }
  return `${mm}:${ss} דק'`;
}

// ======================= הקומפוננטה =======================
export default function AdminDashboard() {
  const [kpis, setKpis] = useState(null);
  const [topExitPages, setTopExitPages] = useState([]);
  const [loading, setLoading] = useState(true);

  // גרף
  const [range, setRange] = useState("day");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [timeseries, setTimeseries] = useState([]);

  // מוצרים
  const [topProducts, setTopProducts] = useState([]);
  const [bottomProducts, setBottomProducts] = useState([]);

  // מקורות
  const [sourceDate, setSourceDate] = useState("");
  const [sourceBreakdown, setSourceBreakdown] = useState({
    facebook: 0,
    instagram: 0,
    tiktok: 0,
    google: 0,
    direct: 0,
  });

  // הכנסות יומיות
  const [revenueDate, setRevenueDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [revenueTotal, setRevenueTotal] = useState(0);

  const [revenueMode, setRevenueMode] = useState("day"); // "day" | "month" | "year"
  const [revenueMonth, setRevenueMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`; // "2025-10"
  });
  const [revenueYear, setRevenueYear] = useState(() =>
    String(new Date().getFullYear())
  );

  // ======= טיימסיריס לגרף =======
  useEffect(() => {
    async function loadTS() {
      const BASE = "http://localhost:4000";
      const params = new URLSearchParams();
      params.set("range", range);
      if (range === "day" && dayFilter) params.set("date", dayFilter);
      if (range === "month" && monthFilter) params.set("month", monthFilter);

      try {
        const res = await fetch(`${BASE}/api/sessions/timeseries?` + params.toString());
        const data = await res.json();
        const buckets = Array.isArray(data?.buckets) ? data.buckets : [];
        const chartPoints = buckets.map((b) => ({
          ...b,
          label: buildLabelForRange(b, range),
          visits: Number(b.visits || b.total_visits || b.total_views || 0),
        }));
        setTimeseries(chartPoints);
      } catch (err) {
        console.error("timeseries fetch failed", err);
        setTimeseries([]);
      }
    }
    loadTS();
  }, [range, dayFilter, monthFilter]);

  // ======= סגירת דרופדאון =======
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest(".adm-range-wrapper")) {
        setRangeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ======= טעינה ראשונית כללית =======
  useEffect(() => {
    async function load() {
      try {
        const BASE = "http://localhost:4000";

        // KPIs
        const kpiRes = await fetch(`${BASE}/api/sessions/kpis`);
        const kpiJson = await kpiRes.json();
        setKpis(kpiJson);

        // דפי יציאה
        const exitRes = await fetch(`${BASE}/api/pageviews/summary?groupBy=page`);
        const exitJsonRaw = await exitRes.json();
        const exitJson = Array.isArray(exitJsonRaw) ? exitJsonRaw : [];
        const exitTop = exitJson
          .filter((row) => (row.exits || 0) > 0)
          .sort((a, b) => b.exits - a.exits)
          .slice(0, 5);
        setTopExitPages(exitTop);

        // מקורות להיום
        const srcRes = await fetch(`${BASE}/api/sessions/sources/today`);
        const srcJson = await srcRes.json();
        setSourceBreakdown({
          facebook: srcJson.facebook ?? 0,
          instagram: srcJson.instagram ?? 0,
          tiktok: srcJson.tiktok ?? 0,
          google: srcJson.google ?? 0,
          direct: srcJson.direct ?? 0,
        });

        setLoading(false);
      } catch (err) {
        console.error("dashboard load failed", err);
        setLoading(false);
      }
    }
    load();
  }, []);

  // ======= סטטיסטיקת מוצרים =======
  useEffect(() => {
    async function loadProductStats() {
      try {
        const BASE = "http://localhost:4000";
        const [bestRes, worstRes] = await Promise.all([
          fetch(`${BASE}/api/stats/products/top?limit=5`),
          fetch(`${BASE}/api/stats/products/worst?limit=5`),
        ]);
        const best = await bestRes.json();
        const worst = await worstRes.json();
        setTopProducts(Array.isArray(best) ? best : []);
        setBottomProducts(Array.isArray(worst) ? worst : []);
      } catch (err) {
        console.error("product stats failed", err);
        setTopProducts([]);
        setBottomProducts([]);
      }
    }
    loadProductStats();
  }, []);

  // ======= הכנסות לפי יום =======
  // ======= הכנסות (יום / חודש / שנה) =======
useEffect(() => {
  async function loadRevenue() {
    const BASE = "http://localhost:4000";
    let url = `${BASE}/api/revenue/by-day`;
    const params = new URLSearchParams();

    if (revenueMode === "day") {
      url = `${BASE}/api/revenue/by-day`;
      if (revenueDate) params.set("date", revenueDate);
    } else if (revenueMode === "month") {
      url = `${BASE}/api/revenue/by-month`;
      if (revenueMonth) params.set("month", revenueMonth); // "YYYY-MM"
    } else if (revenueMode === "year") {
      url = `${BASE}/api/revenue/by-year`;
      if (revenueYear) params.set("year", revenueYear); // "2025"
    }

    try {
      const qs = params.toString();
      const res = await fetch(qs ? `${url}?${qs}` : url);
      const data = await res.json();
      setRevenueTotal(data.revenue_total ?? 0);
    } catch (err) {
      console.error("loadRevenue failed", err);
      setRevenueTotal(0);
    }
  }

  loadRevenue();
}, [revenueMode, revenueDate, revenueMonth, revenueYear]);

  // ======= מקורות לפי יום =======
  useEffect(() => {
    async function loadSources() {
      const BASE = "http://localhost:4000";
      const params = new URLSearchParams();
      if (sourceDate) params.set("date", sourceDate);
      try {
        const res = await fetch(`${BASE}/api/sessions/sources/by-day?` + params.toString());
        const data = await res.json();
        setSourceBreakdown({
          facebook: data.facebook ?? 0,
          instagram: data.instagram ?? 0,
          tiktok: data.tiktok ?? 0,
          google: data.google ?? 0,
          direct: data.direct ?? 0,
        });
      } catch (err) {
        console.error("loadSources failed", err);
        setSourceBreakdown({
          facebook: 0,
          instagram: 0,
          tiktok: 0,
          google: 0,
          direct: 0,
        });
      }
    }
    loadSources();
  }, [sourceDate]);

  if (loading || !kpis) {
    return (
      <div dir="rtl" style={{ color: "#fff", padding: 24 }}>
        טוען נתונים…
      </div>
    );
  }

  function formatCurrencyILS(num) {
    if (num == null) return "₪0.00";
    return Number(num).toLocaleString("he-IL", {
      style: "currency",
      currency: "ILS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // סינון מוצרים בצד הקליינט
  const filteredTop = (topProducts || []).filter((p) => {
    const sold = Number(p?.total_sold ?? p?.total_qty ?? p?.qty ?? 0);
    return sold > 0; // מציג רק אם יש לפחות יחידה אחת
  });

 const filteredBottom = (bottomProducts || [])
  .filter((p) => {
    const sold = Number(p?.total_sold ?? p?.total_qty ?? p?.qty ?? 0);
    return sold > 0;
  })
  .sort((a, b) => {
    const soldA = Number(a?.total_sold ?? a?.total_qty ?? a?.qty ?? 0);
    const soldB = Number(b?.total_sold ?? b?.total_qty ?? b?.qty ?? 0);
    return soldB - soldA; // מהכי הרבה ל־מעט בתוך החמישייה החלשה
  });


  return (
    <div dir="rtl" style={{ display: "grid", gap: "16px" }}>
      <section className="adm-panel-group">
        <header className="adm-group-header" style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#fff", margin: 0 }}>
            דשבורד מנהל
          </h1>
          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            כמה אנשים נכנסו, מה הם עשו,מאיפה נכנסו, כמה הכנסות נכנסו ומה נמכר.
          </p>
        </header>

        <div className="adm-group-body">
          {/* ===== סטטוס ביצועים ===== */}
          <section className="adm-inner-card" style={{ display: "grid", gap: 12 }}>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                margin: 0,
                textAlign: "right",
              }}
            >
              סטטוס ביצועים
            </h2>

            {/* ===== ביצועי מוצרים ===== */}
            <section className="adm-inner-card" style={{ display: "grid", gap: 12 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  margin: 0,
                  textAlign: "right",
                }}
              >
                ביצועי מוצרים
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {/* הכי נמכרים */}
                <div
                  style={{
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                <h3
  style={{
    margin: "0 0 8px 0",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  }}
>
  5 המוצרים הכי נמכרים
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#00ff6a"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </svg>
</h3>


                  {filteredTop.length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                      אין נתונים להצגה
                    </p>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {filteredTop.map((p, idx) => {
                        const sold = Number(p?.total_sold ?? p?.total_qty ?? p?.qty ?? 0);
                        return (
                          <li
                            key={p.id || idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 0",
                              borderBottom:
                                idx === filteredTop.length - 1
                                  ? "none"
                                  : "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <span style={{ color: "#fff", fontSize: 12 }}>
                              {idx + 1}. {p.title || p.name || `מוצר ${p.id}`}
                            </span>
                            <span
                              style={{
                                color: "rgba(255,255,255,0.7)",
                                fontSize: 11,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {sold} יח'
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* הכי פחות נמכרים */}
              <div
  style={{
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontFamily: "Arial, Helvetica, sans-serif",
    borderRadius: 8,
    padding: 12,
  }}
>
  <h3
    style={{
      margin: "0 0 8px 0",
      color: "#fff",
      fontSize: 13,
      fontWeight: 600,
      display: "flex",
      alignItems: "center",
      gap: "6px",
    }}
  >
    5 המוצרים עם הכי מעט מכירות
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ff4d4d"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M19 12l-7 7-7-7" />
    </svg>
  </h3>

                  {filteredBottom.length === 0 ? (
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                      אין נתונים להצגה
                    </p>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {filteredBottom.map((p, idx) => {
                        const sold =
                          Number(p?.total_sold ?? p?.total_qty ?? p?.qty ?? 0);
                        return (
                          <li
                            key={p.id || idx}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 0",
                              borderBottom:
                                idx === filteredBottom.length - 1
                                  ? "none"
                                  : "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <span style={{ color: "#fff", fontSize: 12 }}>
                              {idx + 1}. {p.title || p.name || `מוצר ${p.id}`}
                            </span>
                            <span
                              style={{
                                color: "rgba(255,255,255,0.7)",
                                fontSize: 11,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {sold} יח'
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* === הכנסות === */}
            <section
              className="adm-inner-card"
              style={{
                display: "grid",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                  width: "100%",
                  color: "#fff",
                }}
              >
                <div style={{ textAlign: "right" }}>
                  <h2
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      margin: 0,
                      textAlign: "right",
                    }}
                  >
                    הכנסות
                  </h2>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.7)",
                      lineHeight: 1.4,
                      marginTop: 4,
                    }}
                  >
                    כמה כסף נכנס לפי בחירה (יומי / חודשי / שנתי)
                  </div>
                </div>

                {/* כפתורי מעבר */}
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    background: "rgba(0,0,0,0.15)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 999,
                    padding: 3,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setRevenueMode("day")}
                    style={{
                      background: revenueMode === "day" ? "#fff" : "transparent",
                      color: revenueMode === "day" ? "#000" : "#fff",
                      border: "none",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    יומי
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueMode("month")}
                    style={{
                      background: revenueMode === "month" ? "#fff" : "transparent",
                      color: revenueMode === "month" ? "#000" : "#fff",
                      border: "none",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    חודשי
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevenueMode("year")}
                    style={{
                      background: revenueMode === "year" ? "#fff" : "transparent",
                      color: revenueMode === "year" ? "#000" : "#fff",
                      border: "none",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    שנתי
                  </button>
                </div>
              </div>

              {/* שורת השדות – משתנה לפי מצב */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                {revenueMode === "day" && (
                  <label
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    תאריך:
                    <input
                      type="date"
                      value={revenueDate}
                      onChange={(e) => setRevenueDate(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "12px",
                        padding: "4px 6px",
                        lineHeight: 1.2,
                        minWidth: "120px",
                      }}
                    />
                  </label>
                )}

                {revenueMode === "month" && (
                  <label
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    חודש:
                    <input
                      type="month"
                      value={revenueMonth}
                      onChange={(e) => setRevenueMonth(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "12px",
                        padding: "4px 6px",
                        minWidth: "120px",
                      }}
                    />
                  </label>
                )}

                {revenueMode === "year" && (
                  <label
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    שנה:
                    <input
                      type="number"
                      min="2000"
                      max="2100"
                      value={revenueYear}
                      onChange={(e) => setRevenueYear(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "12px",
                        padding: "4px 6px",
                        width: "90px",
                      }}
                    />
                  </label>
                )}
              </div>

              {/* סכום */}
              <div
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
                  padding: "16px",
                  color: "#fff",
                  fontSize: "18px",
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                {formatCurrencyILS(revenueTotal)}
              </div>
            </section>

            {/* ===== KPIs קטנים ===== */}
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
              }}
            >
              <KpiCard label="כניסות היום" value={kpis.visits_today} />
              <KpiCard
                label="זמן שהיה (היום)"
                value={formatDurationClockStyle(kpis.avg_duration_today)}
              />  
            </div>
          </section>

          {/* ===== גרף ===== */}
          <section
            className="adm-inner-card"
            style={{
              minHeight: 260,
              display: "grid",
              gridTemplateRows: "min-content 1fr",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                width: "100%",
              }}
            >
              <div className="adm-range-wrapper">
                <button
                  type="button"
                  className="adm-range-trigger"
                  onClick={() => setRangeOpen((o) => !o)}
                >
                  <span
                    className={"adm-range-arrow" + (rangeOpen ? " open" : "")}
                    aria-hidden="true"
                  >
                    <svg
                      className="adm-range-arrow-icon"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="adm-range-label">
                    {range === "day" ? "יום" : range === "month" ? "חודש" : "שנה"}
                  </span>
                </button>

                {rangeOpen && (
                  <div className="adm-range-menu">
                    <div
                      className={
                        "adm-range-item" +
                        (range === "day" ? " adm-range-item-active" : "")
                      }
                      onClick={() => {
                        setRange("day");
                        setRangeOpen(false);
                      }}
                    >
                      יום
                    </div>
                    <div
                      className={
                        "adm-range-item" +
                        (range === "month" ? " adm-range-item-active" : "")
                      }
                      onClick={() => {
                        setRange("month");
                        setRangeOpen(false);
                      }}
                    >
                      חודש
                    </div>
                    <div
                      className={
                        "adm-range-item" +
                        (range === "year" ? " adm-range-item-active" : "")
                      }
                      onClick={() => {
                        setRange("year");
                        setRangeOpen(false);
                      }}
                    >
                      שנה
                    </div>
                  </div>
                )}
              </div>

              <div style={{ textAlign: "right", color: "#fff" }}>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: "rgba(255,255,255,0.7)",
                    display: "flex",
                    gap: 8,
                    justifyContent: "flex-end",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  כניסות לפי{" "}
                  {range === "day"
                    ? "יום"
                    : range === "month"
                    ? "חודש"
                    : "שנה"}
                </div>

                {range === "day" && (
                  <label
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    בחרי יום:
                    <input
                      type="date"
                      value={dayFilter}
                      onChange={(e) => setDayFilter(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "12px",
                        padding: "4px 6px",
                      }}
                    />
                  </label>
                )}

                {range === "month" && (
                  <label
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    בחרי חודש:
                    <input
                      type="month"
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "6px",
                        color: "#fff",
                        fontSize: "12px",
                        padding: "4px 6px",
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                boxShadow: "0 30px 80px rgba(0,0,0,0.9)",
                padding: "12px 16px",
                height: 180,
                direction: "ltr",
              }}
            >
              <ResponsiveContainer>
                <LineChart data={timeseries}>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.07)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.4)"
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                    labelStyle={{ color: "#fff", fontWeight: 600 }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={true}
                    activeDot={{
                      r: 4,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                      fill: "rgba(255,255,255,0.3)",
                    }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* ===== מקורות ===== */}
            <section className="adm-inner-card" style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                  width: "100%",
                  color: "#fff",
                }}
              >
                <div style={{ textAlign: "right" }}>
                  <h2
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      margin: 0,
                      textAlign: "right",
                    }}
                  >
                    מאיפה הגיעו
                  </h2>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.7)",
                      lineHeight: 1.4,
                      marginTop: 4,
                    }}
                  >
                    כמה ביקורים נפתחו ביום הזה לפי מקור תנועה
                  </div>
                </div>

                <label
                  style={{
                    color: "#fff",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  תאריך:
                  <input
                    type="date"
                    value={sourceDate}
                    onChange={(e) => setSourceDate(e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "12px",
                      padding: "4px 6px",
                      minWidth: "120px",
                    }}
                  />
                </label>
              </div>

              <div
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
                  overflow: "hidden",
                }}
              >
                {/* כותרות */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0,1fr))",
                    background:
                      "linear-gradient(to left,#1a1d1f66 0%,#00000033 100%)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div style={{ padding: "8px 4px" }}>פייסבוק</div>
                  <div style={{ padding: "8px 4px" }}>אינסטגרם</div>
                  <div style={{ padding: "8px 4px" }}>טיקטוק</div>
                  <div style={{ padding: "8px 4px" }}>גוגל</div>
                  <div style={{ padding: "8px 4px" }}>אחר</div>
                </div>

                {/* נתונים */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0,1fr))",
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: "center",
                    color: "#fff",
                  }}
                >
                  <div
                    style={{
                      padding: "10px 4px",
                      borderInlineEnd: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {sourceBreakdown.facebook}
                  </div>
                  <div
                    style={{
                      padding: "10px 4px",
                      borderInlineEnd: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {sourceBreakdown.instagram}
                  </div>
                  <div
                    style={{
                      padding: "10px 4px",
                      borderInlineEnd: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {sourceBreakdown.tiktok}
                  </div>
                  <div
                    style={{
                      padding: "10px 4px",
                      borderInlineEnd: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    {sourceBreakdown.google}
                  </div>
                  <div style={{ padding: "10px 4px" }}>
                    {sourceBreakdown.direct}
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>
      </section>
    </div>
  );
}

// כרטיס KPI קטן
function KpiCard({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "8px",
        padding: "10px 12px",
        color: "#fff",
        boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        {typeof value === "number" ? value.toLocaleString("he-IL") : value}
      </div>
    </div>
  );
}
