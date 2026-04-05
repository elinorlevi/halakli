// src/contexts/CartContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

const CART_KEY = "cart_items_v1";
const CART_ID_KEY = "cart_id";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json || "");
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function saveToLS(items) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items || []));
    // טריגר למונה באייקון
  } catch {}
}

function ensureCartIdSync() {
  try {
    const ex = localStorage.getItem(CART_ID_KEY);
    if (ex) return ex;
    // אם יש לך backend – ננסה ליצור שם, אחרת ניצור לוקאלי
    return null;
  } catch {
    return null;
  }
}

async function ensureCartIdFromServer() {
  try {
    const res = await fetch("/api/carts/get-or-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    if (res.ok && j?.id) {
      localStorage.setItem(CART_ID_KEY, String(j.id));
      return String(j.id);
    }
  } catch {}
  // fallback לוקאלי אם אין שרת
  const local = `cart_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  localStorage.setItem(CART_ID_KEY, local);
  return local;
}

async function fetchServerItems(cartId) {
  // אם cartId הוא מספר (משרת) – ניקח ממנו פריטים
  if (!cartId || !/^\d+$/.test(String(cartId))) return null;
  try {
    const res = await fetch(`/api/carts/${cartId}/items`);
    if (!res.ok) return null;
    const j = await res.json();
    const rows = Array.isArray(j.items) ? j.items : [];
    // מיפוי למבנה הפרונט:
    return rows.map((r) => ({
      id: r.product_id,
      title: r.title,
      price: Number(r.unit_price) || 0,
      qty: Number(r.qty) || 1,
      img: r.image_url || r.img || null,
      shade: r.shade ?? null,
    }));
  } catch {
    return null;
  }
}

async function upsertToServer(cartId, { id: product_id, qty }) {
  if (!/^\d+$/.test(String(cartId))) return; // לוקאלי — דלג
  try {
    await fetch(`/api/carts/${cartId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id, qty }),
    });
  } catch {}
}

async function incrementOnServer(cartId, product_id, delta) {
  if (!/^\d+$/.test(String(cartId))) return;
  try {
    await fetch(`/api/carts/${cartId}/items/increment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id, delta }),
    });
  } catch {}
}

async function deleteFromServer(itemIdOrProductId) {
  // אופציונלי
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // 1) נטען מה־localStorage (שורד רענון)
  const [items, setItems] = useState(() => {
    return safeParse(localStorage.getItem(CART_KEY), []);
  });
  const [cartId, setCartId] = useState(() => ensureCartIdSync());
  const initializedRef = useRef(false);

  // 2) ב־mount: ודא cartId + משוך פריטים מהשרת ומזג עם לוקאליים
  useEffect(() => {
    let ignore = false;
    (async () => {
      const id = cartId || (await ensureCartIdFromServer());
      if (ignore) return;
      setCartId(id);

      const serverItems = await fetchServerItems(id);
      if (ignore) return;

      if (Array.isArray(serverItems) && serverItems.length) {
        const local = safeParse(localStorage.getItem(CART_KEY), []);
        const key = (x) => `${x.id}::${x.shade ?? ""}`;
        const map = new Map(local.map((it) => [key(it), it]));
        for (const si of serverItems) {
          if (map.has(key(si))) {
            const merged = { ...map.get(key(si)) };
            merged.qty =
              (Number(merged.qty) || 1) + (Number(si.qty) || 1);
            map.set(key(si), merged);
          } else {
            map.set(key(si), si);
          }
        }
        const mergedArr = Array.from(map.values());
        setItems(mergedArr);
        saveToLS(mergedArr);
      }
      initializedRef.current = true;
    })();
    return () => {
      ignore = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 3) שמירה ל־localStorage בכל שינוי
  useEffect(() => {
    if (!initializedRef.current) return; // לא מוחקים LS בזמן הידרציה
    saveToLS(items);
  }, [items]);

  // 4) סנכרון בין טאבים
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === CART_KEY) {
        const next = safeParse(e.newValue, []);
        setItems(next);
      }
    };
   
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // ===== פעולות =====
  const add = async (newItem) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (p) =>
          p.id === newItem.id &&
          (p.shade ?? null) === (newItem.shade ?? null)
      );
      if (idx === -1) {
        return [
          ...prev,
          { ...newItem, qty: Number(newItem.qty) || 1 },
        ];
      }
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        qty:
          (Number(copy[idx].qty) || 1) +
          (Number(newItem.qty) || 1),
      };
      return copy;
    });
    await upsertToServer(cartId, { id: newItem.id, qty: newItem.qty });
  };

  const setQty = async (id, shade, nextQty) => {
    setItems((prev) => {
      if (nextQty <= 0) {
        return prev.filter(
          (p) =>
            !(
              p.id === id &&
              (p.shade ?? null) === (shade ?? null)
            )
        );
      }
      return prev.map((p) =>
        p.id === id && (p.shade ?? null) === (shade ?? null)
          ? { ...p, qty: Number(nextQty) || 1 }
          : p
      );
    });
    // שרת: חישוב דלתא
    const curr = items.find(
      (p) =>
        p.id === id && (p.shade ?? null) === (shade ?? null)
    );
    const currQty = Number(curr?.qty) || 0;
    const delta = Number(nextQty) - currQty;
    if (delta !== 0) await incrementOnServer(cartId, id, delta);
  };

  const remove = async (id, shade) => {
    setItems((prev) =>
      prev.filter(
        (p) =>
          !(
            p.id === id &&
            (p.shade ?? null) === (shade ?? null)
          )
      )
    );
    // שרת: נעשה increment שלילי עד 0 / או DELETE אם יש
    const curr = items.find(
      (p) =>
        p.id === id && (p.shade ?? null) === (shade ?? null)
    );
    if (curr?.qty)
      await incrementOnServer(cartId, id, -Number(curr.qty));
  };

  // ✅ הפלוס/מינוס האטומי – כאן, בתוך ה־Provider
  const incQty = useCallback(
    (id, shade, delta = 1) => {
      const d = Number(delta) || 0;
      if (d === 0) return;

      setItems((prev) => {
        // אם פריט לא קיים – לא עושים כלום (אפשר גם ליצור אותו כאן אם תרצי)
        return prev
          .map((p) => {
            if (
              p.id === id &&
              (p.shade ?? null) === (shade ?? null)
            ) {
              const next = Math.max(
                0,
                (Number(p.qty) || 0) + d
              );
              return next === 0 ? null : { ...p, qty: next };
            }
            return p;
          })
          .filter(Boolean);
      });

      // עדכון שרת אופציונלי
      incrementOnServer(cartId, id, d).catch(() => {});
    },
    [cartId]
  );

  const clear = useCallback(async () => {
    // 1. לרוקן סטייט מידית (ככה ה־UI בכל האתר מתעדכן)
    setItems([]);

    // 2. לנקות אחסון מקומי כדי שלא יחזור אחרי רענון
    try {
      localStorage.removeItem(CART_KEY);            // מוצרים
      localStorage.removeItem("cart_subtotal");     // סכום אחרון
      localStorage.removeItem("cart_is_free_shipping");
      localStorage.setItem(
        "cart_snapshot",
        JSON.stringify({
          updated_at: new Date().toISOString(),
          count: 0,
          subtotal: 0,
        })
      );
    } catch {}

    // 3. ליידע את השרת (אם יש cartId אמיתי מה-DB)
    try {
      if (/^\d+$/.test(String(cartId))) {
        await fetch(`/api/carts/${cartId}/items/clear`, {
          method: "PATCH",
        });
      }
    } catch {
      // אם השרת לא ענה זה לא סוף העולם
    }
  }, [cartId]);


  const count = useMemo(
    () => items.reduce((n, it) => n + (Number(it.qty) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, it) =>
          s +
          (Number(it.price) || 0) * (Number(it.qty) || 1),
        0
      ),
    [items]
  );

  const value = useMemo(
    () => ({ items, add, setQty, incQty, remove, clear, count, subtotal, cartId }),
    [items, add, setQty, incQty, remove, clear, count, subtotal, cartId]
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
