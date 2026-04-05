// src/components/Vlog.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, generatePath } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import VlogRichTextEditor from "./admin/VlogRichTextEditor";

/* ===== API ===== */
const API = "/api";

// בסיס לכתובות API (גם ל-Vite וגם ל-CRA)
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "";

// כותרות עם טוקן אדמין
function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
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

async function fetchJSON(
  url,
  { method = "GET", headers, body, timeout = 15000 } = {}
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: ctrl.signal,
      credentials: "same-origin",
    });
    const txt = await res.text();
    let data = null;
    try {
      data = txt ? JSON.parse(txt) : null;
    } catch {}
    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

const vlogsApi = {
  list({ page = 1, pageSize = 6, q = "" } = {}) {
    const p = new URLSearchParams({ page, pageSize });
    if (q) p.set("q", q);
    return fetchJSON(`${API}/vlogs?${p.toString()}`);
  },
  get(id) {
    return fetchJSON(`${API}/vlogs/${id}`);
  },
};

/* ===== אייקוני עריכה/מחיקה כמו במוצרים ===== */
const EditIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const TrashIcon = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

/* ===== פאג'ינציה ===== */
function PaginationAdvanced({ page, totalPages, onChange }) {
  const compact =
    typeof window !== "undefined" && window.innerWidth < 640;
  const neighbors = compact ? 1 : 2;

  const core = useMemo(() => {
    if (!totalPages || totalPages <= 1) return [];
    const set = new Set([1, totalPages]);
    for (let i = page - neighbors; i <= page + neighbors; i++) {
      if (i >= 1 && i <= totalPages) set.add(i);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [page, totalPages, neighbors]);

  const items = useMemo(() => {
    const out = [];
    for (let i = 0; i < core.length; i++) {
      const cur = core[i];
      const prev = core[i - 1];
      if (i > 0 && cur - prev > 1) out.push({ type: "dots", key: `e-${i}` });
      out.push({ type: "page", key: `p-${cur}`, value: cur });
    }
    return out;
  }, [core]);

  const go = (n) => {
    if (!totalPages || totalPages <= 1) return;
    if (n < 1 || n > totalPages || n === page) return;
    onChange(n);
  };

  if (!totalPages || totalPages <= 1) return null;

  return (
    <nav
      className="pager adv"
      aria-label="pagination"
      dir="rtl"
      style={{
        marginTop: 16,
        display: "flex",
        gap: 8,
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <button
        className="pager-btn nav prev"
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="לעמוד הקודם"
        title="קודם"
      >
        ‹
      </button>

      <div
        className="pager-range"
        role="list"
        style={{ display: "flex", gap: 6, alignItems: "center" }}
      >
        {items.map((it) =>
          it.type === "dots" ? (
            <span
              key={it.key}
              className="pager-ellipsis"
              aria-hidden="true"
              style={{ opacity: 0.6 }}
            >
              …
            </span>
          ) : (
            <button
              key={it.key}
              role="listitem"
              onClick={() => go(it.value)}
              className={`pager-btn num ${
                it.value === page ? "is-active" : ""
              }`}
              aria-current={it.value === page ? "page" : undefined}
              aria-label={`עמוד ${it.value}`}
            >
              {it.value}
            </button>
          )
        )}
      </div>

      <button
        className="pager-btn nav next"
        onClick={() => go(page + 1)}
        disabled={page === totalPages}
        aria-label="לעמוד הבא"
        title="הבא"
      >
        ›
      </button>
    </nav>
  );
}

/* ===== עמוד הוולוגים ===== */
export default function Vlog({ title = "בלוג" }) {
  const PAGE_SIZE = 6;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [paging, setPaging] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  const [sp, setSp] = useSearchParams();
  const pageFromUrl = Math.max(Number(sp.get("page") || 1), 1);

  // 🔐 מצב אדמין – /vlog?admin=1
  const adminFromQuery = sp.get("admin") === "1";

  // ⭐ סטייט של המודאל ליצירת / עריכת וולוג
  const [editing, setEditing] = useState(null); // {id,title,excerpt,content,cover_image,video_url,...}
  const [loadingSave, setLoadingSave] = useState(false);
  const [editError, setEditError] = useState("");

  // מודאל מחיקה
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    vlog: null,
    loading: false,
  });

  async function load(page = 1) {
    try {
      setLoading(true);
      setErr("");
      const json = await vlogsApi.list({ page, pageSize: PAGE_SIZE });
      setItems(json.data ?? []);
      const pg =
        json.paging ?? {
          page,
          pageSize: PAGE_SIZE,
          total: (json.data ?? []).length,
          totalPages: Math.max(
            1,
            Math.ceil(((json.data ?? []).length || PAGE_SIZE) / PAGE_SIZE)
          ),
        };
      setPaging(pg);
    } catch (e) {
      setErr(e.message || "שגיאה בטעינת התוכן");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    load(pageFromUrl);
  }, [pageFromUrl]);

  function handlePageChange(nextPage) {
    setSp((prev) => {
      const q = new URLSearchParams(prev);
      q.set("page", String(nextPage));
      return q;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const skeletonCount = PAGE_SIZE;

  // ==== פונקציות למודאל יצירת וולוג חדש ====

  function openNewVlogModal() {
    setEditError("");
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

  // 🔧 עריכת וולוג קיים – טוען מהשרת ופותח את אותו מודאל
  async function handleEditClick(id) {
    try {
      setEditError("");
      const json = await vlogsApi.get(id);
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
      setEditError(e.message || "שגיאה בטעינת הוולוג לעריכה");
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

  // שמירה – אם יש id → עריכה (PUT), אם אין → יצירה (POST)
  async function handleSave(statusOverride) {
    if (!editing) return;
    try {
      setLoadingSave(true);
      setEditError("");

      const isNew = !editing.id;
      const status =
        statusOverride === "PUBLISHED"
          ? "PUBLISHED"
          : statusOverride === "DRAFT"
          ? "DRAFT"
          : editing.status || (isNew ? "DRAFT" : "PUBLISHED");

      const payload = {
        title: editing.title,
        excerpt: editing.excerpt,
        content: editing.content,
        cover_image: editing.cover_image || null,
        video_url: editing.video_url || null,
        status,
        published_at: editing.published_at || null,
      };

      if (!payload.title || !payload.title.trim()) {
        throw new Error("חובה למלא כותרת");
      }

      let url;
      let method;

      if (isNew) {
        url = `${API_BASE}/api/vlogs`;
        method = "POST";
      } else {
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
      await load(pageFromUrl);
    } catch (e) {
      console.error(e);
      setEditError(e.message || "שגיאה בשמירת וולוג");
    } finally {
      setLoadingSave(false);
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

      await load(pageFromUrl);
      setConfirmDelete({ open: false, vlog: null, loading: false });
    } catch (e) {
      console.error(e);
      alert(e.message || "לא הצלחתי למחוק את הוולוג");
      setConfirmDelete({ open: false, vlog: null, loading: false });
    }
  }

  // ===================== JSX =====================
  return (
    <>
      <SiteHeader variant="account" />
      <main className="acct-wrap">
        <section className="acct-section" dir="rtl">
          <nav className="acct-breadcrumb" aria-label="breadcrumb">
            <ol>
              <li>
                <Link to="/">דף הבית</Link>
              </li>
              <li aria-current="page">בלוג</li>
            </ol>
          </nav>

          <h1 className="acct-h1" style={{ letterSpacing: ".04em" }}>
            {title}
          </h1>
          <h2>גלו מדריכים וטיפים לשיער מושלם מהבית.</h2>

          {/* 🔐 כפתור אדמין – רק כשנכנסים עם ?admin=1 */}
          {adminFromQuery && (
            <>
              <div className="admin-add-product-wrapper">
                <button
                  type="button"
                  className="admin-add-product-btn"
                  onClick={openNewVlogModal}
                  style={{ marginLeft: "auto" }}
                >
                  + <br />
                  הוספת וולוג חדש
                </button>

                <div
                  className="admin-vertical-divider"
                  style={{ marginRight: 10 }}
                />
              </div>

              <hr className="full-divider" />
            </>
          )}

          {loading && <p className="acct-sub">טוען…</p>}
          {err && <div className="vlog-sec__error">{err}</div>}
          {!loading && !err && items.length === 0 && (
            <p className="acct-sub">אין פוסטים להצגה כרגע.</p>
          )}

          <section className="vlog-sec" aria-label="בלוג">
            <div className="vlog-sec__grid">
              {loading
                ? Array.from({ length: skeletonCount }).map((_, i) => (
                    <article
                      className="vlog-card vlog-card--skeleton"
                      key={`sk-${i}`}
                    >
                      <div className="vlog-card__media" />
                      <h3 className="vlog-card__h3" />
                      <p className="vlog-card__excerpt" />
                      <span className="vlog-card__more" />
                    </article>
                  ))
                : items.map((v) => {
                    const toVlog = generatePath("/vlogs/:id", { id: v.id });
                    return (
                      <article
                        className="vlog-card"
                        key={v.id}
                        style={{ position: "relative" }}
                      >
                        {/* 🔐 אייקוני עריכה/מחיקה – רק במצב אדמין */}
                        {adminFromQuery && (
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 12,
                              display: "flex",
                              gap: 6,
                              zIndex: 10,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleEditClick(v.id)}
                              title="עריכה"
                              style={{
                                background: "rgba(0,0,0,0.35)",
                                border:
                                  "1px solid rgba(255,255,255,0.35)",
                                borderRadius: 999,
                                width: 28,
                                height: 28,
                                display: "grid",
                                placeItems: "center",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => askDeleteVlog(v)}
                              title="מחיקה"
                              style={{
                                background: "rgba(180,0,0,0.45)",
                                border:
                                  "1px solid rgba(255,0,0,0.3)",
                                borderRadius: 999,
                                width: 28,
                                height: 28,
                                display: "grid",
                                placeItems: "center",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}

                        {/* מדיה */}
                        <Link
                          to={toVlog}
                          className="vlog-card__media"
                          aria-label={v.title}
                        >
                          {v.cover_image ? (
                            <img
                              src={buildImageUrl(v.cover_image)}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                  "/img/placeholders/vlog-16x9.webp";
                              }}
                            />
                          ) : (
                            <div
                              className="vlog-card__ph"
                              aria-hidden="true"
                            >
                              HALAKLI
                            </div>
                          )}
                        </Link>

                        {/* כותרת */}
                        <h3 className="vlog-card__h3">
                          <Link to={toVlog}>{v.title}</Link>
                        </h3>

                        {/* תקציר */}
                        <p className="vlog-card__excerpt">
                          {v.excerpt || ""}
                        </p>

                        {/* כפתור קרא עוד */}
                        <div className="vlog-card__actions">
                          <Link
                            to={toVlog}
                            className="uiverse-btn"
                            aria-label={`קראי עוד על: ${v.title}`}
                          >
                            <span>קרא עוד</span>
                          </Link>
                        </div>
                      </article>
                    );
                  })}
            </div>

            {!loading && !err && (
              <PaginationAdvanced
                page={paging.page}
                totalPages={paging.totalPages}
                onChange={handlePageChange}
              />
            )}
          </section>
        </section>
      </main>

      {/* 🔐 מודאל הוספה / עריכת וולוג – אותו חלון לשניהם */}
      {adminFromQuery && editing && (
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

                    {editError && (
                      <div className="product-edit-errors">
                        {editError}
                      </div>
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
                                left: -10,
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
                    {editing.id ? "שמור כטיוטה" : "שמור כטיוטה"}
                  </button>
                  <button
                    className="track"
                    type="button"
                    onClick={() => handleSave("PUBLISHED")}
                    disabled={loadingSave}
                  >
                    {editing.id ? "עדכון ופרסום" : "פרסום"}
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

      {/* 🔐 מודאל מחיקת וולוג – בעמוד הרגיל */}
      {adminFromQuery && confirmDelete.open && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="cardError">
            <button
              className="dismiss"
              type="button"
              onClick={() =>
                setConfirmDelete({
                  open: false,
                  vlog: null,
                  loading: false,
                })
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

      <SiteFooter />
    </>
  );
}
