// src/components/admin/AdminShopView.jsx
import React, { useEffect, useState } from "react";
import AllProducts from "../AllProducts";
import Kits from "../Kits";
import ProductHair from "../ProductHair";
import Smoothies from "../Smoothies";

const API_BASE =
  import.meta?.env?.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "";

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export default function AdminShopView() {
  // איזה דף "לקוח" מוצג כרגע
  const [activeView, setActiveView] = useState("all"); // all | kits | hair | smooth
  const [activeTab, setActiveTab] = useState("products"); // products | coupons | stats

  // טפסי מוצר
  const [categories, setCategories] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    id: null,
    title: "",
    price: "",
    category_id: "",
    image_url: "",
    description: "",
  });

  useEffect(() => {
    loadCategories();
  }, []);

  // כשאני בוחרת מוצר ברשימה של ה"לקוח"
  function handleSelectProduct(p) {
    setSelectedProduct(p);
    setForm({
      id: p.id,
      title: p.title || "",
      price: p.price || "",
      // אם הדף לא מחזיר category_id – אפשר לבחור
      category_id: p.category_id || "",
      image_url: p.image_url || "",
      description: p.description || "",
    });
    setActiveTab("products");
  }

  async function loadCategories() {
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setCategories(data.data || data || []);
    } catch (err) {
      console.error("failed to load categories", err);
    }
  }

  function startNewProduct() {
    setSelectedProduct(null);
    setForm({
      id: null,
      title: "",
      price: "",
      category_id: "",
      image_url: "",
      description: "",
    });
  }

  async function saveProduct(e) {
    e?.preventDefault?.();
    const payload = {
      title: form.title,
      price: Number(form.price) || 0,
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      description: form.description || null,
    };

    try {
      let res;
      if (form.id) {
        res = await fetch(`${API_BASE}/api/products/${form.id}`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/api/products`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error("save failed");
      alert("נשמר ✅");
      // לא ריעננתי כאן את "דף הלקוח" כי הוא טוען לבד לפי URL
    } catch (err) {
      console.error("save failed", err);
      alert("לא הצלחתי לשמור מוצר");
    }
  }

  async function deleteProduct() {
    if (!form.id) return;
    if (!window.confirm("למחוק מוצר זה?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/products/${form.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("delete failed");
      alert("נמחק");
      startNewProduct();
    } catch (err) {
      console.error("delete failed", err);
      alert("לא הצלחתי למחוק");
    }
  }

  // טאבים הראשיים למעלה
  const topTabs = (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
      }}
    >
      <button
        onClick={() => setActiveView("all")}
        className={activeView === "all" ? "adm-btn" : "adm-btn ghost"}
      >
        כל המוצרים (כמו לקוח)
      </button>
      <button
        onClick={() => setActiveView("kits")}
        className={activeView === "kits" ? "adm-btn" : "adm-btn ghost"}
      >
        ערכות ביתיות
      </button>
      <button
        onClick={() => setActiveView("hair")}
        className={activeView === "hair" ? "adm-btn" : "adm-btn ghost"}
      >
        מוצרי שיער
      </button>
      <button
        onClick={() => setActiveView("smooth")}
        className={activeView === "smooth" ? "adm-btn" : "adm-btn ghost"}
      >
        החלקות ביתיות
      </button>
    </div>
  );

  return (
    <div
      dir="rtl"
      style={{
        display: "grid",
        gridTemplateColumns: "1.1fr 0.55fr",
        gap: 16,
        minHeight: "100vh",
      }}
    >
      {/* צד שמאל – מה שהלקוח רואה */}
      <div
        style={{
          background: "rgba(0,0,0,0.15)",
          borderRadius: 12,
          padding: 12,
          minHeight: "100vh",
        }}
      >
        {topTabs}

        {activeView === "all" && (
          <AllProducts adminMode onSelectProduct={handleSelectProduct} />
        )}
        {activeView === "kits" && (
          <Kits adminMode onSelectProduct={handleSelectProduct} />
        )}
        {activeView === "hair" && (
          <ProductHair adminMode onSelectProduct={handleSelectProduct} />
        )}
        {activeView === "smooth" && (
          <Smoothies adminMode onSelectProduct={handleSelectProduct} />
        )}
      </div>

      {/* צד ימין – פאנל אדמין */}
      <div
        style={{
          background: "rgba(0,0,0,0.35)",
          borderRadius: 12,
          padding: 12,
          minHeight: 500,
        }}
      >
        {/* טאבים של האדמין */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button
            onClick={() => setActiveTab("products")}
            className={activeTab === "products" ? "adm-btn" : "adm-btn ghost"}
          >
            מוצר
          </button>
          <button
            onClick={() => setActiveTab("coupons")}
            className={activeTab === "coupons" ? "adm-btn" : "adm-btn ghost"}
          >
            קופונים והנחות
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={activeTab === "stats" ? "adm-btn" : "adm-btn ghost"}
          >
            צפיות / כניסות
          </button>
        </div>

        {/* תוכן האדמין */}
        {activeTab === "products" && (
          <form onSubmit={saveProduct}>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>
              {form.id ? "עריכת מוצר" : "הוספת מוצר"}
            </h2>

            <label style={{ fontSize: 12 }}>
              שם מוצר
              <input
                style={{ width: "100%", marginTop: 3, marginBottom: 8 }}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>

            <label style={{ fontSize: 12 }}>
              מחיר (₪)
              <input
                type="number"
                style={{ width: "100%", marginTop: 3, marginBottom: 8 }}
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </label>

            <label style={{ fontSize: 12 }}>
              קטגוריה
              <select
                style={{ width: "100%", marginTop: 3, marginBottom: 8 }}
                value={form.category_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category_id: e.target.value }))
                }
              >
                <option value="">— בחרי —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 12 }}>
              תמונה (URL)
              <input
                style={{ width: "100%", marginTop: 3, marginBottom: 8 }}
                value={form.image_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, image_url: e.target.value }))
                }
              />
            </label>

            <label style={{ fontSize: 12 }}>
              תיאור
              <textarea
                style={{
                  width: "100%",
                  minHeight: 60,
                  marginTop: 3,
                  marginBottom: 8,
                }}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </label>

            <div style={{ display: "flex", gap: 6 }}>
              <button type="submit" className="adm-btn" style={{ flex: 1 }}>
                {form.id ? "עדכון מוצר" : "הוספת מוצר"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={deleteProduct}
                  className="adm-btn ghost"
                >
                  מחיקה
                </button>
              )}
              <button
                type="button"
                onClick={startNewProduct}
                className="adm-btn ghost"
              >
                חדש
              </button>
            </div>

            {selectedProduct && (
              <p style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>
                עורך את: {selectedProduct.title} (id: {selectedProduct.id})
              </p>
            )}
          </form>
        )}

        {activeTab === "coupons" && (
          <div>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>קופונים והנחות</h2>
            <p style={{ fontSize: 12 }}>
              כאן תוכלי לשים את הטופס שהיה לך ב-AdminProducts לקופונים.
            </p>
            {/* פה פשוט תעתיקי מהקומפוננטה הקודמת שלך */}
          </div>
        )}

        {activeTab === "stats" && (
          <div>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>סטטיסטיקות</h2>
            <p style={{ fontSize: 12 }}>
              פה תתחברי ל-API /api/analytics ... ותציגי כמה נכנסו לכל מוצר.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
