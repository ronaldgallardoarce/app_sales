import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { CartLine } from '@/types/catalog';

interface CartContextValue {
  lines: CartLine[];
  addLines: (newLines: CartLine[]) => void;
  removeLine: (id: string) => void;
  setLineQty: (id: string, qty: number) => void;
  clearCart: () => void;
  totalAmount: number;
  productCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addLines = useCallback((newLines: CartLine[]) => {
    if (newLines.length === 0) return;
    setLines((prev) => {
      const next = [...prev];
      for (const line of newLines) {
        const existingIndex = next.findIndex((l) => l.id === line.id);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], qty: next[existingIndex].qty + line.qty };
        } else {
          next.push(line);
        }
      }
      return next;
    });
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const setLineQty = useCallback((id: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.id !== id);
      return prev.map((l) => (l.id === id ? { ...l, qty } : l));
    });
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const totalAmount = useMemo(() => lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0), [lines]);
  const productCount = useMemo(() => new Set(lines.map((l) => l.productId)).size, [lines]);

  const value = useMemo(
    () => ({ lines, addLines, removeLine, setLineQty, clearCart, totalAmount, productCount }),
    [lines, addLines, removeLine, setLineQty, clearCart, totalAmount, productCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
