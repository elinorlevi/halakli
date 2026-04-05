// src/components/admin/AdminOrders.jsx
import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "";

// ---- helpers ----
function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

// מנקה את הכתובת אם הערת הלקוח נדבקה אליה בטעות
function stripCustomerNoteFromAddress(address = "", customerNote = "") {
  let addr = String(address || "").trim();
  const note = String(customerNote || "").trim();
  if (!addr || !note) return addr;

  if (addr.startsWith(note)) {
    addr = addr.slice(note.length);
  }

  addr = addr.replace(/^[-|·,;,\s]+/, "");
  addr = addr.replace(note, "").trim();

  return addr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

// בודק אם כתובת היא בעצם " , , " או ריקה
function isAddressEmpty(str) {
  if (!str) return true;
  const cleaned = String(str).replace(/[,.\s•|:;]+/g, "");
  return cleaned.length === 0;
}

const STATUS_MAP = {
  NEW: "חדש",
  PROCESSING: "בתהליך",
  PACKED_SHIPPED: "הוכן/נשלח",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל",
  REFUNDED: "החזר/זיכוי",
};

const STATUS_OPTIONS = Object.keys(STATUS_MAP);

function formatMoney(v) {
  if (v == null) return "₪0.00";
  const n = Number(v);
  if (Number.isNaN(n)) return "₪0.00";
  return `₪${n.toFixed(2)}`;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  // צד ימין
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState(null);
  const [orderPayments, setOrderPayments] = useState([]);
  const [savingNote, setSavingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [itemsSummaryMap, setItemsSummaryMap] = useState({});

  // 👇 כתובת גיבוי – אם להזמנה אין כתובת
  const [fallbackShippingAddress, setFallbackShippingAddress] = useState("");

  // 👇 זיהוי מובייל + מצב חלון פרטים
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 768;
  });
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        // בדסקטופ אין מודל
        setDetailsOpen(false);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ====== 1. טבלת הזמנות ======
  useEffect(() => {
    let abort = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", page);
        params.set("limit", limit);
        if (filterStatus) params.set("status", filterStatus);
        if (search.trim()) params.set("q", search.trim());

        const authHeaders = getAuthHeaders();

        const res = await fetch(
          `${API_BASE}/api/orders?${params.toString()}`,
          { headers: authHeaders }
        );
        const data = await res.json();

        const list = data.data || [];

        // 🔽 מסנן רק הזמנות ששולמו במלואן
        const paidList = [];
        await Promise.all(
          list.map(async (o) => {
            try {
              const summaryRes = await fetch(
                `${API_BASE}/api/orders/${o.id}/summary`,
                { headers: authHeaders }
              );
              if (!summaryRes.ok) return;
              const summary = await summaryRes.json();
              if (
                summary &&
                typeof summary.balance === "number" &&
                summary.balance <= 0
              ) {
                paidList.push(o);
              }
            } catch (e) {
              console.warn("failed to load summary for order", o.id, e);
            }
          })
        );
        const finalList = paidList;

        if (!abort) {
          setOrders(finalList);
          setPages(data.pages || 1);
          setTotal(finalList.length || 0);

          if (!selectedOrderId && finalList.length > 0) {
            setSelectedOrderId(finalList[0].id);
          } else if (
            selectedOrderId &&
            !finalList.some((o) => o.id === selectedOrderId)
          ) {
            setSelectedOrderId(finalList.length ? finalList[0].id : null);
          }
        }

        const summaries = {};

        await Promise.all(
          finalList.map(async (o) => {
            try {
              const itemsRes = await fetch(
                `${API_BASE}/api/orders/${o.id}/items`,
                { headers: authHeaders }
              );
              if (!itemsRes.ok) return;
              const itemsData = await itemsRes.json();
              const items = itemsData.items || [];

              if (!items.length) {
                summaries[o.id] = "";
                return;
              }

              const base = items
                .slice(0, 3)
                .map((it) => `${it.title} x${it.qty}`)
                .join(" | ");

              if (items.length > 3) {
                summaries[o.id] = `${base} +${items.length - 3} נוספים`;
              } else {
                summaries[o.id] = base;
              }
            } catch (e) {
              console.warn("failed to load items for order", o.id, e);
            }
          })
        );

        if (!abort) {
          setItemsSummaryMap(summaries);
        }
      } catch (err) {
        console.error("failed to load orders", err);
      } finally {
        if (!abort) setLoading(false);
      }
    }

    load();
    return () => {
      abort = true;
    };
  }, [page, limit, filterStatus, search, selectedOrderId]);

  // ====== 2. פרטי הזמנה + כתובת גיבוי ======
  useEffect(() => {
    if (!selectedOrderId) return;
    let abort = false;

    async function loadDetails() {
      try {
        const authHeaders = getAuthHeaders();

        const [orderRes, itemsRes, summaryRes, paymentsRes] =
          await Promise.all([
            fetch(`${API_BASE}/api/orders/${selectedOrderId}`, {
              headers: authHeaders,
            }),
            fetch(`${API_BASE}/api/orders/${selectedOrderId}/items`, {
              headers: authHeaders,
            }),
            fetch(`${API_BASE}/api/orders/${selectedOrderId}/summary`, {
              headers: authHeaders,
            }),
            fetch(`${API_BASE}/api/orders/${selectedOrderId}/payments`, {
              headers: authHeaders,
            }),
          ]);

        const order = await orderRes.json();
        const items = await itemsRes.json();
        const summary = await summaryRes.json();
        const payments = await paymentsRes.json();

        let fallback = "";

        if (
          order &&
          isAddressEmpty(order.shipping_address_text) &&
          order.user_id
        ) {
          try {
            const addrRes = await fetch(
              `${API_BASE}/api/addresses?type=SHIPPING&user_id=${order.user_id}`,
              { headers: authHeaders }
            );
            if (addrRes.ok) {
              const addrs = await addrRes.json();
              if (Array.isArray(addrs) && addrs.length > 0) {
                fallback = addrs[0].address_text || "";
              }
            }
          } catch (e) {
            console.warn("cannot load fallback address", e);
          }
        }

        if (!abort) {
          setSelectedOrder(order);
          setOrderItems(items?.items || []);
          setOrderSummary(summary || null);
          setOrderPayments(payments?.payments || []);
          setNoteDraft(order?.notes_internal || "");
          setFallbackShippingAddress(fallback);
        }
      } catch (err) {
        console.error("failed to load order details", err);
      }
    }

    loadDetails();
    return () => {
      abort = true;
    };
  }, [selectedOrderId]);

  async function handleStatusChange(newStatus) {
    if (!selectedOrderId) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/orders/${selectedOrderId}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error("failed");

      setSelectedOrder((prev) =>
        prev ? { ...prev, status: newStatus } : prev
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrderId ? { ...o, status: newStatus } : o
        )
      );
    } catch (err) {
      console.error("status update failed", err);
      alert("לא הצלחתי לעדכן סטטוס 😔");
    }
  }

  async function handleExportExcel() {
    try {
      const params = new URLSearchParams();
      params.set("page", 1);
      params.set("limit", 5000);
      if (filterStatus) params.set("status", filterStatus);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`${API_BASE}/api/orders?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      const rows = data.data || [];

      const itemsMap = new Map();

      await Promise.all(
        rows.map(async (o) => {
          try {
            const itemsRes = await fetch(
              `${API_BASE}/api/orders/${o.id}/items`,
              { headers: getAuthHeaders() }
            );
            if (!itemsRes.ok) return;
            const itemsData = await itemsRes.json();
            const items = itemsData.items || [];

            const summary = items
              .map((it) => `${it.title} x${it.qty}`)
              .join(" | ");

            itemsMap.set(o.id, summary);
          } catch (e) {
            console.warn("failed to load items for order", o.id, e);
          }
        })
      );

      const sheetData = rows.map((o) => ({
        "מספר הזמנה": o.order_number,
        תאריך: o.created_at
          ? new Date(o.created_at).toLocaleString("he-IL")
          : "",
        לקוח: o.customer_name || "",
        טלפון: o.customer_phone || "",
        אימייל: o.customer_email || "",
        סכום: o.grand_total ?? 0,
        סטטוס: o.status || "",
        "כתובת משלוח": o.shipping_address_text || "",
        "הערת לקוח": o.customer_notes || "",
        מוצרים: itemsMap.get(o.id) || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

      const wbout = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([wbout], {
        type: "application/octet-stream",
      });

      saveAs(
        blob,
        `orders_export_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (err) {
      console.error("export failed", err);
      alert("לא הצלחתי לייצא לאקסל");
    }
  }

  async function handleSaveNote() {
    if (!selectedOrderId) return;
    setSavingNote(true);
    try {
      const res = await fetch(`${API_BASE}/api/orders/${selectedOrderId}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes_internal: noteDraft }),
      });
      if (!res.ok) throw new Error("failed");
      setSelectedOrder((prev) =>
        prev ? { ...prev, notes_internal: noteDraft } : prev
      );
    } catch (err) {
      console.error("note save failed", err);
      alert("לא הצלחתי לשמור את ההערה");
    } finally {
      setSavingNote(false);
    }
  }

  // בחירת הזמנה – במובייל גם פותח חלון
  function pickOrder(id, openDetails = false) {
    setSelectedOrderId(id);
    if (isMobile && openDetails) {
      setDetailsOpen(true);
    }
  }

  // פה אנחנו מחליטים מה להציג ככתובת
  const shippingToShow = (() => {
    if (!selectedOrder) return "—";

    const rawAddr = selectedOrder.shipping_address_text || "";
    const custNote = selectedOrder.customer_notes || "";

    const cleaned = stripCustomerNoteFromAddress(rawAddr, custNote);

    if (!isAddressEmpty(cleaned)) {
      return cleaned;
    }

    if (!isAddressEmpty(fallbackShippingAddress)) {
      return fallbackShippingAddress;
    }

    return "—";
  })();

  // === פונקציה שמחזירה את תוכן פרטי ההזמנה (משותף לפאנל ולמודל) ===
  function renderOrderDetails() {
    if (!selectedOrder) {
      return <div style={{ color: "#fff" }}>בחרי הזמנה…</div>;
    }

    return (
      <>
        <h2 style={{ marginBottom: 4 }}>
          {selectedOrder.order_number || `ORDER #${selectedOrder.id}`}
        </h2>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 12,
          }}
        >
          נוצרה:{" "}
          {selectedOrder.created_at
            ? new Date(selectedOrder.created_at).toLocaleString("he-IL")
            : "-"}
        </div>

        <div className="adm-sidepanel-label">סטטוס הזמנה</div>
        <select
          value={selectedOrder.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            color: "#fff",
            fontSize: 12,
            padding: "6px 8px",
            marginBottom: 10,
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_MAP[s]}
            </option>
          ))}
        </select>

        <div className="adm-sidepanel-label">סטטוס תשלום</div>
        <div
          className={`adm-sidepanel-value ${
            orderSummary && orderSummary.balance <= 0 ? "adm-status-ok" : ""
          }`}
        >
          {orderSummary
            ? orderSummary.balance <= 0
              ? "שולם במלואו"
              : `יתרה לתשלום: ${formatMoney(orderSummary.balance)}`
            : "—"}
        </div>

        <div className="adm-sidepanel-label">מוצרים בהזמנה</div>
        <div
          className="adm-sidepanel-value"
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.9)",
            background: "rgba(0,0,0,0.35)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "6px 8px",
            textAlign: "right",
          }}
        >
          {orderItems.length ? (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 4,
              }}
            >
              {orderItems.map((it) => (
                <li
                  key={it.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{it.title}</span>
                  <span>×{it.qty}</span>
                </li>
              ))}
            </ul>
          ) : (
            "אין פריטים"
          )}
        </div>

        <div className="adm-sidepanel-label">לקוח</div>
        <div className="adm-sidepanel-value">
          {selectedOrder.customer_name}
        </div>

        <div className="adm-sidepanel-label">טלפון</div>
        <div className="adm-sidepanel-value">
          {selectedOrder.customer_phone || "—"}
        </div>

        <div className="adm-sidepanel-label">אימייל</div>
        <div className="adm-sidepanel-value">
          {selectedOrder.customer_email || "—"}
        </div>

        <div className="adm-sidepanel-label">כתובת משלוח</div>
        <div
          className="adm-sidepanel-value"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {shippingToShow}
        </div>

        {selectedOrder?.customer_notes ? (
          <>
            <div className="adm-sidepanel-label">הערת לקוח</div>
            <div
              className="adm-sidepanel-value"
              style={{
                whiteSpace: "pre-wrap",
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "4px 8px",
                marginBottom: 10,
              }}
            >
              {selectedOrder.customer_notes}
            </div>
          </>
        ) : null}

        <div className="adm-sidepanel-label">הערת מנהל</div>
        <textarea
          style={{
            width: "100%",
            minHeight: 60,
            borderRadius: 8,
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "#fff",
            fontSize: 12,
            padding: "8px 5px",
            lineHeight: 1.4,
            resize: "vertical",
            outline: "none",
          }}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
        />
        <button
          className="adm-btn"
          style={{ width: "100%", marginTop: 6, fontSize: 12 }}
          onClick={handleSaveNote}
          disabled={savingNote}
        >
          {savingNote ? "שומרת..." : "שמירת הערה"}
        </button>

        <hr
          style={{
            margin: "16px 0",
            border: 0,
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        />

        <h2 style={{ fontSize: 14, marginBottom: 8 }}>
          פריטים ({orderItems.length})
        </h2>
        <div style={{ display: "grid", gap: "8px" }}>
          {orderItems.map((it) => (
            <div
              key={it.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "8px",
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              <div>
                <div style={{ color: "#fff", fontWeight: 500 }}>
                  {it.title}
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)" }}>
                  כמות: {it.qty} · מחיר יח׳: {formatMoney(it.final_unit_price)}
                </div>
              </div>
              <div style={{ textAlign: "end", color: "#fff" }}>
                {formatMoney(it.line_total)}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.8)",
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>סה״כ ביניים</span>
            <span>
              {formatMoney(
                selectedOrder.subtotal_before_discounts ??
                  orderSummary?.grand_total
              )}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>הנחות</span>
            <span>{formatMoney(selectedOrder.discounts_total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>משלוח</span>
            <span>{formatMoney(selectedOrder.shipping_total)}</span>
          </div>
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.15)",
              marginTop: 8,
              paddingTop: 8,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>סה״כ לתשלום</span>
              <span>{formatMoney(selectedOrder.grand_total)}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 13, marginBottom: 6 }}>תשלומים</h3>
          {orderPayments.length === 0 ? (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              אין תשלומים
            </div>
          ) : (
            orderPayments.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span>
                  {p.method} ·{" "}
                  {p.created_at
                    ? new Date(p.created_at).toLocaleString("he-IL")
                    : ""}
                </span>
                <span>
                  {formatMoney(p.amount)} · {p.status}
                </span>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  /* =========================================================
   * JSX
   * ======================================================= */
  return (
    <>
      <div
        dir="rtl"
        style={{
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)",
        }}
      >
        {/* הטבלה הראשית */}
        <section className="adm-panel" style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#fff",
                  margin: 0,
                }}
              >
                ניהול הזמנות
              </h1>
              <p className="adm-desc" style={{ marginTop: 4 }}>
                סטטוסים: חדש · בתהליך · הוכן/נשלח · הושלם · בוטל · החזר/זיכוי
              </p>
            </div>
            <div className="adm-actions" style={{ display: "flex", gap: 8 }}>
              <button className="adm-btn" onClick={handleExportExcel}>
                הזמנות בקובץ אקסל
              </button>
            </div>
          </div>

          {/* פילטרים */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              placeholder="חיפוש לפי הזמנה / לקוח / טלפון"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              style={{
                flex: 1,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#fff",
                padding: "6px 10px",
                fontSize: 13,
              }}
            />
            <select
              value={filterStatus}
              onChange={(e) => {
                setPage(1);
                setFilterStatus(e.target.value);
              }}
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#fff",
                padding: "6px 10px",
                fontSize: 13,
              }}
            >
              <option value="">כל הסטטוסים</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_MAP[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="adm-table">
            <div
              className="adm-thead"
              style={{
                gridTemplateColumns:
                  "minmax(160px,0.7fr) minmax(140px,1fr) minmax(160px,1fr) minmax(80px,0.6fr) minmax(100px,0.7fr) 80px",
              }}
            >
              <div>מס׳ הזמנה</div>
              <div>תאריך/שעה</div>
              <div>לקוח</div>
              <div>סכום</div>
              <div>סטטוס</div>
              <div>פעולות</div>
            </div>

            {loading ? (
              <div style={{ padding: 16, color: "#fff" }}>טוען הזמנות…</div>
            ) : orders.length === 0 ? (
              <div style={{ padding: 16, color: "#fff" }}>אין הזמנות</div>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  className={`adm-row ${
                    selectedOrderId === o.id ? "is-active" : ""
                  }`}
                  style={{
                    gridTemplateColumns:
                      "minmax(90px,0.7fr) minmax(140px,1fr) minmax(160px,1fr) minmax(80px,0.6fr) minmax(100px,0.7fr) 80px",
                    cursor: "pointer",
                  }}
                  onClick={() => pickOrder(o.id, isMobile)}
                >
                  <div>{o.order_number}</div>
                  <div>
                    {o.created_at
                      ? new Date(o.created_at).toLocaleString("he-IL")
                      : "-"}
                  </div>
                  <div>
                    {o.customer_name}
                    {o.customer_phone ? ` · ${o.customer_phone}` : ""}
                  </div>
                  <div>{formatMoney(o.grand_total)}</div>
                  <div>
                    <span className="adm-badge">
                      {STATUS_MAP[o.status] || o.status}
                    </span>
                  </div>
                  <div>
                    <button
                      className="adm-link-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        pickOrder(o.id, true); // במובייל יפתח חלון
                      }}
                    >
                      צפי
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* פג'ינציה */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 10,
              color: "#fff",
              fontSize: 12,
            }}
          >
            <div>
              סה״כ: {total} הזמנות · עמוד {page} מתוך {pages}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="adm-btn"
                style={{ opacity: page <= 1 ? 0.4 : 1 }}
              >
                קודם
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="adm-btn"
                style={{ opacity: page >= pages ? 0.4 : 1 }}
              >
                הבא
              </button>
            </div>
          </div>
        </section>

        {/* הפאנל הימני – מוצג רק בדסקטופ, במובייל נסתיר אותו עם CSS */}
        <aside className="adm-sidepanel adm-sidepanel--desktop">
          {renderOrderDetails()}
        </aside>
      </div>

      {/* מודל במובייל */}
      {isMobile && detailsOpen && (
        <div
          className="adm-order-modal-backdrop"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="adm-order-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="adm-order-modal-close"
              onClick={() => setDetailsOpen(false)}
              aria-label="סגירת פרטי הזמנה"
            >
              ✕
            </button>
            {renderOrderDetails()}
          </div>
        </div>
      )}
    </>
  );
}
