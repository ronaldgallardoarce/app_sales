import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Share } from 'react-native';

import { toRows, type OrderSummaryData } from '@/components/orders/order-summary-document';
import { formatAmount, formatBs } from '@/utils/currency';

/**
 * A filename the person receiving it can read.
 *
 * WhatsApp shows the attachment's filename and nothing else until it is opened, so the random
 * name `printToFileAsync` and `captureRef` hand back would arrive as an unidentifiable file. The
 * order's own title is what the seller and the office both call it on the phone.
 */
function fileNameFor(data: OrderSummaryData, extension: string): string {
  const slug = data.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'Pedido'}.${extension}`;
}

/**
 * Renames a generated temp file in place, and settles for the temp name if it cannot.
 *
 * A rename can fail for reasons that have nothing to do with the share — most often a file of
 * that name left behind by the previous time this order was sent. None of them are worth
 * cancelling the share over: a document with an ugly name still says the right thing.
 */
function withReadableName(uri: string, name: string): string {
  try {
    const file = new File(uri);
    const existing = new File(file.parentDirectory, name);
    if (existing.exists) existing.delete();
    file.rename(name);
    return file.uri;
  } catch {
    return uri;
  }
}

/**
 * The same document as plain text.
 *
 * The one format that survives the trip into a chat readable, searchable and quotable on any
 * phone at either end — which is why it is what the WhatsApp share sends, and why the PDF and the
 * image are attachments beside it rather than replacements for it.
 */
export function asText(data: OrderSummaryData): string {
  const rows = toRows(data);
  const parts = [
    data.title,
    `${data.clientCode} - ${data.clientName}`,
    ...data.meta.map((item) => `${item.label}: ${item.value}`),
    '',
    'PRODUCTOS',
    // The unit stays spelled out here, unlike the tables: a chat message has no column heading
    // above it to say what the number counts.
    ...rows.map((row) => {
      const line = `• ${row.name} — ${row.qty} ${row.unit} × ${formatBs(row.price)} = ${formatBs(row.amount)}`;
      return row.discount > 0 ? `${line} (desc. −${formatBs(row.discount)})` : line;
    }),
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
  if (data.ice > 0) parts.push(`ICE incluido: ${formatBs(data.ice)}`);
  parts.push(`TOTAL: ${formatBs(data.total)}`);

  return parts.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The document as print-ready HTML.
 *
 * Deliberately not styled from the app's theme: a PDF is read on paper or on somebody else's
 * screen, where "dark mode" is not a thing that exists, so it commits to ink on white. The accent
 * is the app's own so the printed table still reads as the same document as the screen.
 */
export function asHtml(data: OrderSummaryData): string {
  const rows = toRows(data);

  const productRows = rows
    .map(
      (row) => `
        <tr>
          <td><strong>${escapeHtml(row.name)}</strong></td>
          <td class="num">${row.qty}</td>
          <td class="num">${formatAmount(row.price)}</td>
          <td class="num">${formatAmount(row.ice)}</td>
          <td class="num discount">${row.discount > 0 ? `−${formatAmount(row.discount)}` : '—'}</td>
          <td class="num"><strong>${formatAmount(row.amount)}</strong></td>
        </tr>`,
    )
    .join('');

  const giftRows = data.bonifications
    .map(
      (item) => `
        <tr>
          <td><strong>${escapeHtml(item.giftProductName)}</strong></td>
          <td class="num gift">${item.qty} ${escapeHtml(item.minUnitLabel)}</td>
        </tr>`,
    )
    .join('');

  const giftTable =
    data.bonifications.length > 0
      ? `
      <h2>Bonificaciones</h2>
      <table class="gift-table">
        <thead><tr><th>Producto</th><th class="num">Cantidad</th></tr></thead>
        <tbody>${giftRows}</tbody>
      </table>`
      : '';

  const totalRow = (label: string, value: string, className = '') =>
    `<tr class="${className}"><td>${escapeHtml(label)}</td><td class="num">${value}</td></tr>`;

  return `
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #11181C; margin: 0; padding: 28px; font-size: 12px; }
      h1 { font-size: 18px; margin: 0 0 2px; }
      h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #6B7280; margin: 22px 0 6px; }
      .client { color: #6B7280; font-size: 12px; margin: 0 0 14px; }
      .meta { display: flex; flex-wrap: wrap; gap: 4px 24px; margin-bottom: 4px; }
      .meta div { font-size: 11px; }
      .meta span { color: #6B7280; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #E3E6EA; border-radius: 6px; overflow: hidden; }
      thead th { background: #1873AF; color: #FFFFFF; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; text-align: left; padding: 6px 8px; }
      .gift-table { border-color: #2C8069; }
      .gift-table thead th { background: #E4F4EF; color: #2C8069; }
      tbody td { padding: 6px 8px; border-top: 1px solid #E3E6EA; vertical-align: top; }
      .num { text-align: right; white-space: nowrap; }
      .discount { color: #1873AF; }
      .gift { color: #2C8069; }
      .totals { margin-top: 8px; border: 1px solid #E3E6EA; }
      .totals td { border-top: none; padding: 4px 8px; }
      .totals .rule td { border-top: 1px solid #E3E6EA; }
      .totals .grand td { font-size: 15px; font-weight: 700; color: #2C8069; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(data.title)}</h1>
    <p class="client">${escapeHtml(`${data.clientCode}-${data.clientName}`)}</p>
    <div class="meta">
      ${data.meta.map((item) => `<div><span>${escapeHtml(item.label)}:</span> <strong>${escapeHtml(item.value)}</strong></div>`).join('')}
    </div>

    <h2>Productos</h2>
    <table>
      <thead>
        <tr><th>Producto</th><th class="num">Cant</th><th class="num">Precio Bs</th><th class="num">ICE Bs</th><th class="num">Desc. Bs</th><th class="num">Importe Bs</th></tr>
      </thead>
      <tbody>${productRows}</tbody>
    </table>

    ${giftTable}

    <h2>Resumen</h2>
    <table class="totals">
      <tbody>
        ${totalRow('Subtotal', formatBs(data.subtotal))}
        ${data.discount > 0 ? totalRow('Descuento', `−${formatBs(data.discount)}`) : ''}
        ${data.ice > 0 ? totalRow('ICE incluido', formatBs(data.ice)) : ''}
        ${totalRow('Total', formatBs(data.total), 'rule grand')}
      </tbody>
    </table>
  </body>
</html>`;
}

/**
 * Opens the system's own print preview on the order.
 *
 * This is the "ver PDF" path, and it deliberately uses the OS viewer rather than one built into
 * the app: it is the same dialog the seller already knows from every other app, it renders the
 * exact bytes that the share would attach, and it offers saving or printing from inside it.
 */
export async function previewPdf(data: OrderSummaryData): Promise<void> {
  await Print.printAsync({ html: asHtml(data) });
}

/** Writes the order to a PDF and hands it to whatever the seller picks in the share sheet. */
export async function sharePdf(data: OrderSummaryData): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: asHtml(data) });
  const named = withReadableName(uri, fileNameFor(data, 'pdf'));
  await Sharing.shareAsync(named, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: data.title,
  });
}

/** Shares an already-captured PNG of the document. The capture itself belongs to the screen. */
export async function shareImage(data: OrderSummaryData, uri: string): Promise<void> {
  const named = withReadableName(uri, fileNameFor(data, 'png'));
  await Sharing.shareAsync(named, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: data.title,
  });
}

/**
 * Sends the text summary to WhatsApp, addressed at the client when we know their number.
 *
 * Falls back to the OS share sheet rather than reporting a failure: a seller on a phone with no
 * WhatsApp installed still wants to send this somewhere, and the sheet is the same list they
 * would have reached for anyway.
 */
export async function shareWhatsApp(data: OrderSummaryData): Promise<void> {
  const text = asText(data);
  // `wa.me` and not the `whatsapp://` scheme: the scheme silently does nothing on a phone
  // without WhatsApp, while the https link fails in a way we can actually catch and fall back on.
  const digits = data.clientPhone?.replace(/\D/g, '') ?? '';
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('whatsapp unavailable');
    await Linking.openURL(url);
  } catch {
    await Share.share({ message: text });
  }
}
