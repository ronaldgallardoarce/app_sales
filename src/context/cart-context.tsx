import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';

import { CartLine } from '@/types/catalog';
import { lineAmount } from '@/utils/order';

/**
 * Which order the cart is holding.
 *
 * Two of them, kept apart, because they are two different orders and a seller can have both open
 * at once: half an order typed up for the client in front of them, and a placed order they were
 * asked to amend. One bucket meant starting an edit had to destroy the draft — the app asked
 * first, which made it a warning about a limitation rather than a feature.
 */
export type CartScope = 'draft' | 'edit';

interface CartContextValue {
  /** The active scope's lines. Everything below reads and writes that same bucket. */
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
  /** Which order the members above are about. Screens declare it with `useCartScope`. */
  scope: CartScope;
  setScope: (scope: CartScope) => void;
  /**
   * Loads a placed order's lines into the edit bucket and switches to it. The draft is not read
   * and not written — whatever the seller had going is still there when the edit ends.
   */
  beginEdit: (lines: CartLine[]) => void;
  /** Drops the amended copy and hands the seller back their draft. */
  endEdit: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** The upsert rule applied to one bucket. Pure, so both buckets get the same behaviour. */
function withUpserted(lines: CartLine[], newLines: CartLine[]): CartLine[] {
  const next = [...lines];
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
}

/** The additive rule applied to one bucket. */
function withAdded(lines: CartLine[], newLines: CartLine[]): CartLine[] {
  const next = [...lines];
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
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [carts, setCarts] = useState<Record<CartScope, CartLine[]>>({ draft: [], edit: [] });
  const [scope, setScope] = useState<CartScope>('draft');

  const lines = carts[scope];

  const upsertLines = useCallback(
    (newLines: CartLine[]) => {
      if (newLines.length === 0) return;
      setCarts((prev) => ({ ...prev, [scope]: withUpserted(prev[scope], newLines) }));
    },
    [scope],
  );

  const addLines = useCallback(
    (newLines: CartLine[]) => {
      if (newLines.length === 0) return;
      setCarts((prev) => ({ ...prev, [scope]: withAdded(prev[scope], newLines) }));
    },
    [scope],
  );

  const removeLine = useCallback(
    (productId: number) => {
      setCarts((prev) => ({
        ...prev,
        [scope]: prev[scope].filter((l) => l.productId !== productId),
      }));
    },
    [scope],
  );

  const clearCart = useCallback(() => setCarts((prev) => ({ ...prev, [scope]: [] })), [scope]);

  const beginEdit = useCallback((editLines: CartLine[]) => {
    // Replaced outright rather than merged: this is a different order, and anything left in the
    // bucket by an edit that was walked away from is not part of it.
    setCarts((prev) => ({ ...prev, edit: editLines }));
    setScope('edit');
  }, []);

  const endEdit = useCallback(() => {
    setCarts((prev) => ({ ...prev, edit: [] }));
    setScope('draft');
  }, []);

  const totalAmount = useMemo(() => lines.reduce((sum, l) => sum + lineAmount(l), 0), [lines]);
  const productCount = lines.length;

  const value = useMemo(
    () => ({
      lines,
      upsertLines,
      addLines,
      removeLine,
      clearCart,
      totalAmount,
      productCount,
      scope,
      setScope,
      beginEdit,
      endEdit,
    }),
    [
      lines,
      upsertLines,
      addLines,
      removeLine,
      clearCart,
      totalAmount,
      productCount,
      scope,
      beginEdit,
      endEdit,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

/**
 * Points the cart at the order this screen is about, for as long as it is the screen in front.
 *
 * On focus and not on mount, because both orders are served by the same two screens and the
 * catalog for a new order can be sitting in the stack underneath the catalog for an edit. Whoever
 * the seller is looking at is the one whose lines they are editing — so leaving an edit by the
 * back arrow, without going through "Descartar cambios", still puts the draft back on screen
 * instead of showing them the placed order's lines under a title that says Catálogo.
 */
export function useCartScope(scope: CartScope) {
  const { setScope } = useCart();
  useFocusEffect(
    useCallback(() => {
      setScope(scope);
    }, [setScope, scope]),
  );
}
