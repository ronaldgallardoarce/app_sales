import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import type { LineBonification } from '@/data/mock-bonifications';
import { mapClients } from '@/data/mock-clients';
import { deliveryDateLabel } from '@/data/mock-order-details';
import { orderNumberLabel, type PlacedOrder } from '@/data/mock-orders';
import { useTheme } from '@/hooks/use-theme';
import type { CartLine } from '@/types/catalog';
import { formatAmount, formatBs } from '@/utils/currency';

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
  /** Used to address the WhatsApp share straight at the client. Absent means "let them pick". */
  clientPhone?: string;
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
    // Looked up rather than stored on the order: a phone number is the client's current one, not
    // the one they had the day they ordered, and the share is being sent today.
    clientPhone: mapClients.find((client) => client.id === order.clientId)?.phone,
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
export type SummaryRow = {
  key: string;
  name: string;
  /** The line's minimum unit. Cases are counted in it, so it describes the whole quantity. */
  unit: string;
  /** Always in minimum units — a case counts as everything inside it. */
  qty: number;
  /** Per minimum unit, the rate `qty` is counted in. */
  price: number;
  ice: number;
  discount: number;
  amount: number;
};

/**
 * The share of the order's discount that falls on one amount.
 *
 * The discount arrives as a single figure for the whole order because that is how the pricing
 * service quotes it — a percentage off the subtotal. Splitting it back out proportionally is the
 * only division that makes the column add up to the figure in the totals, which is the property
 * the seller checks when the client asks why a line costs what it costs.
 */
function discountRateOf(data: OrderSummaryData): number {
  return data.subtotal > 0 ? data.discount / data.subtotal : 0;
}

/**
 * One row per ordered product, with the quantity counted in minimum units.
 *
 * A line of two cases and six loose pieces used to print as two rows, so that each could carry
 * the unit price it was sold at. Cases now resolve into what they contain — 2 × 12 + 6 = 30 —
 * which is the count the client checks against what comes off the truck, and it leaves one row
 * per product instead of two rows wearing the same name.
 *
 * That leaves one rate for the whole line, not two: the case price is `priceUnidad × unitsPerCase`
 * (`mock-catalog.ts`), a quantity applied to the same unit price rather than a second tariff. Both
 * factors have at most two decimals, so `qty × price` lands back on the importe exactly — the
 * multiplication the client checks with a calculator holds.
 */
export function toRows(data: OrderSummaryData): SummaryRow[] {
  const rate = discountRateOf(data);

  return data.lines
    .map((line) => {
      const qty = line.qtyMax * line.unitsPerCase + line.qtyMin;
      const amount = line.qtyMax * line.unitPriceMax + line.qtyMin * line.unitPriceMin;
      return {
        key: String(line.productId),
        name: line.productName,
        unit: line.minUnitLabel,
        qty,
        price: line.unitPriceMin,
        // ICE is charged per minimum unit, which is exactly what `qty` now counts.
        ice: qty * line.ice,
        discount: amount * rate,
        amount,
      };
    })
    .filter((row) => row.qty > 0);
}

/**
 * The order as a document: who it is for, what is on it, what is free, and what it comes to.
 *
 * Rendered by the summary screen and, unchanged, into the PNG the seller sends — one component so
 * the picture that reaches the client cannot say something different from the screen it was taken
 * from. That is also why it takes no scroll container and no safe area of its own: it is a sheet
 * of paper, and whoever shows it decides how much of it fits.
 */
export function OrderSummaryDocument({ data }: { data: OrderSummaryData }) {
  const theme = useTheme();
  const rows = toRows(data);

  return (
    <View style={styles.document}>
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
      {/* Solid accent rather than the old grey fill: on a document that is mostly small figures,
          the header is the one band that has to be findable at a glance while the seller runs a
          finger down a column, and a tint a shade off the page does not survive that. */}
      <View style={[styles.table, { borderColor: theme.border }]}>
        <View style={[styles.headRow, { backgroundColor: theme.accent }]}>
          <ThemedText style={[styles.headCell, styles.colName, { color: theme.onAccent }]}>Producto</ThemedText>
          <ThemedText style={[styles.headCell, styles.colQty, { color: theme.onAccent }]}>Cant</ThemedText>
          {/* The currency rides in the heading, once per column, instead of on every figure
              underneath it: four columns of numbers are read by comparing them down the page,
              and a repeated "Bs." on each one is four characters of noise per row.
              It sits on a second line so the heading never decides the column width — with five
              numeric columns on a phone, every pixel a heading takes is one the product name
              loses, and the name is the only cell here that gets read rather than scanned. */}
          <ThemedText style={[styles.headCell, styles.colPrice, { color: theme.onAccent }]}>{'Precio\nBs'}</ThemedText>
          <ThemedText style={[styles.headCell, styles.colIce, { color: theme.onAccent }]}>{'ICE\nBs'}</ThemedText>
          <ThemedText style={[styles.headCell, styles.colDiscount, { color: theme.onAccent }]}>{'Desc.\nBs'}</ThemedText>
          <ThemedText style={[styles.headCell, styles.colAmount, { color: theme.onAccent }]}>{'Importe\nBs'}</ThemedText>
        </View>

        {rows.map((row, index) => (
          <View
            key={row.key}
            style={[
              styles.bodyRow,
              index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
            ]}>
            {/* Nothing but the name: `productName` is already "<producto> <sabor> <tamaño>", so
                the sub-line that used to sit here repeated the line above it word for word. */}
            <ThemedText type="smallBold" numberOfLines={2} style={[styles.cellName, styles.colName]}>
              {row.name}
            </ThemedText>
            {/* A bare count, with no unit beside it: every quantity on this table is in the
                product's minimum unit, so the label was the same word on every row of a line. */}
            <ThemedText type="smallBold" style={[styles.cellQty, styles.colQty]}>
              {row.qty}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={[styles.cell, styles.colPrice]}>
              {formatAmount(row.price)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={[styles.cell, styles.colIce]}>
              {formatAmount(row.ice)}
            </ThemedText>
            <ThemedText
              style={[styles.cell, styles.colDiscount, { color: row.discount > 0 ? theme.accent : theme.textSecondary }]}>
              {row.discount > 0 ? `−${formatAmount(row.discount)}` : '—'}
            </ThemedText>
            <ThemedText type="smallBold" style={[styles.cell, styles.colAmount]}>
              {formatAmount(row.amount)}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Its own table, never mixed into the one above: free goods have no price and no importe,
          and a row of blanks in a priced table reads as a line somebody forgot to fill in. */}
      {data.bonifications.length > 0 ? (
        <>
          <Label>Bonificaciones</Label>
          {/* Soft fill and green ink, unlike the priced table above. The vivid band is what marks
              the table the seller reads figures out of; giving the same weight to the free goods
              would have two headers competing for the eye on a document with one of them. */}
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
        {/* "Subtotal" here and "Importe" in the table are deliberately different words for
            different things: importe is one row's quantity times its rate, subtotal is every
            importe added up. Reusing one name for both would make the totals look like a line. */}
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
    </View>
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
  document: {
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
    // Bottom, not centre: the one-line "Cant" has to sit on the same line as the "Bs" of its
    // neighbours, or it floats in the middle of the band on its own.
    alignItems: 'flex-end',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
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
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  colName: {
    flex: 1,
  },
  // Sized to the widest figure each column can hold, not to its heading — the two-line headings
  // exist so that stays true. What is left over goes to the product name.
  colQty: {
    width: 32,
    textAlign: 'right',
  },
  colPrice: {
    width: 46,
    textAlign: 'right',
  },
  colIce: {
    width: 36,
    textAlign: 'right',
  },
  colDiscount: {
    width: 42,
    textAlign: 'right',
  },
  colAmount: {
    width: 52,
    textAlign: 'right',
  },
  colGiftQty: {
    width: 90,
    textAlign: 'right',
  },
  cell: {
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  cellName: {
    fontSize: 11,
    lineHeight: 15,
  },
  cellQty: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
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
});
