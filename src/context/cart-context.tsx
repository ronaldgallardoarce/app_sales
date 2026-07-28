import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { CartLine } from '@/types/catalog';
import { lineAmount } from '@/utils/order';

interface CartContextValue {
  lines: CartLine[];
  /**
   * Absolute set by product code: the incoming quantities replace whatever the line
   * held, and a line at zero on both units leaves the cart. This is what lets the
   * product sheet work on a draft and commit it without first pulling lines out.
   */
  upsertLines: (newLines: CartLine[]) => void;
  /** Additive set by product code — only "Duplicar pedido" wants quantities to stack. */
  addLines: (newLines: CartLine[]) => void;
  removeLine: (productId: number) => void;
  clearCart: () => void;
  totalAmount: number;
  productCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const upsertLines = useCallback((newLines: CartLine[]) => {
    if (newLines.length === 0) return;
    setLines((prev) => {
      const next = [...prev];
      for (const line of newLines) {
        const existingIndex = next.findIndex((l) => l.productId === line.productId);
        const isEmpty = line.qtyMax === 0 && line.qtyMin === 0;
        if (existingIndex >= 0) {
          if (isEmpty) next.splice(existingIndex, 1);
          else next[existingIndex] = line;
        } else if (!isEmpty) {
          next.push(line);
        }
      }
      return next;
    });
  }, []);

  const addLines = useCallback((newLines: CartLine[]) => {
    if (newLines.length === 0) return;
    setLines((prev) => {
      const next = [...prev];
      for (const line of newLines) {
        const existingIndex = next.findIndex((l) => l.productId === line.productId);
        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          next[existingIndex] = {
            ...existing,
            qtyMax: existing.qtyMax + line.qtyMax,
            qtyMin: existing.qtyMin + line.qtyMin,
          };
        } else {
          next.push(line);
        }
      }
      return next;
    });
  }, []);

  const removeLine = useCallback((productId: number) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const totalAmount = useMemo(() => lines.reduce((sum, l) => sum + lineAmount(l), 0), [lines]);
  const productCount = lines.length;

  const value = useMemo(
    () => ({ lines, upsertLines, addLines, removeLine, clearCart, totalAmount, productCount }),
    [lines, upsertLines, addLines, removeLine, clearCart, totalAmount, productCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
