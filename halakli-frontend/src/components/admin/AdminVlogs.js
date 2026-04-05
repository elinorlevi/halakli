// src/components/admin/AdminVlogs.jsx
import React, { useEffect, useState } from "react";
import VlogRichTextEditor from "./VlogRichTextEditor"; 
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "";

// אותו helper כמו בקומפוננטות אדמין אחרות
function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function mapStatusLabel(status) {
  return status === "PUBLISHED" ? "פורסם" : "טיוטה";
}

function mapStatusClass(status) {
  return status === "PUBLISHED" ? "adm-status-ok" : "adm-status-draft";
}

function buildImageUrl(path) {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  return `${API_BASE}${path}`;
}

export default function AdminVlogs() {
  const [vlogs, setVlogs] = useState([]);
  const [paging, setPaging] = useState(null);
  const [filterStatus, setFilterStatus] = useState("PUBLISHED"); // PUBLISHED | DRAFT | ALL
  const [loadingList, setLoadingList] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(null); // {id, title, excerpt, content, cover_image, video_url, status, ...}

  // מודאל מחיקה
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    vlog: null,
    loading: false,
  });

  useEffect(() => {
    fetchVlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  async function fetchVlogs(page = 1) {
    try {
      setLoadingList(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", page);
      params.set("pageSize", 50);

      if (filterStatus === "PUBLISHED") params.set("status", "published");
      else if (filterStatus === "DRAFT") params.set("status", "draft");
      else params.set("status", "all");

      const res = await fetch(`${API_BASE}/api/vlogs?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "שגיאה בטעינת וולוגים");
      }

      setVlogs(Array.isArray(json.data) ? json.data : []);
      setPaging(json.paging || null);
    } catch (e) {
      console.error(e);
      setError(e.message || "שגיאה בטעינת וולוגים");
    } finally {
      setLoadingList(false);
    }
  }

  function handleNewVlog() {
    setEditing({
      id: null,
      title: "",
      excerpt: "",
      content: "",
      cover_image: "",
      video_url: "",
      status: "DRAFT",
      published_at: null,
    });
  }

  async function handleEditClick(id) {
    try {
      setLoadingList(true);
      setError("");

      const res = await fetch(`${API_BASE}/api/vlogs/${id}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "שגיאה בטעינת וולוג");
      }

      const v = json.data || {};
      setEditing({
        id: v.id,
        title: v.title || "",
        excerpt: v.excerpt || "",
        content: v.content || "",
        cover_image: v.cover_image || "",
        video_url: v.video_url || "",
        status: v.status || (v.published_at ? "PUBLISHED" : "DRAFT"),
        published_at: v.published_at || null,
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "שגיאה בטעינת וולוג");
    } finally {
      setLoadingList(false);
    }
  }

  function handleFieldChange(field, value) {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function handleUpload(field, file) {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה בהעלאת קובץ");
      }

      const url = json.relativeUrl || json.url;
      setEditing((prev) => (prev ? { ...prev, [field]: url } : prev));
    } catch (e) {
      console.error(e);
      alert(e.message || "שגיאה בהעלאת קובץ");
    }
  }

  // שמירה (פרסום / טיוטה)
  async function handleSave(statusOverride) {
    if (!editing) return;
    try {
      setLoadingSave(true);
      setError("");

      const isNew = !editing.id;

      let status;
      if (statusOverride === "DRAFT") {
        status = "DRAFT";
      } else if (statusOverride === "PUBLISHED") {
        status = "PUBLISHED";
      } else {
        status = editing.status || (isNew ? "DRAFT" : "PUBLISHED");
      }

      const payload = {
        title: editing.title,
        excerpt: editing.excerpt,
        content: editing.content,
        cover_image: editing.cover_image || null,
        video_url: editing.video_url || null,
        status, // באמת PUBLISHED או DRAFT
        published_at: editing.published_at || null,
      };

      if (!payload.title || !payload.title.trim()) {
        throw new Error("חובה למלא כותרת");
      }

      let url;
      let method;

      if (isNew) {
        // וולוג חדש – תמיד POST
        url = `${API_BASE}/api/vlogs`;
        method = "POST";
      } else {
        // וולוג קיים – תמיד PUT (גם לטיוטה וגם לפרסום)
        url = `${API_BASE}/api/vlogs/${editing.id}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || "שגיאה בשמירת וולוג");
      }

      setEditing(null);
      await fetchVlogs();
    } catch (e) {
      console.error(e);
      setError(e.message || "שגיאה בשמירת וולוג");
    } finally {
      setLoadingSave(false);
    }
  }

  // לחיצה על טאב "טיוטות"
  async function handleDraftTabClick() {
    try {
      // אם יש וולוג חדש בעריכה (id=null) עם כותרת → נשמור אותו כטיוטה
      if (
        editing &&
        !editing.id &&
        editing.title &&
        editing.title.trim().length > 0
      ) {
        await handleSave("DRAFT");
      }
    } finally {
      // בכל מקרה נסגור את העריכה ונעבור לטאב טיוטות
      setEditing(null);
      setFilterStatus("DRAFT");
    }
  }

  // פתיחת מודאל מחיקה
  function askDeleteVlog(vlog) {
    setConfirmDelete({
      open: true,
      vlog,
      loading: false,
    });
  }

  // מחיקה בפועל
  async function confirmDeleteNow() {
    if (!confirmDelete.vlog) return;
    const v = confirmDelete.vlog;
    try {
      setConfirmDelete((prev) => ({ ...prev, loading: true }));
      const res = await fetch(`${API_BASE}/api/vlogs/${v.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || (json && json.ok === false)) {
        throw new Error(json?.error || "שגיאה במחיקת וולוג");
      }

      await fetchVlogs();
      setConfirmDelete({ open: false, vlog: null, loading: false });
    } catch (e) {
      console.error(e);
      alert(e.message || "לא הצלחתי למחוק את הוולוג");
      setConfirmDelete({ open: false, vlog: null, loading: false });
    }
  }

  const hasNextPage = paging && paging.page < paging.totalPages;
  const hasPrevPage = paging && paging.page > 1;

 return (
  <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
    <>
      <section dir="rtl" className="adm-panel">
        <h1
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#fff",
            margin: 0,
          }}
        >
          מערכת לרשימת וולוגים
        </h1>
        <p className="adm-desc">
          כותרת, תקציר, גוף (עורך עשיר), קטגוריות/תגיות תמונה/וידאו, טיוטות…
        </p>

        <div className="adm-actions">
          <button className="adm-btn" onClick={handleNewVlog}>
            + וולוג חדש
          </button>

          <button
            className={`adm-btn ${
              filterStatus === "DRAFT" ? "is-active" : ""
            }`}
            type="button"
            onClick={handleDraftTabClick}
          >
            טיוטות
          </button>

          <button
            className={`adm-btn ${
              filterStatus === "PUBLISHED" ? "is-active" : ""
            }`}
            type="button"
            onClick={() => {
              setEditing(null); // גם פה נסגור עריכה כשעוברים לפורסמו
              setFilterStatus("PUBLISHED");
            }}
          >
            פורסמו
          </button>

          {/* כפתור מעבר לעמוד הוולוגים באתר עם מצב אדמין */}
          <a
            href="/vlog?admin=1"
            className="adm-btn"
            style={{ textDecoration: "none" }}
          >
            מעבר לעמוד הוולוגים
          </a>
        </div>

        {error && <div className="adm-error">{error}</div>}

        {loadingList && <div className="adm-loading">טוען וולוגים…</div>}

        {/* טבלה */}
        {!loadingList && (
          <div className="adm-table">
            <div
              className="adm-thead"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 140px",
              }}
            >
              <div>כותרת</div>
              <div>סטטוס</div>
              <div>תאריך</div>
              <div>פעולות</div>
            </div>

            {vlogs.map((vlog) => (
              <div
                key={vlog.id}
                className="adm-row"
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 140px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{vlog.title}</div>
                  {vlog.excerpt && (
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {vlog.excerpt}
                    </div>
                  )}

                  {vlog.cover_image && (
                    <div style={{ marginTop: 4 }}>
                      <img
                        src={buildImageUrl(vlog.cover_image)}
                        alt=""
                        style={{ maxWidth: 80, borderRadius: 4 }}
                      />
                    </div>
                  )}
                </div>
                <div className={mapStatusClass(vlog.status)}>
                  {mapStatusLabel(vlog.status)}
                </div>
                <div>
                  {(vlog.published_at || vlog.created_at || "").slice(0, 10)}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    justifyContent: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="adm-link-btn"
                    onClick={() => handleEditClick(vlog.id)}
                  >
                    עריכה
                  </button>
                  <button
                    type="button"
                    className="adm-link-btn adm-link-danger"
                    onClick={() => askDeleteVlog(vlog)}
                    style={{
                      borderColor: "rgba(220,38,38,0.9)",
                      color: "#fecaca",
                    }}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            ))}

            {vlogs.length === 0 && !loadingList && (
              <div className="adm-empty">אין עדיין וולוגים.</div>
            )}
          </div>
        )}

        {/* פאג'ינציה פשוטה */}
        {paging && (
          <div className="adm-pagination">
            <button
              className="adm-btn"
              disabled={!hasPrevPage}
              onClick={() => fetchVlogs(paging.page - 1)}
            >
              קודם
            </button>
            <span style={{ margin: "0 8px" }}>
              עמוד {paging.page} מתוך {paging.totalPages}
            </span>
            <button
              className="adm-btn"
              disabled={!hasNextPage}
              onClick={() => fetchVlogs(paging.page + 1)}
            >
              הבא
            </button>
          </div>
        )}
      </section>

      {/* טופס הוספה/עריכה – מודאל בסגנון מוצרים, על כל המסך */}
      {editing && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="cardError cardEdit">
            <button
              className="dismiss"
              type="button"
              onClick={() => setEditing(null)}
              aria-label="סגירה"
            >
              ×
            </button>

            <div className="header">
              <div className="image" />

              <div className="content" dir="rtl">
                <span className="title">
                  {editing.id ? "עריכת וולוג" : "וולוג חדש"}
                </span>
                <p className="message">
                  ערכי את פרטי הוולוג – כותרת, תקציר, תוכן, תמונת שער ווידאו.
                </p>

                <div className="product-edit-grid">
                  {/* צד שמאל – שדות טקסט */}
                  <div className="product-edit-main">
                    <div className="edit-field">
                      <label>כותרת *</label>
                      <input
                        type="text"
                        value={editing.title}
                        onChange={(e) =>
                          handleFieldChange("title", e.target.value)
                        }
                      />
                    </div>

                    <div className="edit-field">
                      <label>תקציר (Excerpt)</label>
                      <textarea
                        rows={3}
                        value={editing.excerpt}
                        onChange={(e) =>
                          handleFieldChange("excerpt", e.target.value)
                        }
                      />
                    </div>

                    <div className="edit-field">
                      <label>גוף הוולוג (HTML מעורך עשיר)</label>
                      <VlogRichTextEditor
                        value={editing.content || ""}
                        onChange={(html) =>
                          handleFieldChange("content", html)
                        }
                      />
                    </div>

                    {error && (
                      <div className="product-edit-errors">{error}</div>
                    )}
                  </div>

                  {/* צד ימין – תמונת שער + וידאו */}
                  <div className="product-edit-side">
                    <div className="product-edit-images-box">
                      <div className="product-edit-images-box-title">
                        תמונת שער
                      </div>

                      <div className="edit-field">
                        <small>
                          ניתן להעלות תמונה חדשה או להדביק נתיב קיים.
                        </small>
                      </div>

                      <div className="edit-field product-edit-primary">
                        <label>תמונת שער</label>

                        <div className="product-primary-row">
                          <div className="product-primary-thumb">
                            {editing.cover_image ? (
                              <img
                                src={buildImageUrl(editing.cover_image)}
                                alt="תמונת שער"
                              />
                            ) : (
                              <span className="product-primary-placeholder">
                                אין תמונת שער
                              </span>
                            )}

                            <label
                              className="product-primary-upload"
                              aria-label="בחירת תמונה מהמחשב"
                              title="בחירת תמונה מהמחשב"
                              style={{
                                position: "absolute",
                                left: -10, // מצד שמאל
                                right: "auto",
                              }}
                            >
                              ✎
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleUpload(
                                    "cover_image",
                                    e.target.files?.[0]
                                  )
                                }
                                style={{ display: "none" }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="actions">
                  <button
                    className="history"
                    type="button"
                    onClick={() => handleSave("DRAFT")}
                    disabled={loadingSave}
                  >
                    {editing.id ? "שמור טיוטה חדשה" : "שמור כטיוטה"}
                  </button>
                  <button
                    className="track"
                    type="button"
                    onClick={() => handleSave("PUBLISHED")}
                    disabled={loadingSave}
                  >
                    פרסום
                  </button>
                </div>

                {loadingSave && (
                  <div className="adm-loading" style={{ marginTop: 8 }}>
                    שומר…
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* מודאל מחיקת וולוג */}
      {confirmDelete.open && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="cardError">
            <button
              className="dismiss"
              type="button"
              onClick={() =>
                setConfirmDelete({ open: false, vlog: null, loading: false })
              }
              aria-label="סגירה"
            >
              ×
            </button>

            <div className="header">
              <div className="image">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 22C16.9706 22 21 17.9706 21 13C21 8.02944 16.9706 4 12 4C7.02944 4 3 8.02944 3 13C3 17.9706 7.02944 22 12 22Z"
                    stroke="#b91c1c"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M12 10V14"
                    stroke="#b91c1c"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 17H12.01"
                    stroke="#b91c1c"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="content" dir="rtl">
                <span className="title">למחוק את הוולוג?</span>
                <p className="message">
                  את בטוחה שברצונך למחוק את{" "}
                  <strong>
                    "{confirmDelete.vlog?.title || "הוולוג הזה"}"
                  </strong>
                  ? לאחר מחיקה לא ניתן לשחזר אותו.
                </p>
              </div>

              <div className="actions">
                <button
                  className="history"
                  type="button"
                  onClick={confirmDeleteNow}
                  disabled={confirmDelete.loading}
                >
                  {confirmDelete.loading ? "מוחקת…" : "כן, מחיקה"}
                </button>
                <button
                  className="track"
                  type="button"
                  onClick={() =>
                    setConfirmDelete({
                      open: false,
                      vlog: null,
                      loading: false,
                    })
                  }
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  </div>
);

}
