import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function TrafficCard({
  rangeData, // { day: [...], month: [...], year: [...] }
  kpiData,   // { day: {...}, month: {...}, year: {...} }
}) {
  const [range, setRange] = useState("day"); // "day" | "month" | "year"

  const dataForChart = rangeData[range] || [];
  const kpis = kpiData[range] || {};

  return (
    <section
      className="adm-inner-card"
      style={{ display: "grid", gap: "16px" }}
    >
      {/* כותרת + בורר טווח */}
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ textAlign: "right" }}>
            <h2
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              אנליטיקות מבקרים
            </h2>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.4,
                color: "rgba(255,255,255,0.6)",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >
              תנועה אורגנית, קידום ממומן, וזמן שהיה באתר.
            </div>
          </div>

          {/* כפתורי טווח זמן */}
          <div
            style={{
              display: "flex",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "10px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
              overflow: "hidden",
              fontSize: 12,
              color: "#fff",
              fontFamily: "Arial, Helvetica, sans-serif",
            }}
          >
            {[
              { id: "day", label: "יום" },
              { id: "month", label: "חודש" },
              { id: "year", label: "שנה" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRange(opt.id)}
                style={{
                  background:
                    range === opt.id
                      ? "rgba(255,255,255,0.12)"
                      : "transparent",
                  border: 0,
                  color:
                    range === opt.id
                      ? "#fff"
                      : "rgba(255,255,255,0.7)",
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  lineHeight: 1.3,
                  fontWeight: 500,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs למעלה */}
        <div
          style={{
            display: "grid",
            gap: "8px",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(min(100px,100%),1fr))",
            fontSize: 12,
            color: "#fff",
            textAlign: "right",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "8px 10px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              סה״כ כניסות
            </div>
            <div style={{ fontWeight: 600 }}>{kpis.visits}</div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "8px 10px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              זמן שהיה באתר (ממוצע)
            </div>
            <div style={{ fontWeight: 600 }}>{kpis.avgTime}</div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "8px 10px",
            }}
          >
            <div
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              מבקרים ייחודיים
            </div>
            <div style={{ fontWeight: 600 }}>{kpis.unique}</div>
          </div>
        </div>
      </header>

      {/* הגרף עצמו */}
      <div
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.9)",
          padding: "12px 16px",
          minHeight: "180px",
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.7)",
            marginBottom: "8px",
            textAlign: "right",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          כניסות לאתר לאורך הזמן
        </div>

        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <LineChart data={dataForChart}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  direction: "rtl",
                  textAlign: "right",
                  color: "#fff",
                }}
                labelStyle={{
                  color: "#fff",
                  fontWeight: 600,
                }}
                itemStyle={{
                  color: "#fff",
                }}
              />
              <Line
                type="monotone"
                dataKey="visits"
                stroke="#ffffff"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: "#ffffff",
                  strokeWidth: 2,
                  fill: "rgba(255,255,255,0.3)",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
