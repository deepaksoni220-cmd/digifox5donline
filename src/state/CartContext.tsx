import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  id: string; // product id (simple for this template)
  name: string;
  price: number; // numeric total for checkout
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  clear: () => void;
  setQty: (id: string, qty: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "aero_cart_v1";

function parsePriceToNumber(priceText: string): number {
  // handles values like "₹1700" or "$180" or "180"
  const normalized = priceText.replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function cartPrice(priceText: string) {
  return parsePriceToNumber(priceText);
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CartItem[];
      if (!Array.isArray(parsed)) return;
      setItems(
        parsed
          .filter((x) => x && typeof x.id === "string" && typeof x.price === "number")
          .map((x) => ({ ...x, qty: Math.max(1, Number(x.qty ?? 1)) })),
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [items]);

  const addItem: CartContextValue["addItem"] = (incoming) => {
    const qty = Math.max(1, Math.floor(incoming.qty ?? 1));
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === incoming.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { id: incoming.id, name: incoming.name, price: incoming.price, qty }];
    });
  };

  const setQty: CartContextValue["setQty"] = (id, qty) => {
    const safeQty = Math.max(0, Math.floor(qty));
    setItems((prev) => {
      if (safeQty === 0) return prev.filter((x) => x.id !== id);
      return prev.map((x) => (x.id === id ? { ...x, qty: safeQty } : x));
    });
  };

  const clear = () => setItems([]);

  const count = useMemo(() => items.reduce((s, x) => s + x.qty, 0), [items]);
  const total = useMemo(() => items.reduce((s, x) => s + x.qty * x.price, 0), [items]);

  const value = useMemo<CartContextValue>(
    () => ({ items, count, total, addItem, clear, setQty }),
    [items, count, total],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
