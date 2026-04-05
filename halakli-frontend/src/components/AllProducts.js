// src/components/AllProducts.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";
import "../csscom/Account.css";
import "../csscom/admin/AdminEdit.css";

const API_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  "";

const PUBLIC_BASE =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_PUBLIC_BASE_URL) ||
  process.env.REACT_APP_PUBLIC_BASE_URL ||
  (API_BASE || "").replace(/\/api\/?$/, "") ||
  "";

const API_ORIGIN =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_PUBLIC_BASE_URL) ||
  process.env.REACT_APP_PUBLIC_BASE_URL ||
  PUBLIC_BASE ||
  (API_BASE || "").replace(/\/api\/?$/, "") ||
  "http://localhost:4000";

function normalizeImageUrl(raw) {
  if (!raw) return "";

  const url = String(raw).trim();

  // כבר URL מלא / data / blob
  if (/^(https?:|data:|blob:)/i.test(url)) {
    return url;
  }

  const marker = "/uploads/";
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = url.slice(idx); // "/uploads/..."
    return `${API_ORIGIN}${path}`;
  }

  // כל נתיב שמתחיל בסלאש
  if (url.startsWith("/")) {
    return `${API_ORIGIN}${url}`;
  }

  // אחרת מוסיפים סלאש
  return `${API_ORIGIN}/${url}`;
}

function toRelativeUploadUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const marker = "/uploads/";
  const idx = s.indexOf(marker);
  if (idx === -1) return s; // אם זה לא קובץ מה־uploads נשאיר כמו שהוא
  return s.slice(idx); // מחזיר "/uploads/xxx.jpg"
}

function canonUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  const marker = "/uploads/";
  const idx = s.indexOf(marker);
  return idx !== -1 ? s.slice(idx) : s; // תמיד נשווה לפי "/uploads/xxx"
}

const getToken = () => localStorage.getItem("auth_token");
const getStoredUserId = () => {
  const v = localStorage.getItem("user_id");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

async function jsonFetch(
  path,
  { method = "GET", token, body, extraHeaders } = {}
) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(extraHeaders || {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

const favoritesApi = {
  list: (extraHeaders) =>
    jsonFetch(`/api/userfav/favorites`, {
      token: getToken(),
      extraHeaders,
    }),
  add: (productId, extraHeaders) =>
    jsonFetch(`/api/userfav/favorites/${productId}`, {
      method: "POST",
      token: getToken(),
      extraHeaders,
    }),
  remove: (productId, extraHeaders) =>
    jsonFetch(`/api/userfav/favorites/${productId}`, {
      method: "DELETE",
      token: getToken(),
      extraHeaders,
    }),
};

async function uploadImage(file) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: fd,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || (!data?.url && !data?.relativeUrl)) {
    throw new Error("העלאת תמונה נכשלה");
  }

  // נעדיף תמיד לשמור נתיב יחסי /uploads/xxx
  return data.relativeUrl || data.url;
}

// 🔹 אייקון עט
const EditIcon = ({ size = 16 }) => (
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

// 🔹 אייקון פח
const TrashIcon = ({ size = 16 }) => (
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

function PaginationAdvanced({ page, totalPages, onChange }) {
  const compact = typeof window !== "undefined" && window.innerWidth < 640;
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

const HeartIcon = ({ filled, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {filled ? (
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="currentColor"
      />
    ) : (
      <path
        d="M16.5 3c-1.74 0-3.41.81-4.5 2.09A6.06 6.06 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 3.0 2.2 5.7 6.55 9.54L12 21.35l3.45-3.31C19.8 14.2 22 11.5 22 8.5A5.5 5.5 0 0 0 16.5 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

const EyeIcon = ({ size = 14 }) => (
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
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CartIcon = ({ size = 14 }) => (
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
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.5 13h11l2.5-8H6" />
  </svg>
);

const EMPTY_FORM = {
  title: "",
  description: "",
  price: "",
  discount_type: "NONE",
  discount_value: "",
  usage_text: "",
  components_text: "",
  image_url: "",
  images: [], // תמונות משניות בלבד
  primaryFile: null,
  stock_qty: "",
};

export default function AllProducts({ adminMode = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [paging, setPaging] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [liked, setLiked] = useState(() => new Set());
  const [userId, setUserId] = useState(getStoredUserId());

  const [productStats, setProductStats] = useState({});
  const [categories, setCategories] = useState([]);

  const [sp, setSp] = useSearchParams();
  const pageFromUrl = Math.max(Number(sp.get("page") || 1), 1);

  const adminFromQuery = sp.get("admin") === "1";
  const isAdmin = adminMode || adminFromQuery;
  const isAuthed = Boolean(getToken() && userId);

  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    product: null,
    loading: false,
  });

  const [bulkDiscountModal, setBulkDiscountModal] = useState({
    open: false,
    saving: false,
    error: "",
    mode: "NONE", // NONE | PERCENT | FIXED
    value: "",
    rows: [],
  });

  const [editModal, setEditModal] = useState({
    open: false,
    isNew: false,
    product: null,
    saving: false,
    originalUrls: [],
    removedUrls: [],
    error: "",
    form: { ...EMPTY_FORM },
  });

  const [fileInputKey, setFileInputKey] = useState(0);
  const bulkListRef = useRef(null);

  async function load(page = 1) {
    try {
      setLoading(true);
      setErr("");
      const pageSize = 10;
      const res = await fetch(
        `${API_BASE}/api/products?page=${page}&pageSize=${pageSize}`
      );
      if (!res.ok) throw new Error("שגיאה בטעינת מוצרים");
      const json = await res.json();
      setItems(json.data ?? []);
      setPaging(
        json.paging ?? {
          page,
          pageSize,
          total: (json.data ?? []).length,
          totalPages: 1,
        }
      );
    } catch (e) {
      setErr(e.message || "שגיאה בטעינת מוצרים");
    } finally {
      setLoading(false);
    }
  }

  function scrollBulkList(direction) {
    if (!bulkListRef.current) return;

    const rowHeight = 40;
    bulkListRef.current.scrollBy({
      top: direction * rowHeight * 3,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    if (userId) return;
    const t = getToken();
    if (!t) return;

    (async () => {
      try {
        const me = await jsonFetch(`/api/users/me`, { token: t });
        const uid =
          me?.id ?? me?.user_id ?? me?.userId ?? me?.data?.id;
        if (uid) {
          setUserId(uid);
          try {
            localStorage.setItem("user_id", String(uid));
          } catch {}
        }
      } catch {}
    })();
  }, [userId]);

  useEffect(() => {
    if (!isAuthed) return;
    const extraHeaders = { "X-User-Id": String(userId) };
    (async () => {
      try {
        const favRes = await favoritesApi.list(extraHeaders);
        const favs = Array.isArray(favRes?.favorites)
          ? favRes.favorites
          : [];
        setLiked(new Set(favs.map((f) => Number(f.product_id))));
      } catch {}
    })();
  }, [isAuthed, userId]);

  useEffect(() => {
    document.body.classList.remove("header-variant-shop");
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  useEffect(() => {
    load(pageFromUrl);
  }, [pageFromUrl]);

  // טעינת סטטיסטיקות מוצרים
  useEffect(() => {
    if (!items || items.length === 0) {
      setProductStats({});
      return;
    }

    const ids = [...new Set(items.map((p) => Number(p.id)))].filter(Boolean);
    if (!ids.length) return;

    const params = new URLSearchParams();
    params.set("ids", ids.join(","));

    async function loadStats() {
      try {
        const url = `${API_ORIGIN}/api/pageviews/product-stats?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("שגיאה בטעינת סטטיסטיקות מוצרים");
        const data = await res.json();

        const map = {};
        (data || []).forEach((row) => {
          const pid = Number(row.product_id);
          if (!pid) return;
          map[pid] = {
            views: Number(row.views || 0),
            sold: Number(row.sold || 0),
          };
        });
        setProductStats(map);
      } catch (e) {
        console.error("load productStats failed", e);
        setProductStats({});
      }
    }

    loadStats();
  }, [items]);

  // טעינת קטגוריות (אם תרצי להשתמש בהמשך לקטלוג)
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE}/api/categories`);
        if (!res.ok) throw new Error("שגיאה בטעינת קטגוריות");
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : json;
        setCategories(list);
      } catch (e) {
        console.error("loadCategories failed", e);
      }
    }

    loadCategories();
  }, []);

  function handlePageChange(nextPage) {
    setSp((prev) => {
      const q = new URLSearchParams(prev);
      q.set("page", String(nextPage));
      return q;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleFavorite(id) {
    if (!isAuthed) {
      alert("כדי לשמור למועדפים צריך להתחבר 💖");
      return;
    }

    const extraHeaders = { "X-User-Id": String(userId) };
    const isLikedNow = liked.has(id);

    setLiked((prev) => {
      const n = new Set(prev);
      if (isLikedNow) n.delete(id);
      else n.add(id);
      return n;
    });

    try {
      if (isLikedNow) await favoritesApi.remove(id, extraHeaders);
      else await favoritesApi.add(id, extraHeaders);
    } catch {
      setLiked((prev) => {
        const n = new Set(prev);
        if (isLikedNow) n.add(id);
        else n.delete(id);
        return n;
      });
      alert("לא ניתן לעדכן מועדפים כרגע");
    }
  }

  // מחיקת קבצים מהשרת
  async function deleteUploadedFiles(urls = []) {
    const clean = urls.filter(Boolean);
    if (!clean.length) return;

    try {
      await fetch(`${API_BASE}/api/uploads/cleanup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ urls: clean }),
      });
    } catch (e) {
      console.warn("deleteUploadedFiles failed", e);
    }
  }

  // 🔹 פתיחת כרטיס האישור ממוצר מסוים
  function askDelete(p) {
    setConfirmDelete({
      open: true,
      product: p,
      loading: false,
    });
  }

  // 🔹 מחיקה אמיתית אחרי אישור + ניקוי תמונות
  async function confirmDeleteNow() {
    if (!confirmDelete.product) return;
    const p = confirmDelete.product;

    try {
      setConfirmDelete((prev) => ({ ...prev, loading: true }));

      const urlSet = new Set();
      if (p.image_url) urlSet.add(p.image_url);
      if (p.hover_image_url) urlSet.add(p.hover_image_url);

      try {
        const imgsRes = await fetch(`${API_BASE}/api/products/${p.id}/images`);
        if (imgsRes.ok) {
          const imgs = await imgsRes.json();
          if (Array.isArray(imgs)) {
            imgs.forEach((im) => {
              if (im?.url) urlSet.add(im.url);
            });
          }
        }
      } catch (e) {
        console.warn("load product images for delete failed", e);
      }

      const res = await fetch(`${API_BASE}/api/products/${p.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
      if (!res.ok) throw new Error("delete failed");

      await deleteUploadedFiles(Array.from(urlSet));

      await load(pageFromUrl);
      setConfirmDelete({ open: false, product: null, loading: false });
    } catch (e) {
      console.error(e);
      alert("לא הצלחתי למחוק");
      setConfirmDelete({ open: false, product: null, loading: false });
    }
  }

  function openNewProductModal() {
    setEditModal({
      open: true,
      isNew: true,
      product: null,
      saving: false,
      error: "",
      removedUrls: [],
      originalUrls: [],
      form: { ...EMPTY_FORM },
    });
    setFileInputKey((k) => k + 1);
  }

  function closeEditModal() {
    setEditModal({
      open: false,
      isNew: false,
      product: null,
      saving: false,
      error: "",
      originalUrls: [],
      removedUrls: [],
      form: { ...EMPTY_FORM },
    });
    setFileInputKey((k) => k + 1);
  }

  function updateEditField(name, value) {
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        [name]: value,
      },
    }));
  }

  function setImages(updater) {
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        images:
          typeof updater === "function"
            ? updater(prev.form.images || [])
            : updater,
      },
    }));
  }

  function handlePrimaryFileSelected(e) {
    const file = (e.target.files || [])[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);

    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        image_url: localUrl,
        primaryFile: file,
      },
    }));

    e.target.value = "";
  }

  function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setImages((prevImages) => {
      const next = [...(prevImages || [])];

      for (const file of files) {
        if (next.length >= 10) break;
        const url = URL.createObjectURL(file);
        next.push({ url, file });
      }

      return next;
    });

    setFileInputKey((k) => k + 1);
  }

  function removeImage(url, isPrimary = false) {
    if (isPrimary) {
      setEditModal((prev) => ({
        ...prev,
        removedUrls: [...(prev.removedUrls || []), url],
        form: {
          ...prev.form,
          image_url: "",
          primaryFile: null,
        },
      }));
    } else {
      setEditModal((prev) => ({
        ...prev,
        removedUrls: [...(prev.removedUrls || []), url],
        form: {
          ...prev.form,
          images: (prev.form.images || []).filter(
            (im) => im.url !== url
          ),
        },
      }));
    }
  }

  function setPrimaryImage(url) {
    setEditModal((prev) => {
      const prevPrimary = prev.form.image_url;
      let images = prev.form.images || [];

      images = images.filter((im) => im.url !== url);

      if (
        prevPrimary &&
        prevPrimary !== url &&
        !images.some((im) => im.url === prevPrimary)
      ) {
        images = [{ url: prevPrimary }, ...images].slice(0, 10);
      }

      return {
        ...prev,
        form: {
          ...prev.form,
          image_url: url,
          primaryFile: null,
          images,
        },
      };
    });
  }

  async function openEditModal(p) {
    setEditModal({
      open: true,
      isNew: false,
      product: p,
      saving: false,
      error: "",
      originalUrls: [],
      removedUrls: [],
      form: {
        ...EMPTY_FORM,
        title: p.title || "",
        description: p.description || "",
        price: p.price != null ? String(p.price) : "",
        discount_type: p.discount_type || "NONE",
        discount_value:
          p.discount_value != null ? String(p.discount_value) : "",
        stock_qty: p.stock_qty != null ? String(p.stock_qty) : "",
      },
    });

    try {
      const res = await fetch(`${API_BASE}/api/products/${p.id}`);
      if (!res.ok) return;
      const json = await res.json();
      const full = json?.data || json;

      let imgs = [];
      try {
        const imgsRes = await fetch(`${API_BASE}/api/products/${p.id}/images`);
        if (imgsRes.ok) {
          imgs = await imgsRes.json();
        }
      } catch {
        imgs = [];
      }

      const baseMapped =
        Array.isArray(imgs) && imgs.length
          ? imgs
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((r) => ({ id: r.id, url: toRelativeUploadUrl(r.url) }))
              .slice(0, 10)
          : Array.isArray(full.images)
          ? full.images
              .slice(0, 10)
              .map((url) => ({ url: toRelativeUploadUrl(url) }))
          : [];

      const mapped = baseMapped.filter((im) => im.url);

      setEditModal((prev) => {
        if (!prev.open || prev.product?.id !== p.id) return prev;

        const primaryCandidate =
          full.image_url || mapped[0]?.url || prev.form.image_url || "";

        const primary = toRelativeUploadUrl(primaryCandidate);

        const secondary = mapped.filter(
          (im) => im.url && im.url !== primary
        );

        const originalUrls = [
          primary,
          ...secondary.map((im) => im.url),
        ].filter(Boolean);

        return {
          ...prev,
          originalUrls,
          form: {
            ...prev.form,
            title: full.title || prev.form.title,
            description: full.description || prev.form.description,
            price:
              full.price != null ? String(full.price) : prev.form.price,
            discount_type:
              full.discount_type || prev.form.discount_type || "NONE",
            discount_value:
              full.discount_value != null
                ? String(full.discount_value)
                : prev.form.discount_value,
            usage_text: full.usage_text || prev.form.usage_text,
            components_text:
              full.components_text || prev.form.components_text,
            image_url: primary,
            primaryFile: null,
            images: secondary,
            stock_qty:
              full.stock_qty != null
                ? String(full.stock_qty)
                : prev.form.stock_qty,
          },
        };
      });
    } catch {
      // אם נכשל, לפחות יש את המינימום מ-p
    }
  }

  async function saveEdit() {
    if (!editModal.open) return;

    try {
      setEditModal((prev) => ({ ...prev, saving: true, error: "" }));

      const f = editModal.form;
      let images = [...(f.images || [])];
      let primaryUrl = (f.image_url || "").trim();

      if (f.primaryFile) {
        const uploadedPrimary = await uploadImage(f.primaryFile);
        primaryUrl = uploadedPrimary;
      }

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.file) {
          const uploadedUrl = await uploadImage(img.file);
          images[i] = { url: uploadedUrl };
        }
      }

      images = images
        .map((im) => ({ url: (im.url || "").trim() }))
        .filter((im) => im.url.length > 0)
        .slice(0, 10);

      const urlsToDelete = [];

      const primaryCanon = canonUrl(primaryUrl);
      const secondaryCanonList = images.map((im) => canonUrl(im.url));

      const removedManual = Array.isArray(editModal.removedUrls)
        ? editModal.removedUrls
        : [];

      for (const u of removedManual) {
        const cu = canonUrl(u);
        if (!cu) continue;
        if (cu === primaryCanon) continue;
        if (secondaryCanonList.includes(cu)) continue;
        urlsToDelete.push(u);
      }

      const original = Array.isArray(editModal.originalUrls)
        ? editModal.originalUrls
        : [];
      const originalPrimary = original[0] || null;

      if (!editModal.isNew && originalPrimary) {
        const origPrimCanon = canonUrl(originalPrimary);
        if (
          origPrimCanon &&
          origPrimCanon !== primaryCanon &&
          !secondaryCanonList.includes(origPrimCanon)
        ) {
          urlsToDelete.push(originalPrimary);
        }
      }

      let payloadStockQty;
      if (editModal.isNew) {
        payloadStockQty =
          f.stock_qty !== "" && f.stock_qty != null
            ? Number(f.stock_qty)
            : 0;
      } else {
        payloadStockQty =
          f.stock_qty === "" || f.stock_qty == null
            ? undefined
            : Number(f.stock_qty);
      }

      const payload = {
        title: f.title?.trim() || "",
        description: f.description?.trim() || "",
        price: f.price ? Number(f.price) : 0,
        discount_type: f.discount_type || "NONE",
        discount_value:
          f.discount_type === "NONE"
            ? null
            : f.discount_value
            ? Number(f.discount_value)
            : 0,
        usage_text: f.usage_text || null,
        components_text: f.components_text || null,
        image_url: primaryUrl || (images[0]?.url || null),
      };

      if (payloadStockQty !== undefined) {
        payload.stock_qty = payloadStockQty;
      }

      const headers = {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      };

      let productId = editModal.product?.id;

      if (editModal.isNew) {
        const res = await fetch(`${API_BASE}/api/products`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "יצירת מוצר נכשלה");
        }

        productId = data?.data?.id || data?.id;
      } else {
        if (!productId) {
          throw new Error("חסר productId לעדכון");
        }
        const res = await fetch(`${API_BASE}/api/products/${productId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "עדכון מוצר נכשל");
        }
      }

      let existing = [];
      try {
        const imgsRes = await fetch(
          `${API_BASE}/api/products/${productId}/images`
        );
        if (imgsRes.ok) {
          existing = await imgsRes.json();
        }
      } catch {
        existing = [];
      }

      await Promise.all(
        existing.map((img) =>
          fetch(`${API_BASE}/api/product-images/${img.id}`, {
            method: "DELETE",
            headers,
          }).catch(() => {})
        )
      );

      await Promise.all(
        images.map((im, i) =>
          fetch(`${API_BASE}/api/products/${productId}/images`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              url: im.url,
              sort_order: i,
            }),
          }).catch(() => {})
        )
      );

      await deleteUploadedFiles(urlsToDelete);

      await load(pageFromUrl);
      closeEditModal();
    } catch (e) {
      setEditModal((prev) => ({
        ...prev,
        saving: false,
        error: e.message || "שמירה נכשלה",
      }));
    }
  }

  function rowsFromItems(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => ({
      id: Number(p.id),
      title: p.title || "",
      price: Number(p.price) || 0,
      selected: false,
    }));
  }

  function openBulkDiscountModal() {
    const rows = rowsFromItems(items);

    setBulkDiscountModal({
      open: true,
      saving: false,
      error: "",
      mode: "NONE",
      value: "",
      rows,
    });
  }

  function closeBulkDiscountModal() {
    setBulkDiscountModal({
      open: false,
      rows: [],
      mode: "PERCENT",
      value: "",
      saving: false,
      error: "",
    });
  }

  function toggleSelectRow(id) {
    setBulkDiscountModal((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        Number(r.id) === Number(id)
          ? { ...r, selected: !r.selected }
          : r
      ),
    }));
  }

  function toggleSelectAllBulk() {
    setBulkDiscountModal((prev) => {
      if (!prev.rows.length) return prev;

      const allSelected = prev.rows.every((r) => r.selected);
      const rows = prev.rows.map((r) => ({
        ...r,
        selected: !allSelected,
      }));

      return { ...prev, rows };
    });
  }

  async function applyBulkDiscount() {
    try {
      setBulkDiscountModal((prev) => ({
        ...prev,
        saving: true,
        error: "",
      }));

      const selectedRows = (bulkDiscountModal.rows || []).filter(
        (r) => r.selected
      );
      if (!selectedRows.length) {
        throw new Error("לא נבחרו מוצרים");
      }

      const mode = bulkDiscountModal.mode;
      let val = null;

      if (mode !== "NONE") {
        if (!bulkDiscountModal.value) {
          throw new Error("נא למלא ערך להנחה");
        }
        val = Number(bulkDiscountModal.value);
        if (!Number.isFinite(val) || val < 0) {
          throw new Error("ערך הנחה לא תקין");
        }
      }

      const headers = {
        "Content-Type": "application/json",
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      };

      await Promise.all(
        selectedRows.map((r) =>
          fetch(`${API_BASE}/api/products/${r.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              discount_type: mode === "NONE" ? "NONE" : mode,
              discount_value: mode === "NONE" ? null : val,
            }),
          }).then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(
                data?.error ||
                  `שגיאה בעדכון הנחה למוצר "${r.title}"`
              );
            }
          })
        )
      );

      await load(pageFromUrl);
      closeBulkDiscountModal();
    } catch (e) {
      setBulkDiscountModal((prev) => ({
        ...prev,
        saving: false,
        error: e.message || "שמירת הנחות נכשלה",
      }));
    }
  }

  const secondaryImages = useMemo(() => {
    return (editModal.form.images || []).filter((im) => im?.url);
  }, [editModal.form.images]);

  function getStatsForProduct(stats, productId) {
    const s = stats?.[Number(productId)] || {};
    return {
      views: s.views ?? 0,
      sold: s.sold ?? 0,
    };
  }

  return (
    <>
      <SiteHeader />
      <main className="acct-wrap">
        <section className="acct-section">
          <nav className="acct-breadcrumb" aria-label="breadcrumb" dir="rtl">
            <ol>
              <li>
                <Link to="/">דף הבית</Link>
              </li>
              <li aria-current="page">כל המוצרים</li>
            </ol>
          </nav>

          <h1 className="acct-h1">כל המוצרים</h1>
          <h2>קנו עכשיו מוצרי שיער , החלקות ביתיות ואת הערכות שלנו</h2>

          {/* כפתורי אדמין */}
          {isAdmin && (
            <div className="admin-add-product-wrapper">
              <div className="admin-vertical-divider" />

              <button
                type="button"
                className="admin-add-product-btn"
                onClick={openNewProductModal}
              >
                + <br />
                הוספת מוצר
              </button>
              <div className="admin-vertical-divider" />

              <button
                type="button"
                className="admin-add-product-btn"
                style={{ marginRight: 12 }}
                onClick={openBulkDiscountModal}
              >
                % <br />
                הנחה על מוצרים
              </button>
            </div>
          )}

          <hr className="full-divider" />

          {loading && <p className="acct-sub">טוען…</p>}
          {err && <div className="acct-error">{err}</div>}
          {!loading && !err && items.length === 0 && (
            <p className="acct-sub">לא נמצאו מוצרים.</p>
          )}

          {!loading && !err && items.length > 0 && (
            <>
              <div className="products-grid">
                {items.map((p) => {
                  const mainSrc = normalizeImageUrl(
                    p.image_url ||
                      `https://picsum.photos/seed/prod${p.id}/600/600`
                  );
                  const rawHover = p.hover_image_url || null;
                  const hoverSrc =
                    rawHover && rawHover !== p.image_url
                      ? normalizeImageUrl(rawHover)
                      : null;
                  const hasHover = Boolean(hoverSrc);
                  const isLikedThis = liked.has(Number(p.id));

                  const stats = getStatsForProduct(productStats, p.id);

                  const isSoldOut =
                    p.stock_qty !== null &&
                    p.stock_qty !== undefined &&
                    Number(p.stock_qty) <= 0;

                  return (
                    <article
                      key={p.id}
                      className={`product-card ${
                        hasHover ? "has-hover" : ""
                      }`}
                      style={{ position: "relative" }}
                    >
                      {isAdmin && (
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 20,
                            display: "flex",
                            gap: 6,
                            zIndex: 10,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="עריכה"
                            style={{
                              background: "rgba(0,0,0,0.35)",
                              border: "1px solid rgba(255,255,255,0.35)",
                              borderRadius: 999,
                              width: 28,
                              height: 28,
                              display: "grid",
                              placeItems: "center",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <EditIcon size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => askDelete(p)}
                            title="מחיקה"
                            style={{
                              background: "rgba(180,0,0,0.45)",
                              border: "1px solid rgba(255,0,0,0.3)",
                              borderRadius: 999,
                              width: 28,
                              height: 28,
                              display: "grid",
                              placeItems: "center",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <TrashIcon size={15} />
                          </button>
                        </div>
                      )}

                      <Link
                        to={`/product/${p.id}`}
                        className="product-card-link"
                        aria-label={`לצפייה במוצר: ${p.title}`}
                      >
                        <div
                          className="product-thumb"
                          style={{ position: "relative" }}
                        >
                          {isSoldOut && (
                            <div
                              className="sold-out-badge"
                              style={{
                                position: "absolute",
                                top: 10,
                                left: 40,
                                width: 48,
                                height: 48,
                                background: "rgba(0, 0, 0, 0.93)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: "50%",
                                zIndex: 5,
                                textAlign: "center",
                                lineHeight: 1.1,
                                padding: 4,
                              }}
                            >
                              SOLD OUT
                            </div>
                          )}

                          <img
                            className="img-main"
                            src={mainSrc}
                            alt={p.title}
                            loading="lazy"
                            decoding="async"
                          />
                          {hasHover && (
                            <img
                              className="img-hover"
                              src={hoverSrc}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                e.currentTarget.remove();
                                e.currentTarget
                                  .closest(".product-card")
                                  ?.classList.remove("has-hover");
                              }}
                            />
                          )}
                        </div>

                        <div style={{ padding: 12 }}>
                          <h3>{p.title}</h3>
                          <p className="product-sub">{p.description}</p>
                          <div className="price-row">
                            {p.final_price != null &&
                            p.final_price !== p.price ? (
                              <>
                                <span className="price-oldpage">
                                  ₪ {p.price}
                                </span>
                                <span className="price-nowpage">
                                  ₪ {p.final_price}
                                </span>
                              </>
                            ) : (
                              <span className="price-nowpage">
                                ₪ {p.price}
                              </span>
                            )}
                          </div>

                          {isAdmin && (
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 12,
                                color: "#666",
                              }}
                            >
                              מלאי:{" "}
                              <strong>{p.stock_qty ?? 0}</strong>
                            </div>
                          )}

                          {isAdmin && (
                            <div
                              className="product-stats-row"
                              style={{
                                display: "flex",
                                gap: 10,
                                marginTop: 6,
                                marginLeft: 30,
                                fontSize: 11,
                                color: "#777",
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <EyeIcon size={14} />
                                <strong>{stats.views}</strong>
                              </span>

                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <CartIcon size={14} />
                                <strong>{stats.sold}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>

                      {!isAdmin && isAuthed && (
                        <button
                          type="button"
                          onClick={() => toggleFavorite(Number(p.id))}
                          aria-pressed={isLikedThis}
                          aria-label={
                            isLikedThis
                              ? "הסר ממועדפים"
                              : "הוסף למועדפים"
                          }
                          className="fav-fab"
                          data-liked={isLikedThis ? "true" : "false"}
                          title={
                            isLikedThis
                              ? "הסר ממועדפים"
                              : "הוסף למועדפים"
                          }
                        >
                          <HeartIcon filled={isLikedThis} />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>

              <PaginationAdvanced
                page={paging.page}
                totalPages={paging.totalPages}
                onChange={handlePageChange}
              />
            </>
          )}
        </section>
      </main>

      {/* מודאל הנחות מרוכזות */}
      {isAdmin && bulkDiscountModal.open && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="cardError cardEdit">
            <button
              className="dismiss"
              type="button"
              onClick={closeBulkDiscountModal}
              aria-label="סגירה"
            >
              ×
            </button>

            <div className="header">
              <div className="content" dir="rtl">
                <span className="title">הגדרת הנחות למוצרים</span>
                <p className="message">
                  בחרי אילו מוצרים לקבל הנחה, סוג ההנחה, ולחצי על
                  &quot;החלת הנחות&quot;.
                </p>

                <div className="product-edit-grid">
                  <div className="product-edit-main">
                    <div className="edit-field">
                      <button
                        type="button"
                        className="history"
                        onClick={toggleSelectAllBulk}
                      >
                        סימון / ביטול כל המוצרים
                      </button>
                    </div>

                    <div className="bulk-discount-wrapper">
                      <button
                        type="button"
                        className="bulk-scroll-btn up"
                        onClick={() => scrollBulkList(-1)}
                        aria-label="גלילה למעלה"
                      >
                        ▲
                      </button>

                      <div
                        className="bulk-discount-list"
                        ref={bulkListRef}
                      >
                        {(Array.isArray(bulkDiscountModal.rows)
                          ? bulkDiscountModal.rows
                          : []
                        ).map((row) => (
                          <label
                            key={row.id}
                            className="bulk-discount-row"
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!!row.selected}
                              onChange={() => toggleSelectRow(row.id)}
                            />
                            <span style={{ flex: 1 }}>{row.title}</span>
                            <span
                              style={{
                                whiteSpace: "nowrap",
                                fontSize: 12,
                              }}
                            >
                              ₪ {row.price}
                            </span>
                          </label>
                        ))}

                        {(!Array.isArray(bulkDiscountModal.rows) ||
                          bulkDiscountModal.rows.length === 0) && (
                          <p
                            style={{
                              fontSize: 13,
                              opacity: 0.7,
                              marginTop: 8,
                            }}
                          >
                            אין מוצרים זמינים להנחה.
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="bulk-scroll-btn down"
                        onClick={() => scrollBulkList(1)}
                        aria-label="גלילה למטה"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  <div className="product-edit-side">
                    <div className="product-edit-images-box">
                      <div className="edit-field">
                        <label>סוג הנחה</label>
                        <select
                          value={bulkDiscountModal.mode}
                          onChange={(e) =>
                            setBulkDiscountModal((prev) => ({
                              ...prev,
                              mode: e.target.value,
                              value:
                                e.target.value === "NONE"
                                  ? ""
                                  : prev.value,
                            }))
                          }
                        >
                          <option value="NONE">ללא הנחה</option>
                          <option value="PERCENT">אחוזים (%)</option>
                          <option value="FIXED">סכום קבוע (₪)</option>
                        </select>
                      </div>

                      {bulkDiscountModal.mode !== "NONE" && (
                        <div className="edit-field">
                          <label>
                            {bulkDiscountModal.mode === "PERCENT"
                              ? "אחוז הנחה (%)"
                              : "סכום הנחה (₪)"}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={bulkDiscountModal.value}
                            onChange={(e) =>
                              setBulkDiscountModal((prev) => ({
                                ...prev,
                                value: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}

                      {bulkDiscountModal.error && (
                        <div className="product-edit-errors">
                          {bulkDiscountModal.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="actions">
                  <button
                    className="history"
                    type="button"
                    onClick={applyBulkDiscount}
                    disabled={bulkDiscountModal.saving}
                  >
                    {bulkDiscountModal.saving
                      ? "מיישמת…"
                      : "החלת הנחות"}
                  </button>
                  <button
                    className="track"
                    type="button"
                    onClick={closeBulkDiscountModal}
                    disabled={bulkDiscountModal.saving}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* כרטיס אישור מחיקה */}
      {isAdmin && confirmDelete.open && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="cardError">
            <button
              className="dismiss"
              type="button"
              onClick={() =>
                setConfirmDelete({
                  open: false,
                  product: null,
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

              <div className="content">
                <span className="title">למחוק את המוצר?</span>
                <p className="message">
                  את בטוחה שברצונך למחוק את{" "}
                  <strong>
                    "{confirmDelete.product?.title || "המוצר הזה"}"
                  </strong>
                  ? <br />
                  לאחר מחיקה לא ניתן לשחזר אותו.
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
                      product: null,
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

      {/* חלון עריכה */}
      {isAdmin && editModal.open && (
        <div className="confirm-backdrop" role="dialog" aria-modal="true">
          <div className="cardError cardEdit">
            <button
              className="dismiss"
              type="button"
              onClick={closeEditModal}
              aria-label="סגירה"
            >
              ×
            </button>

            <div className="header">
              <div className="image"></div>

              <div className="content" dir="rtl">
                <span className="title">
                  {editModal.isNew ? "הוספת מוצר חדש" : "עריכת מוצר"}
                </span>
                <p className="message">ערכי את פרטי המוצר ותמונות הגלריה.</p>

                <div className="product-edit-grid">
                  <div className="product-edit-main">
                    <div className="edit-field">
                      <label>כותרת המוצר</label>
                      <input
                        type="text"
                        value={editModal.form.title}
                        onChange={(e) =>
                          updateEditField("title", e.target.value)
                        }
                      />
                    </div>

                    <div className="edit-field">
                      <label>כותרת משנית</label>
                      <textarea
                        rows={3}
                        value={editModal.form.description}
                        onChange={(e) =>
                          updateEditField("description", e.target.value)
                        }
                      />
                    </div>

                    <div className="product-edit-grid-2">
                      <div className="edit-field">
                        <label>מחיר רגיל (₪)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editModal.form.price}
                          onChange={(e) =>
                            updateEditField("price", e.target.value)
                          }
                        />
                      </div>

                      <div className="edit-field">
                        <label>סוג הנחה</label>
                        <select
                          value={editModal.form.discount_type}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditModal((prev) => ({
                              ...prev,
                              form: {
                                ...prev.form,
                                discount_type: val,
                                discount_value:
                                  val === "NONE"
                                    ? ""
                                    : prev.form.discount_value,
                              },
                            }));
                          }}
                        >
                          <option value="NONE">ללא הנחה</option>
                          <option value="PERCENT">אחוזים (%)</option>
                          <option value="FIXED">סכום קבוע (₪)</option>
                        </select>
                      </div>
                    </div>

                    <div className="edit-field">
                      <label>מלאי (יחידות)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editModal.form.stock_qty ?? ""}
                        onChange={(e) =>
                          updateEditField("stock_qty", e.target.value)
                        }
                      />
                    </div>

                    {editModal.form.discount_type !== "NONE" && (
                      <div className="edit-field">
                        <label>
                          {editModal.form.discount_type === "PERCENT"
                            ? "אחוז הנחה (%)"
                            : "סכום הנחה (₪)"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editModal.form.discount_value}
                          onChange={(e) =>
                            updateEditField("discount_value", e.target.value)
                          }
                        />
                      </div>
                    )}

                    <div className="edit-field">
                      <label>תיאור / מרכיבים</label>
                      <textarea
                        rows={3}
                        value={editModal.form.components_text}
                        onChange={(e) =>
                          updateEditField("components_text", e.target.value)
                        }
                      />
                    </div>

                    <div className="edit-field">
                      <label>הוראות שימוש</label>
                      <textarea
                        rows={3}
                        value={editModal.form.usage_text}
                        onChange={(e) =>
                          updateEditField("usage_text", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="product-edit-side">
                    <div className="product-edit-images-box">
                      <div className="product-edit-images-box-title">
                        גלריית תמונות (עד 10)
                      </div>

                      <div className="edit-field">
                        <small>
                          לחצי על תמונה כדי לבחור אותה כתמונה הראשית, ניתן
                          להעלות תמונות חדשות.
                        </small>
                      </div>

                      <div className="edit-field product-edit-primary">
                        <label>תמונה ראשית</label>

                        <div className="product-primary-row">
                          <div className="product-primary-thumb">
                            {editModal.form.image_url ? (
                              <img
                                src={normalizeImageUrl(
                                  editModal.form.image_url
                                )}
                                alt="תמונה ראשית"
                              />
                            ) : (
                              <span className="product-primary-placeholder">
                                אין תמונה ראשית
                              </span>
                            )}
                            <label
                              className="product-primary-upload"
                              aria-label="בחירת תמונה מהמחשב"
                              title="בחירת תמונה מהמחשב"
                            >
                              <EditIcon size={15} />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handlePrimaryFileSelected}
                                style={{
                                  display: "none",
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="edit-field product-edit-primary">
                        <label>תמונות משניות</label>
                      </div>

                      <div className="product-images-list">
                        {secondaryImages.map((img, idx) => (
                          <div
                            className="product-image-row"
                            key={`${img.url}-${idx}`}
                          >
                            <div className="product-image-thumb">
                              <img
                                src={normalizeImageUrl(img.url)}
                                alt=""
                                onClick={() => setPrimaryImage(img.url)}
                                style={{ cursor: "pointer" }}
                              />
                            </div>

                            <div className="product-image-actions">
                              <button
                                type="button"
                                className="product-image-delete"
                                onClick={() => removeImage(img.url, false)}
                                aria-label="מחיקת תמונה"
                                title="מחיקה"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {(!editModal.form.images ||
                          editModal.form.images.length < 10) && (
                          <label className="product-image-add-tile">
                            <span className="plus">+</span>
                            <span>הוספת תמונה</span>
                            <input
                              key={fileInputKey}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleFilesSelected}
                              style={{ display: "none" }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {editModal.error && (
                      <div className="product-edit-errors">
                        {editModal.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="actions">
                  <button
                    className="history"
                    type="button"
                    onClick={saveEdit}
                    disabled={editModal.saving}
                  >
                    {editModal.saving ? "שומר…" : "שמירת שינויים"}
                  </button>
                  <button
                    className="track"
                    type="button"
                    onClick={closeEditModal}
                    disabled={editModal.saving}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </>
  );
}
