// src/components/admin/AdminProducts.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// ==== הגדרות API בסיסיות ====
const API_BASE = process.env.REACT_APP_API_BASE || "";

const PUBLIC_ORIGIN =
  process.env.REACT_APP_PUBLIC_BASE_URL ||
  API_BASE.replace(/\/api\/?$/, "") ||
  "http://localhost:4000";

const getToken = () => localStorage.getItem("auth_token");

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

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

// ==== עזר לתמונות ====
function normalizeImageUrl(raw) {
  if (!raw) return "";
  const url = String(raw).trim();

  // כבר URL מלא / data / blob
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  const marker = "/uploads/";
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    const path = url.slice(idx); // "/uploads/..."
    return `${PUBLIC_ORIGIN}${path}`;
  }

  if (url.startsWith("/")) {
    return `${PUBLIC_ORIGIN}${url}`;
  }

  return `${PUBLIC_ORIGIN}/${url}`;
}

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

  // תמיד נשמור נתיב יחסי אם יש
  return data.relativeUrl || data.url;
}

function toRelativeUploadUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  const marker = "/uploads/";
  const idx = s.indexOf(marker);
  if (idx === -1) return s;
  return s.slice(idx); // "/uploads/xxx"
}

function canonUrl(u) {
  if (!u) return "";
  const s = String(u).trim();
  const marker = "/uploads/";
  const idx = s.indexOf(marker);
  return idx !== -1 ? s.slice(idx) : s;
}

async function deleteUploadedFiles(urls = []) {
  const clean = urls.filter(Boolean);
  if (!clean.length) return;

  try {
    const token = getToken();
    await fetch(`${API_BASE}/api/uploads/cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ urls: clean }),
    });
  } catch (e) {
    console.warn("deleteUploadedFiles failed", e);
  }
}

// ==== קבועי קטגוריות (על בסיס הסלאגים שלך) ====
const CAT_SMOOTHING_SLUG = "home-smoothing";
const CAT_HAIR_SLUG = "hair-products";
const CAT_HOME_KITS_SLUG = "home-kits";

const ADMIN_CATEGORIES = [
  { key: "home-smoothing", label: "החלקות ביתיות", slug: CAT_SMOOTHING_SLUG },
  { key: "hair-products", label: "מוצרי שיער", slug: CAT_HAIR_SLUG },
  { key: "home-kits", label: "קיטים לבית", slug: CAT_HOME_KITS_SLUG },
];

// ==== חישוב מחיר סופי (אותו לוגיקה כמו ב־backend) ====
function computeFinalPrice(price, discountType, discountValue) {
  const p = Number(price) || 0;
  if (discountType === "PERCENT" && discountValue != null) {
    return Math.round(p * (1 - Number(discountValue) / 100) * 100) / 100;
  }
  if (discountType === "FIXED" && discountValue != null) {
    return Math.max(0, Math.round((p - Number(discountValue)) * 100) / 100);
  }
  return p;
}

// ==== ברירת מחדל לקופון ====
const EMPTY_COUPON = {
  code: "",
  type: "PERCENT",
  value: "",
  min_subtotal: "",
  starts_at: "",
  ends_at: "",
  max_uses_total: "",
  max_uses_per_user: "",
  is_active: true,
  category_id: "",
};

// ==== ברירת מחדל למוצר (כולל גלריה) ====
const EMPTY_PRODUCT = {
  id: null,
  title: "",
  description: "",
  price: "",
  discount_type: "NONE",
  discount_value: "",
  stock_qty: "",
  category_id: "",
  usage_text: "",
  components_text: "",
  image_url: "", // נתיב יחסי של התמונה הראשית
  images: [], // [{url, file?}] תמונות משניות
  primaryFile: null, // קובץ של התמונה הראשית אם עלו חדשה
};

// helper ל־datetime-local
function toInputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminProducts() {
  const navigate = useNavigate();

  const goToClient = () => {
    localStorage.setItem("isAdminView", "1");
    navigate("/all-products?admin=1&bare=1");
  };

  // ===== קטגוריות למוצרים/קופונים =====
  const [categories, setCategories] = useState([]);

  async function loadCategories() {
    try {
      const res = await fetch(`${API_BASE}/api/categories`);
      if (!res.ok) throw new Error("שגיאה בטעינת קטגוריות");
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : json;
      setCategories(list || []);
    } catch (e) {
      console.error("loadCategories failed", e);
      setCategories([]);
    }
  }

  function findCategoryBySlug(slug) {
    if (!slug) return null;
    return (categories || []).find(
      (c) => c.slug === slug || c.category_slug === slug
    );
  }

  function getCategoryNameById(id) {
    if (!id) return "כל האתר";
    const cat = categories.find((c) => Number(c.id) === Number(id));
    return cat ? cat.name : `קטגוריה #${id}`;
  }

  // ===== קטגוריה פעילה בצד המנהל =====
  const [activeCategoryKey, setActiveCategoryKey] = useState("home-smoothing");
  function getActiveCategoryConfig(key = activeCategoryKey) {
    return (
      ADMIN_CATEGORIES.find((c) => c.key === key) || ADMIN_CATEGORIES[0]
    );
  }

  // ===== מוצרים =====
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsErr, setProductsErr] = useState("");

  async function loadProducts(categoryKey = activeCategoryKey) {
    try {
      setProductsLoading(true);
      setProductsErr("");
      const token = getToken();
      const cfg = getActiveCategoryConfig(categoryKey);

      let rows = [];
      if (!cfg.slug) {
        const data = await jsonFetch("/api/products?page=1&pageSize=300", {
          token,
        });
        rows = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];
      } else {
        const qs = new URLSearchParams({
          slug: cfg.slug,
          page: "1",
          pageSize: "300",
        });
        const data = await jsonFetch(
          `/api/products/by-category?${qs.toString()}`,
          { token }
        );
        rows = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : [];
      }

      setProducts(rows);
    } catch (e) {
      setProductsErr(e.message || "שגיאה בטעינת מוצרים");
    } finally {
      setProductsLoading(false);
    }
  }

  // ===== מודאל מוצר =====
  const [fileInputKey, setFileInputKey] = useState(0);

  const [productModal, setProductModal] = useState({
    open: false,
    saving: false,
    error: "",
    isNew: true,
    originalUrls: [], // [primary, ...secondary]
    removedUrls: [],
    form: { ...EMPTY_PRODUCT },
  });

  function openNewProductModal() {
    const cfg = getActiveCategoryConfig();
    let defaultCategoryId = "";
    if (cfg.slug) {
      const cat = findCategoryBySlug(cfg.slug);
      if (cat?.id) defaultCategoryId = String(cat.id);
    }
    setProductModal({
      open: true,
      saving: false,
      error: "",
      isNew: true,
      originalUrls: [],
      removedUrls: [],
      form: { ...EMPTY_PRODUCT, category_id: defaultCategoryId },
    });
    setFileInputKey((k) => k + 1);
  }

  async function openEditProductModal(p) {
    try {
      setProductModal({
        open: true,
        saving: false,
        error: "",
        isNew: false,
        originalUrls: [],
        removedUrls: [],
        form: {
          ...EMPTY_PRODUCT,
          id: p.id,
          title: p.title || "",
          description: p.description || "",
          price: p.price != null ? String(p.price) : "",
          discount_type: p.discount_type || "NONE",
          discount_value:
            p.discount_value != null ? String(p.discount_value) : "",
          stock_qty: p.stock_qty != null ? String(p.stock_qty) : "",
          category_id: p.category_id ? String(p.category_id) : "",
          image_url: p.image_url || "",
          images: [],
        },
      });

      const token = getToken();
      const full = await jsonFetch(`/api/products/${p.id}`, { token });
      const d = full?.data || full || {};

      // בניית גלריה (תמונות)
      const mapped =
        Array.isArray(d.images) && d.images.length
          ? d.images
              .slice(0, 10)
              .map((url) => ({ url: toRelativeUploadUrl(url) }))
          : [];

      const primaryCandidate =
        d.image_url ||
        mapped[0]?.url ||
        productModal.form.image_url ||
        "";
      const primary = toRelativeUploadUrl(primaryCandidate);

      const secondary = mapped.filter(
        (im) => im.url && im.url !== primary
      );

      const originalUrls = [
        primary,
        ...secondary.map((im) => im.url),
      ].filter(Boolean);

      setProductModal((prev) => {
        if (!prev.open) return prev;
        return {
          ...prev,
          originalUrls,
          removedUrls: [],
          form: {
            ...prev.form,
            title: d.title ?? prev.form.title,
            description: d.description ?? prev.form.description,
            price: d.price != null ? String(d.price) : prev.form.price,
            discount_type: d.discount_type || prev.form.discount_type,
            discount_value:
              d.discount_value != null
                ? String(d.discount_value)
                : prev.form.discount_value,
            stock_qty:
              d.stock_qty != null
                ? String(d.stock_qty)
                : prev.form.stock_qty,
            usage_text: d.usage_text ?? "",
            components_text: d.components_text ?? "",
            category_id:
              d.category_id != null
                ? String(d.category_id)
                : prev.form.category_id,
            image_url: primary || prev.form.image_url || "",
            images: secondary,
            primaryFile: null,
          },
        };
      });
    } catch (e) {
      console.error("openEditProductModal failed", e);
    }
  }

  function closeProductModal() {
    setProductModal({
      open: false,
      saving: false,
      error: "",
      isNew: true,
      originalUrls: [],
      removedUrls: [],
      form: { ...EMPTY_PRODUCT },
    });
    setFileInputKey((k) => k + 1);
  }

  function updateProductField(name, value) {
    setProductModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        [name]: value,
      },
    }));
  }

  function handlePrimaryFileSelected(e) {
    const file = (e.target.files || [])[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);

    setProductModal((prev) => ({
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

    setProductModal((prev) => {
      const existing = prev.form.images || [];
      const next = [...existing];

      for (const file of files) {
        if (next.length >= 10) break;
        const url = URL.createObjectURL(file);
        next.push({ url, file });
      }

      return {
        ...prev,
        form: {
          ...prev.form,
          images: next,
        },
      };
    });

    setFileInputKey((k) => k + 1);
  }

  function removeImage(url, isPrimary = false) {
    setProductModal((prev) => {
      const removed = [...(prev.removedUrls || []), url];

      if (isPrimary) {
        return {
          ...prev,
          removedUrls: removed,
          form: {
            ...prev.form,
            image_url: "",
            primaryFile: null,
          },
        };
      }

      return {
        ...prev,
        removedUrls: removed,
        form: {
          ...prev.form,
          images: (prev.form.images || []).filter(
            (im) => im.url !== url
          ),
        },
      };
    });
  }

  function setPrimaryImage(url) {
    setProductModal((prev) => {
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

  async function saveProduct() {
    if (!productModal.open) return;
    try {
      setProductModal((prev) => ({ ...prev, saving: true, error: "" }));

      const f = productModal.form;
      if (!f.title.trim()) throw new Error("חסר שם מוצר");

      // --- טיפול בתמונות: העלאה + בנייה של primary + secondary ---
      let images = [...(f.images || [])];
      let primaryUrl = (f.image_url || "").trim();

      if (f.primaryFile) {
        const uploadedPrimary = await uploadImage(f.primaryFile);
        primaryUrl = toRelativeUploadUrl(uploadedPrimary);
      }

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.file) {
          const uploadedUrl = await uploadImage(img.file);
          images[i] = { url: toRelativeUploadUrl(uploadedUrl) };
        }
      }

      images = images
        .map((im) => ({ url: toRelativeUploadUrl(im.url || "") }))
        .filter((im) => im.url.length > 0)
        .slice(0, 10);

      const primaryCanon = canonUrl(primaryUrl);
      const secondaryCanonList = images.map((im) => canonUrl(im.url));
      const urlsToDelete = [];

      const removedManual = Array.isArray(productModal.removedUrls)
        ? productModal.removedUrls
        : [];

      for (const u of removedManual) {
        const cu = canonUrl(u);
        if (!cu) continue;
        if (cu === primaryCanon) continue;
        if (secondaryCanonList.includes(cu)) continue;
        urlsToDelete.push(u);
      }

      const original = Array.isArray(productModal.originalUrls)
        ? productModal.originalUrls
        : [];
      const originalPrimary = original[0] || null;

      if (!productModal.isNew && originalPrimary) {
        const origPrimCanon = canonUrl(originalPrimary);
        if (
          origPrimCanon &&
          origPrimCanon !== primaryCanon &&
          !secondaryCanonList.includes(origPrimCanon)
        ) {
          urlsToDelete.push(originalPrimary);
        }
      }

      // --- בניית payload בסיסי למוצר ---
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

      // מלאי
      if (productModal.isNew) {
        payload.stock_qty =
          f.stock_qty !== "" && f.stock_qty != null
            ? Number(f.stock_qty)
            : 0;
      } else if (f.stock_qty !== "" && f.stock_qty != null) {
        payload.stock_qty = Number(f.stock_qty);
      }

      // קטגוריה
      if (f.category_id) {
        payload.category_id = Number(f.category_id);
      } else {
        const cfg = getActiveCategoryConfig();
        if (cfg.slug) {
          const cat = findCategoryBySlug(cfg.slug);
          if (cat?.id) payload.category_id = cat.id;
        }
      }

      const token = getToken();
      let productId = f.id;

      if (productModal.isNew) {
        const res = await jsonFetch("/api/products", {
          method: "POST",
          token,
          body: payload,
        });
        productId = res?.id || res?.data?.id;
      } else {
        if (!f.id) throw new Error("חסר מזהה מוצר לעדכון");
        await jsonFetch(`/api/products/${f.id}`, {
          method: "PATCH",
          token,
          body: payload,
        });
        productId = f.id;
      }

      // --- product_images: מחיקה קיימת + יצירה מחדש ---
      if (productId) {
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

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
          (existing || []).map((img) =>
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
      }

      // מחיקת קבצים ישנים מהשרת
      await deleteUploadedFiles(urlsToDelete);

      await loadProducts();
      closeProductModal();
    } catch (e) {
      setProductModal((prev) => ({
        ...prev,
        saving: false,
        error: e.message || "שמירת מוצר נכשלה",
      }));
    }
  }

  // ===== מחיקת מוצר =====
  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    product: null,
    loading: false,
  });

  function askDeleteProduct(p) {
    setConfirmDelete({ open: true, product: p, loading: false });
  }

  async function confirmDeleteNow() {
    if (!confirmDelete.product) return;
    const p = confirmDelete.product;
    try {
      setConfirmDelete((prev) => ({ ...prev, loading: true }));
      const token = getToken();
      await jsonFetch(`/api/products/${p.id}`, {
        method: "DELETE",
        token,
      });
      await loadProducts();
      setConfirmDelete({ open: false, product: null, loading: false });
    } catch (e) {
      console.error(e);
      alert("לא הצלחתי למחוק מוצר");
      setConfirmDelete({ open: false, product: null, loading: false });
    }
  }

  // ===== הנחה מרוכזת =====
  const [bulkDiscountModal, setBulkDiscountModal] = useState({
    open: false,
    saving: false,
    error: "",
    mode: "NONE",
    value: "",
    rows: [],
  });

  function rowsFromProducts(items) {
    if (!Array.isArray(items)) return [];
    return items.map((p) => ({
      id: Number(p.id),
      title: p.title || "",
      price: Number(p.price) || 0,
      selected: false,
    }));
  }

  function openBulkDiscountModal() {
    const rows = rowsFromProducts(products);
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
      saving: false,
      error: "",
      mode: "NONE",
      value: "",
      rows: [],
    });
  }

  function toggleBulkRow(id) {
    setBulkDiscountModal((prev) => ({
      ...prev,
      rows: prev.rows.map((r) =>
        r.id === id ? { ...r, selected: !r.selected } : r
      ),
    }));
  }

  function selectAllBulkRows() {
    setBulkDiscountModal((prev) => {
      const allSelected = prev.rows.every((r) => r.selected);
      return {
        ...prev,
        rows: prev.rows.map((r) => ({
          ...r,
          selected: !allSelected,
        })),
      };
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
      if (!selectedRows.length) throw new Error("לא נבחרו מוצרים");

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

      const token = getToken();
      await Promise.all(
        selectedRows.map((r) =>
          jsonFetch(`/api/products/${r.id}`, {
            method: "PATCH",
            token,
            body: {
              discount_type: mode === "NONE" ? "NONE" : mode,
              discount_value: mode === "NONE" ? null : val,
            },
          })
        )
      );

      await loadProducts();
      closeBulkDiscountModal();
    } catch (e) {
      setBulkDiscountModal((prev) => ({
        ...prev,
        saving: false,
        error: e.message || "שמירת הנחות נכשלה",
      }));
    }
  }

  // ===== קופונים =====
  const [coupons, setCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsErr, setCouponsErr] = useState("");
  const [showInactiveCoupons, setShowInactiveCoupons] = useState(false);

  const [couponModal, setCouponModal] = useState({
    open: false,
    saving: false,
    error: "",
    isNew: true,
    editingId: null,
    form: { ...EMPTY_COUPON },
  });

  async function loadCoupons(includeInactive = showInactiveCoupons) {
    try {
      setCouponsLoading(true);
      setCouponsErr("");
      const token = getToken();

      const qs = new URLSearchParams();
      if (!includeInactive) qs.set("active", "true");
      const query = qs.toString();

      const data = await jsonFetch(
        `/api/coupons/coupons${query ? `?${query}` : ""}`,
        { token }
      );

      const rows = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      setCoupons(rows);
    } catch (e) {
      setCouponsErr(e.message || "שגיאה בטעינת קופונים");
    } finally {
      setCouponsLoading(false);
    }
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  // === טעינות ראשוניות + ריענון לפי סטייט ===
  useEffect(() => {
    loadCategories();
    loadProducts("home-smoothing");
    loadCoupons(showInactiveCoupons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadProducts(activeCategoryKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryKey]);

  useEffect(() => {
    loadCoupons(showInactiveCoupons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactiveCoupons]);

  // === מודאל קופון ===
  function openNewCouponModal() {
    setCouponModal({
      open: true,
      saving: false,
      error: "",
      isNew: true,
      editingId: null,
      form: { ...EMPTY_COUPON, is_active: true },
    });
  }

  function openEditCoupon(c) {
    setCouponModal({
      open: true,
      saving: false,
      error: "",
      isNew: false,
      editingId: c.id,
      form: {
        code: c.code || "",
        type: c.type || "PERCENT",
        value:
          c.type === "FREE_SHIPPING"
            ? ""
            : c.value != null
            ? String(c.value)
            : "",
        min_subtotal:
          c.min_subtotal != null ? String(c.min_subtotal) : "",
        starts_at: toInputDateTime(c.starts_at),
        ends_at: toInputDateTime(c.ends_at),
        max_uses_total:
          c.max_uses_total != null ? String(c.max_uses_total) : "",
        max_uses_per_user:
          c.max_uses_per_user != null
            ? String(c.max_uses_per_user)
            : "",
        is_active: !!c.is_active,
        category_id: c.category_id ? String(c.category_id) : "",
      },
    });
  }

  function closeCouponModal() {
    setCouponModal({
      open: false,
      saving: false,
      error: "",
      isNew: true,
      editingId: null,
      form: { ...EMPTY_COUPON },
    });
  }

  function updateCouponField(name, value) {
    setCouponModal((prev) => ({
      ...prev,
      form: { ...prev.form, [name]: value },
    }));
  }

  async function saveCoupon() {
    try {
      setCouponModal((prev) => ({ ...prev, saving: true, error: "" }));

      const f = couponModal.form;
      if (!f.code.trim()) throw new Error("חסר קוד קופון");

      const body = {
        code: f.code.trim().toUpperCase(),
        type: f.type,
        value: f.type === "FREE_SHIPPING" ? 0 : Number(f.value) || 0,
        min_subtotal: f.min_subtotal ? Number(f.min_subtotal) : null,
        starts_at: f.starts_at || null,
        ends_at: f.ends_at || null,
        max_uses_total: f.max_uses_total
          ? Number(f.max_uses_total)
          : null,
        max_uses_per_user: f.max_uses_per_user
          ? Number(f.max_uses_per_user)
          : null,
        is_active: f.is_active ? 1 : 0,
        category_id: f.category_id ? Number(f.category_id) : null,
      };

      const token = getToken();

      if (couponModal.isNew) {
        await jsonFetch("/api/coupons/coupons", {
          method: "POST",
          token,
          body,
        });
      } else if (couponModal.editingId) {
        await jsonFetch(`/api/coupons/coupons/${couponModal.editingId}`, {
          method: "PATCH",
          token,
          body,
        });
      }

      await loadCoupons();
      closeCouponModal();
    } catch (e) {
      setCouponModal((prev) => ({
        ...prev,
        saving: false,
        error: e.message || "שמירת קופון נכשלה",
      }));
    }
  }

  async function toggleCouponActive(c) {
    try {
      const token = getToken();
      await jsonFetch(`/api/coupons/coupons/${c.id}`, {
        method: "PATCH",
        token,
        body: { is_active: !c.is_active },
      });
      await loadCoupons();
    } catch (e) {
      alert("לא ניתן לעדכן קופון כרגע");
    }
  }

  async function deleteCoupon(c) {
    if (!window.confirm(`למחוק (להשבית) את הקופון "${c.code}"?`)) {
      return;
    }
    try {
      const token = getToken();
      await jsonFetch(`/api/coupons/coupons/${c.id}`, {
        method: "DELETE",
        token,
      });
      await loadCoupons();
    } catch (e) {
      alert("לא ניתן למחוק קופון כרגע");
    }
  }

  // ===== רנדר =====
  const secondaryImages =
    productModal.form.images?.filter((im) => im?.url) || [];

return (
  <div dir="rtl" style={{ color: "#fff" }}>
    {/* כרטיס אפור מסביב למסך הניהול */}
    <section
      className="adm-inner-card"
      style={{
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: 16,
        boxShadow: "0 30px 80px rgba(0,0,0,0.9)",
        fontfamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>ניהול מוצרים</h1>

      <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
        מכאן תנהל/י מוצרים וקופונים:
      </p>

      <ul style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
        <li>עריכה , מחיקה , והוספת מוצרים</li>
        <li>הוספת קופונים והנחות</li>
        <li>בלחיצה על כפתור "מעבר אל האתר" תוכלי לראות: כמה אנשים צפו במוצר וקנו.</li>
      </ul>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <button
          onClick={goToClient}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 999,
            padding: "10px 22px",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
         מעבר אל האתר
        </button>
      </div>

      {/* ===== מוצרים (CRM) ===== */}
      <section className="admin-products-block">
        <h3 style={{ marginTop: 16, marginBottom: 8 }}>מוצרים</h3>

        {/* קטגוריות */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {ADMIN_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategoryKey(cat.key)}
              style={{
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                cursor: "pointer",
                border:
                  activeCategoryKey === cat.key
                    ? "1px solid #6e6a6aff"
                    : "1px solid rgba(148,163,184,0.6)",
                background:
                  activeCategoryKey === cat.key
                    ? "rgba(227, 186, 186, 0.06)"
                    : "transparent",
                color: "#fff",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={openNewProductModal}
            style={{
              background: "rgba(82, 81, 78, 0.18)",
              border: "1px solid rgba(132, 131, 125, 0.45)",
              borderRadius: 999,
              padding: "10px 22px",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>+</span>
            <span>הוספת מוצר חדש</span>
          </button>

          <button
            type="button"
            onClick={openBulkDiscountModal}
            style={{
              background: "rgba(82, 81, 78, 0.18)",
              border: "1px solid rgba(132, 131, 125, 0.45)",
              borderRadius: 999,
              padding: "10px 22px",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>%</span>
            <span>הנחה מרוכזת על מוצרים</span>
          </button>
        </div>

        {productsLoading && <p style={{ fontSize: 14 }}>טוען מוצרים…</p>}
        {productsErr && (
          <p style={{ fontSize: 14, color: "#a7a3a3ff" }}>{productsErr}</p>
        )}

        {!productsLoading && !productsErr && products.length === 0 && (
          <p style={{ fontSize: 14 }}>אין מוצרים לתצוגה בקטגוריה זו.</p>
        )}

        {products.length > 0 && (
          <div className="admin-products-table-wrapper">
            <table className="admin-coupons-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>שם מוצר</th>
                  <th>מחיר רגיל</th>
                  <th>מחיר אחרי הנחה</th>
                  <th>סוג הנחה</th>
                  <th>ערך הנחה</th>
                  <th>מלאי</th>
                  <th>תמונה</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const discountType = p.discount_type || "NONE";
                  const discountValue =
                    p.discount_value == null ? null : p.discount_value;
                  const final =
                    p.final_price != null
                      ? Number(p.final_price)
                      : computeFinalPrice(
                          p.price,
                          discountType,
                          discountValue
                        );

                  return (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.title}</td>
                      <td>₪ {Number(p.price || 0).toFixed(2)}</td>
                      <td>₪ {Number(final || 0).toFixed(2)}</td>
                      <td>
                        {discountType === "PERCENT"
                          ? "אחוזים"
                          : discountType === "FIXED"
                          ? "סכום קבוע"
                          : "ללא הנחה"}
                      </td>
                      <td>
                        {discountType === "PERCENT"
                          ? `${discountValue || 0}%`
                          : discountType === "FIXED"
                          ? `₪ ${discountValue || 0}`
                          : "-"}
                      </td>
                      <td>{p.stock_qty ?? 0}</td>
                      <td>
                        {p.image_url && (
                          <img
                            src={normalizeImageUrl(p.image_url)}
                            alt={p.title}
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: "cover",
                              borderRadius: 6,
                            }}
                          />
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openEditProductModal(p)}
                          style={{
                            marginInlineEnd: 6,
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border:
                              "1px solid rgba(255,255,255,0.4)",
                            background: "transparent",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          עריכה
                        </button>
                        <button
                          type="button"
                          onClick={() => askDeleteProduct(p)}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            borderRadius: 999,
                            border:
                              "1px solid rgba(146, 146, 146, 0.8)",
                            background: "rgba(229, 33, 33, 0.23)",
                            color: "#ffffffff",
                            cursor: "pointer",
                          }}
                        >
                          מחיקה
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== קופונים ===== */}
      <section className="admin-coupons-block">
        <h3 style={{ marginTop: 24, marginBottom: 8 }}>קופונים</h3>

        <button
          type="button"
          onClick={openNewCouponModal}
          style={{
            background: "rgba(82, 81, 78, 0.18)",
            border: "1px solid rgba(132, 131, 125, 0.45)",
            borderRadius: 999,
            padding: "10px 22px",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: "12px",
          }}
        >
          <span role="img" aria-hidden="true">
            +
          </span>
          <span>הוספת קופון חדש</span>
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <input
              type="checkbox"
              checked={showInactiveCoupons}
              onChange={(e) =>
                setShowInactiveCoupons(e.target.checked)
              }
            />
            הצג גם קופונים לא פעילים
          </label>

          {couponsLoading && (
            <span style={{ fontSize: 14 }}>טוען קופונים…</span>
          )}
          {couponsErr && (
            <span style={{ fontSize: 14, color: "#b20e0eff" }}>
              {couponsErr}
            </span>
          )}
        </div>

        {coupons.length === 0 && !couponsLoading && !couponsErr && (
          <p style={{ fontSize: 14 }}>אין קופונים לתצוגה.</p>
        )}

        {coupons.length > 0 && (
          <div className="admin-coupons-table-wrapper">
            <table className="admin-coupons-table">
              <thead>
                <tr>
                  <th>קוד</th>
                  <th>סוג</th>
                  <th>ערך</th>
                  <th>קטגוריה</th>
                  <th>מינימום לעגלה</th>
                  <th>תאריך התחלה</th>
                  <th>תאריך סיום</th>
                  <th>מקס' שימושים כלליים</th>
                  <th>מקס' שימושים למשתמש</th>
                  <th>פעיל?</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr
                    key={c.id}
                    className={
                      c.is_active
                        ? "coupon-row is-active"
                        : "coupon-row is-inactive"
                    }
                  >
                    <td>{c.code}</td>
                    <td>
                      {c.type === "PERCENT"
                        ? "אחוזים"
                        : c.type === "FIXED"
                        ? "סכום קבוע"
                        : "משלוח חינם"}
                    </td>
                    <td>
                      {c.type === "FREE_SHIPPING"
                        ? "-"
                        : c.type === "PERCENT"
                        ? `${c.value}%`
                        : `₪ ${c.value}`}
                    </td>
                    <td>{getCategoryNameById(c.category_id)}</td>
                    <td>
                      {c.min_subtotal != null
                        ? `₪ ${c.min_subtotal}`
                        : "-"}
                    </td>
                    <td>{formatDateTime(c.starts_at)}</td>
                    <td>{formatDateTime(c.ends_at)}</td>
                    <td>
                      {c.max_uses_total != null
                        ? c.max_uses_total
                        : "-"}
                    </td>
                    <td>
                      {c.max_uses_per_user != null
                        ? c.max_uses_per_user
                        : "-"}
                    </td>
                    <td>{c.is_active ? "כן" : "לא"}</td>
                    <td className="coupon-actions">
                      <button
                        type="button"
                        onClick={() => openEditCoupon(c)}
                        className="coupon-btn"
                      >
                        עריכה
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCouponActive(c)}
                        className="coupon-btn coupon-btn-toggle"
                      >
                        {c.is_active ? "השבתה" : "הפעלה"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCoupon(c)}
                        className="coupon-btn coupon-btn-danger"
                      >
                        מחיקה
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>

    {/* ===== מודאל מוצר ===== */}
    {productModal.open && (
      <div className="confirm-backdrop" role="dialog" aria-modal="true">
        <div className="cardError cardEdit">
          <button
            className="dismiss"
            type="button"
            onClick={closeProductModal}
            aria-label="סגירה"
          >
            ×
          </button>

          <div className="header">
            <div className="image" />

            <div className="content" dir="rtl">
              <span className="title">
                {productModal.isNew ? "הוספת מוצר חדש" : "עריכת מוצר"}
              </span>
              <p className="message">
                ערכי את פרטי המוצר – שם, מחיר, מלאי, קטגוריה, תמונות
                והנחה.
              </p>

              <div className="product-edit-grid">
                <div className="product-edit-main">
                  <div className="edit-field">
                    <label>שם מוצר</label>
                    <input
                      type="text"
                      value={productModal.form.title}
                      onChange={(e) =>
                        updateProductField("title", e.target.value)
                      }
                    />
                  </div>

                  <div className="edit-field">
                    <label>תיאור קצר</label>
                    <textarea
                      rows={3}
                      value={productModal.form.description}
                      onChange={(e) =>
                        updateProductField(
                          "description",
                          e.target.value
                        )
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
                        value={productModal.form.price}
                        onChange={(e) =>
                          updateProductField("price", e.target.value)
                        }
                      />
                    </div>
                    <div className="edit-field">
                      <label>מלאי (יחידות)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={productModal.form.stock_qty ?? ""}
                        onChange={(e) =>
                          updateProductField(
                            "stock_qty",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="edit-field">
                    <label>קטגוריה</label>
                    <select
                      value={productModal.form.category_id || ""}
                      onChange={(e) =>
                        updateProductField(
                          "category_id",
                          e.target.value
                        )
                      }
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="product-edit-grid-2">
                    <div className="edit-field">
                      <label>סוג הנחה</label>
                      <select
                        value={productModal.form.discount_type}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProductModal((prev) => ({
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

                    {productModal.form.discount_type !== "NONE" && (
                      <div className="edit-field">
                        <label>
                          {productModal.form.discount_type ===
                          "PERCENT"
                            ? "אחוז הנחה (%)"
                            : "סכום הנחה (₪)"}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={productModal.form.discount_value}
                          onChange={(e) =>
                            updateProductField(
                              "discount_value",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="edit-field">
                    <label>תיאור מפורט / רכיבים</label>
                    <textarea
                      rows={3}
                      value={productModal.form.components_text || ""}
                      onChange={(e) =>
                        updateProductField(
                          "components_text",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="edit-field">
                    <label>הוראות שימוש</label>
                    <textarea
                      rows={3}
                      value={productModal.form.usage_text || ""}
                      onChange={(e) =>
                        updateProductField(
                          "usage_text",
                          e.target.value
                        )
                      }
                    />
                  </div>

                  {productModal.error && (
                    <div className="product-edit-errors">
                      {productModal.error}
                    </div>
                  )}
                </div>

                {/* צד ימין – גלריית תמונות כמו שרצית */}
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
                          {productModal.form.image_url ? (
                            <img
                              src={normalizeImageUrl(
                                productModal.form.image_url
                              )}
                              alt="תמונה ראשית"
                              onClick={() =>
                                setPrimaryImage(
                                  productModal.form.image_url
                                )
                              }
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
                            ✎
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePrimaryFileSelected}
                              style={{ display: "none" }}
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
                            />
                          </div>

                          <div className="product-image-actions">
                            <button
                              type="button"
                              className="product-image-delete"
                              onClick={() =>
                                removeImage(img.url, false)
                              }
                              aria-label="מחיקת תמונה"
                              title="מחיקה"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}

                      {(!productModal.form.images ||
                        productModal.form.images.length < 10) && (
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
                </div>
              </div>

              <div className="actions">
                <button
                  className="history"
                  type="button"
                  onClick={saveProduct}
                  disabled={productModal.saving}
                >
                  {productModal.saving ? "שומרת…" : "שמירת מוצר"}
                </button>
                <button
                  className="track"
                  type="button"
                  onClick={closeProductModal}
                  disabled={productModal.saving}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ===== מודאל הנחה מרוכזת ===== */}
    {bulkDiscountModal.open && (
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
            <div className="image" />

            <div className="content" dir="rtl">
              <span className="title">הנחה מרוכזת על מוצרים</span>
              <p className="message">
                בחרי מוצרים, סוג הנחה וערך – לפי הקטגוריה שבחרת
                למעלה.
              </p>

              <div className="product-edit-grid">
                <div className="product-edit-main">
                  <div className="edit-field">
                    <button
                      type="button"
                      className="history"
                      onClick={selectAllBulkRows}
                    >
                      סימון / ביטול כל המוצרים
                    </button>
                  </div>

                  <div
                    className="bulk-discount-list"
                    style={{
                      maxHeight: 260,
                      overflowY: "auto",
                      borderRadius: 12,
                      border:
                        "1px solid rgba(148, 163, 184, 0.5)",
                      padding: 8,
                      marginTop: 8,
                    }}
                  >
                    {(Array.isArray(bulkDiscountModal.rows)
                      ? bulkDiscountModal.rows
                      : []
                    ).map((row) => (
                      <label
                        key={row.id}
                        className="bulk-discount-row"
                        style={{
                          color: "black",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          fontSize: 13,
                          padding: "4px 2px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!row.selected}
                          onChange={() => toggleBulkRow(row.id)}
                        />
                        <span style={{ flex: 1 }}>
                          {row.title}
                        </span>
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
                        אין מוצרים זמינים להנחה בקטגוריה זו.
                      </p>
                    )}
                  </div>
                </div>

                <div className="product-edit-side">
                  <div className="product-edit-images-box">
                    <div className="product-edit-images-box-title">
                      הגדרת הנחה
                    </div>

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

    {/* ===== מודאל מחיקת מוצר ===== */}
    {confirmDelete.open && (
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

    {/* ===== מודאל קופון ===== */}
    {couponModal.open && (
      <div className="confirm-backdrop" role="dialog" aria-modal="true">
        <div className="cardError cardEdit">
          <button
            className="dismiss"
            type="button"
            onClick={closeCouponModal}
            aria-label="סגירה"
          >
            ×
          </button>

          <div className="header">
            <div className="image" />

            <div className="content" dir="rtl">
              <span className="title">
                {couponModal.isNew ? "הוספת קופון" : "עריכת קופון"}
              </span>
              <p className="message">
                הגדרי קוד קופון, סוג ההנחה, קטגוריה ותנאים נוספים.
              </p>

       <div
  className="product-edit-grid"
  style={{
    display: "flex",
    justifyContent: "center",
  }}
>
  <div
    className="product-edit-main"
    style={{
      width: "100%",
      maxWidth: "250px",   // אפשר לשחק עם זה: 600 / 650 וכו'
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >


                  <div className="edit-field">
                    <label>קוד קופון</label>
                    <input
                      type="text"
                      value={couponModal.form.code}
                      onChange={(e) =>
                        updateCouponField("code", e.target.value)
                      }
                    />
                  </div>

                  <div className="edit-field">
                    <label>סוג קופון</label>
                    <select
                      value={couponModal.form.type}
                      onChange={(e) =>
                        updateCouponField("type", e.target.value)
                      }
                    >
                      <option value="PERCENT">אחוזי הנחה (%)</option>
                      <option value="FIXED">סכום קבוע (₪)</option>
                      <option value="FREE_SHIPPING">
                        משלוח חינם
                      </option>
                    </select>
                  </div>

                  {couponModal.form.type !== "FREE_SHIPPING" && (
                    <div className="edit-field">
                      <label>
                        ערך ההנחה{" "}
                        {couponModal.form.type === "PERCENT"
                          ? "(%)"
                          : "(₪)"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={couponModal.form.value}
                        onChange={(e) =>
                          updateCouponField("value", e.target.value)
                        }
                      />
                    </div>
                  )}

                  <div className="edit-field">
                    <label>הגבלת קופון לקטגוריה (לא חובה)</label>
                    <select
                      value={couponModal.form.category_id || ""}
                      onChange={(e) =>
                        updateCouponField(
                          "category_id",
                          e.target.value
                        )
                      }
                    >
                      <option value="">
                        ללא – חל על כל האתר
                      </option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="edit-field">
                    <label>סכום מינימלי לעגלה (לא חובה)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={couponModal.form.min_subtotal}
                      onChange={(e) =>
                        updateCouponField(
                          "min_subtotal",
                          e.target.value
                        )
                      }
                    />
                  </div>

        <div className="product-edit-grid-2">
  <div className="edit-field">
    <label>תאריך התחלה (לא חובה)</label>
    <input
      type="datetime-local"
      value={couponModal.form.starts_at}
      onChange={(e) =>
        updateCouponField("starts_at", e.target.value)
      }
      style={{
        width: "100%",
        minWidth: "260px",   // אפשר להגדיל/להקטין לפי מה שנוח לך
        maxWidth: "none",
      }}
    />
  </div>

  <div className="edit-field">
    <label>תאריך סיום (לא חובה)</label>
    <input
      type="datetime-local"
      value={couponModal.form.ends_at}
      onChange={(e) =>
        updateCouponField("ends_at", e.target.value)
      }
      style={{
        width: "100%",
        minWidth: "260px",
        maxWidth: "none",
      }}
    />
  </div>
                  </div>

                  <div className="product-edit-grid-2">
                    <div className="edit-field">
                      <label>מקסימום שימושים כלליים</label>
                      <input
                        type="number"
                        min="0"
                        value={couponModal.form.max_uses_total}
                        onChange={(e) =>
                          updateCouponField(
                            "max_uses_total",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div className="edit-field">
                      <label>מקסימום שימושים למשתמש</label>
                      <input
                        type="number"
                        min="0"
                        value={
                          couponModal.form.max_uses_per_user
                        }
                        onChange={(e) =>
                          updateCouponField(
                            "max_uses_per_user",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="edit-field">
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={couponModal.form.is_active}
                        onChange={(e) =>
                          updateCouponField(
                            "is_active",
                            e.target.checked
                          )
                        }
                      />
                      הקופון פעיל
                    </label>
                  </div>

                  {couponModal.error && (
                    <div className="product-edit-errors">
                      {couponModal.error}
                    </div>
                  )}
                </div>
              </div>

              <div className="actions">
                <button
                  className="history"
                  type="button"
                  onClick={saveCoupon}
                  disabled={couponModal.saving}
                >
                  {couponModal.saving ? "שומרת…" : "שמירת קופון"}
                </button>
                <button
                  className="track"
                  type="button"
                  onClick={closeCouponModal}
                  disabled={couponModal.saving}
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
};
