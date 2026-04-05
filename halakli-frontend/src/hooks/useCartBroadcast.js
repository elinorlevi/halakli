// hooks/useCartBroadcast.js
import { useEffect, useRef } from "react";
import { cartBus } from "../contexts/cartBus";

export function useCartBroadcast(items, subtotal) {
  const raf = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      // משדרים "items" + "subtotal" בפעם אחת / ברצף, אבל אחרי שה-UI התייצב
      cartBus.publish("items", items);
      cartBus.publish("subtotal", Number((Number(subtotal) || 0).toFixed(2)));
    });
    return () => cancelAnimationFrame(raf.current);
  }, [items, subtotal]);
}

export function useCartSubscribe(type, handler) {
  useEffect(() => {
    const off = cartBus.subscribe(type, handler);
    return off;
  }, [type, handler]);
}