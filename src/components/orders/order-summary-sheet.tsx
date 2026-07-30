import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import type { LineBonification } from '@/data/mock-bonifications';
import { deliveryDateLabel } from '@/data/mock-order-details';
import { orderNumberLabel, type PlacedOrder } from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';
import type { CartLine } from '@/types/catalog';
import { formatBs } from '@/utils/currency';

/**
 * Everything the summary shows, gathered by whoever opens it.
 *
 * The same shape from both callers because both already hold it: a placed order stores these
 * fields, and the confirm screen computes them to store. Passing the pieces rather than either a
 * `PlacedOrder` or a cart keeps this from having to know which of the two it is looking at — and
 * it is the reason the seller sees the identical document before and after confirming.
 */
export type OrderSummaryData = {
  /** "Pedido N° 1042", or "Resumen del pedido" for one not yet placed. */
  title: string;
  clientCode: string;
  clientName: string;
  /** Delivery, payment, whatever context the caller has. Rendered as label/value pairs. */
  meta: { label: string; value: string }[];
  lines: CartLine[];
  bonifications: LineBonification[];
  subtotal: number;
  discount: number;
  ice: number;
  total: number;
};

/**
 * The summary of an order that already exists. Kept next to the type it builds so a placed order
 * and one still being confirmed cannot drift into showing different fields.
 */
export function summaryFromOrder(order: PlacedOrder): OrderSummaryData {
  return {
    title: `Pedido ${orderNumberLabel(order.id)}`,
    clientCode: order.clientCode,
    clientName: order.clientName,
    meta: [
      { label: 'Entrega', value: deliveryDateLabel(order.deliveryDate) },
      { label: 'Horario', value: `${order.deliveryFrom} a ${order.deliveryTo}` },
      { label: 'Pago', value: order.paymentMethod },
      { label: 'Tipo', value: order.remote ? 'Remoto' : 'Presencial' },
    ],
    lines: order.lines,
    bonifications: order.bonifications,
    subtotal: order.subtotal,
    discount: order.discount,
    ice: order.ice,
    total: order.total,
  };
}

/** One priced line of the printed order. */
type SummaryRow = {
  key: string;
  name: string;
  detail: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
};

/**
 * Splits each ordered line into one row per unit it was ordered in.
 *
 * A line of two cases and six loose pieces is two prices and two quantities, and squeezing it into
 * one row forces a choice of which unit price to print — either one is wrong for half the line.
 * Split, every row carries a quantity, its own rate and what the two multiply to, which is what
 * makes the arithmetic checkable by the person being shown it.
 */
function toRows(lines: CartLine[]): SummaryRow[] {
  const rows: SummaryRow[] = [];

  lines.forEach((line) => {
    const detail = [line.flavor, line.sizeLabel].filter(Boolean).join(' · ');

    if (line.qtyMax > 0) {
      rows.push({
        key: `${line.productId}-max`,
        name: line.productName,
        detail,
        unit: line.maxUnitLabel,
        qty: line.qtyMax,
        price: line.unitPriceMax,
        amount: line.qtyMax * line.unitPriceMax,
      });
    }

    if (line.qtyMin > 0) {
      rows.push({
        key: `${line.productId}-min`,
        name: line.productName,
        detail,
        unit: line.minUnitLabel,
        qty: line.qtyMin,
        price: line.unitPriceMin,
        amount: line.qtyMin * line.unitPriceMin,
      });
    }
  });

  return rows;
}

/**
 * The same document as plain text, for the share sheet.
 *
 * Text and not an image or a PDF because of where it goes: this is pasted into WhatsApp to a
 * client or to the office, and text is the one format that survives that trip readable, searchable
 * and quotable on any phone at either end.
 */
function asText(data: OrderSummaryData): string {
  const rows = toRows(data.lines);
  const parts = [
    data.title,
    `${data.clientCode} - ${data.clientName}`,
    ...data.meta.map((item) => `${item.label}: ${item.value}`),
    '',
    'PRODUCTOS',
    ...rows.map(
      (row) => `• ${row.name} — ${row.qty} ${row.unit} × ${formatBs(row.price)} = ${formatBs(row.amount)}`,
    ),
  ];

  if (data.bonifications.length > 0) {
    parts.push(
      '',
      'BONIFICACIONES',
      ...data.bonifications.map((item) => `• ${item.giftProductName} — ${item.qty} ${item.minUnitLabel}`),
    );
  }

  parts.push('', `Subtotal: ${formatBs(data.subtotal)}`);
  if (data.discount > 0) parts.push(`Descuento: −${formatBs(data.discount)}`);
  if (data.ice > 0) parts.push(`ICE: ${formatBs(data.ice)}`);
  parts.push(`TOTAL: ${formatBs(data.total)}`);

  return parts.join('\n');
}

/**
 * The order as a document: who it is for, what is on it, what is free, and what it comes to.
 *
 * Reachable from both sides of confirming, and deliberately the same on both — before, it is what
 * the seller reads back to the client to agree on; after, it is what gets sent to them. A summary
 * that changed shape once the order was placed would make those two different conversations.
 *
 * Small type throughout: this is a table meant to be scanned and checked against a shelf, not
 * read. What it buys is the whole order on one screen instead of a scroll.
 */
export function OrderSummarySheet({
  data,
  visible,
  onClose,
}: {
  data: OrderSummaryData | null;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();

  if (!data) return null;

  const rows = toRows(data.lines);

  const share = () => {
    // Fire and forget: the OS sheet owns the outcome from here, and a seller who backs out of it
    // has not failed at anything worth telling them about.
    Share.share({ message: asText(data) }).catch(() => {});
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      footer={
        <Pressable onPress={share} style={[styles.shareButton, { backgroundColor: theme.accent }]}>
          <Icon name="doc.on.doc" size={16} color={theme.onAccent} />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Compartir detalle
          </ThemedText>
        </Pressable>
      }>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheet}>
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="doc.text" size={22} color={theme.accent} />
          </View>
          <View style={styles.headerText}>
            <ThemedText type="smallBold" style={styles.title} numberOfLines={1}>
              {data.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {data.clientCode}-{data.clientName}
            </ThemedText>
          </View>
        </View>

        {data.meta.length > 0 ? (
          <View style={styles.metaGrid}>
            {data.meta.map((item) => (
              <View key={item.label} style={styles.metaItem}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.metaLabel}>
                  {item.label}:
                </ThemedText>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.metaValue}>
                  {item.value}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        <Label>Productos</Label>
        <View style={[styles.table, { borderColor: theme.border }]}>
          <View style={[styles.headRow, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText style={[styles.headCell, styles.colName]}>Producto</ThemedText>
            <ThemedText style={[styles.headCell, styles.colQty]}>Cant</ThemedText>
            <ThemedText style={[styles.headCell, styles.colPrice]}>P. unit</ThemedText>
            <ThemedText style={[styles.headCell, styles.colAmount]}>Importe</ThemedText>
          </View>

          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.bodyRow,
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
              ]}>
              <View style={styles.colName}>
                <ThemedText type="smallBold" numberOfLines={2} style={styles.cellName}>
                  {row.name}
                </ThemedText>
                <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.cellDetail}>
                  {[row.detail, row.unit].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={[styles.cell, styles.colQty]}>
                {row.qty}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={[styles.cell, styles.colPrice]}>
                {formatBs(row.price)}
              </ThemedText>
              <ThemedText type="smallBold" style={[styles.cell, styles.colAmount]}>
                {formatBs(row.amount)}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Its own table, never mixed into the one above: free goods have no price and no importe,
            and a row of blanks in a priced table reads as a line somebody forgot to fill in. */}
        {data.bonifications.length > 0 ? (
          <>
            <Label>Bonificaciones</Label>
            <View style={[styles.table, { borderColor: theme.success }]}>
              <View style={[styles.headRow, { backgroundColor: theme.successSoft }]}>
                <ThemedText style={[styles.headCell, styles.colName, { color: theme.success }]}>
                  Producto
                </ThemedText>
                <ThemedText style={[styles.headCell, styles.colGiftQty, { color: theme.success }]}>
                  Cantidad
                </ThemedText>
              </View>

              {data.bonifications.map((item, index) => (
                <View
                  key={`${item.productId}-${item.giftProductId}`}
                  style={[
                    styles.bodyRow,
                    index > 0
                      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }
                      : null,
                  ]}>
                  <ThemedText type="smallBold" numberOfLines={2} style={[styles.cellName, styles.colName]}>
                    {item.giftProductName}
                  </ThemedText>
                  <ThemedText type="smallBold" style={[styles.cell, styles.colGiftQty, { color: theme.success }]}>
                    {item.qty} {item.minUnitLabel}
                  </ThemedText>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Label>Resumen</Label>
        <View style={[styles.totals, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <TotalRow label="Subtotal" value={formatBs(data.subtotal)} />
          {data.discount > 0 ? (
            <TotalRow label="Descuento" value={`−${formatBs(data.discount)}`} tone={theme.accent} />
          ) : null}
          {/* Informational, exactly as the confirm screen shows it: ICE is already inside the
              prices above, so it is listed and never added to the total. */}
          {data.ice > 0 ? <TotalRow label="ICE incluido" value={formatBs(data.ice)} /> : null}
          <View style={[styles.hr, { backgroundColor: theme.border }]} />
          <TotalRow label="Total" value={formatBs(data.total)} tone={theme.success} strong />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function Label({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
      {children}
    </ThemedText>
  );
}

function TotalRow({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.totalRow}>
      <ThemedText
        type={strong ? 'smallBold' : 'small'}
        themeColor={strong ? undefined : 'textSecondary'}
        style={styles.totalLabel}>
        {label}
      </ThemedText>
      <ThemedText
        type="smallBold"
        style={[strong ? styles.totalStrong : styles.totalValue, tone ? { color: tone } : null]}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 15,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 2,
    paddingTop: Spacing.one,
  },
  metaItem: {
    flexBasis: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: Spacing.two,
  },
  metaLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  metaValue: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  label: {
    fontSize: 12,
    marginTop: Spacing.two,
    marginBottom: -Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  table: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  headCell: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  colName: {
    flex: 1,
  },
  colQty: {
    width: 30,
    textAlign: 'right',
  },
  colPrice: {
    width: 62,
    textAlign: 'right',
  },
  colAmount: {
    width: 68,
    textAlign: 'right',
  },
  colGiftQty: {
    width: 90,
    textAlign: 'right',
  },
  cell: {
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  cellName: {
    fontSize: 11,
    lineHeight: 15,
  },
  cellDetail: {
    fontSize: 9,
    lineHeight: 12,
  },
  totals: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    gap: 2,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  totalLabel: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  totalValue: {
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
  },
  totalStrong: {
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  hr: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
});
