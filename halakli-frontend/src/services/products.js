// halakli-frontend/src/services/products.js

let BASE = "http://localhost:4000";
try {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    BASE = import.meta.env.VITE_API_BASE;
  }
} catch {}
if (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) {
  BASE = process.env.REACT_APP_API_BASE;
}

async function jsonFetch(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function computeFinalPrice(p) {
  let f = Number(p.price);
  const t = p.discount_type, v = Number(p.discount_value);
  if (t === "PERCENT" && v) f = f * (1 - v / 100);
  else if (t === "FIXED" && v) f = f - v;
  if (!isFinite(f)) f = Number(p.price) || 0;
  if (f < 0) f = 0;
  return Number(f.toFixed(2));
}
function normalizeProduct(p) {
  const price = Number(p.price);
  const final_price = p.final_price != null ? Number(p.final_price) : computeFinalPrice(p);
  return { ...p, price, final_price };
}

// IDs של קטגוריות מה-ENV או ברירת מחדל
export const CATEGORY_IDS = {
  SMOOTHIES: Number(
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_CAT_SMOOTHIES) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_CAT_SMOOTHIES) ||
    2
  ),
  HAIR: Number(
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_CAT_HAIR) ||
    (typeof process !== "undefined" && process.env?.REACT_APP_CAT_HAIR) ||
    3
  ),
};

export const productsApi = {
  async list({ q, discounted } = {}) {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (discounted != null) qs.set("discounted", String(discounted));
    const url = `/api/products${qs.toString() ? `?${qs}` : ""}`;
    const data = await jsonFetch(url);
    return data.map(normalizeProduct);
  },
  async get(id) {
    const data = await jsonFetch(`/api/products/${id}`);
    return normalizeProduct(data);
  },
  async byCategory({ categoryId }) {
    const res = await jsonFetch(`/api/categories/${categoryId}/products`);
    const brief = Array.isArray(res?.products) ? res.products : [];
    const full = await Promise.all(
      brief.map(async (b) => {
        try { return await this.get(b.id); }
        catch { return normalizeProduct(b); }
      })
    );
    return full;
  },
  async images(productId) {
    return jsonFetch(`/api/products/${productId}/images`);
  },
};
