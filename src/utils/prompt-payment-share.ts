import { Linking, Share } from 'react-native';

import { PROMPT_PAYMENT_TTL_MS } from '@/data/mock-prompt-payment';
import { formatBs } from '@/utils/currency';

/** The window stated in whole minutes, which is how it gets said out loud. */
const WINDOW_MINUTES = Math.round(PROMPT_PAYMENT_TTL_MS / 60_000);

/**
 * The message the client receives. Short on purpose — it is read on a phone, in a chat, by someone
 * about to pay — and it names the three things they need: what for, how much, and that it will not
 * wait indefinitely. The deadline is in the message because the reservation is real: a client who
 * opens the link an hour later has to find out why the QR no longer works.
 */
function messageFor(chatUrl: string, amountBs: number): string {
  return [
    `Para completar tu pedido de ${formatBs(amountBs)}, abrí este link y escaneá el QR:`,
    chatUrl,
    '',
    `Tenés ${WINDOW_MINUTES} minutos: el stock queda reservado durante ese tiempo.`,
  ].join('\n');
}

/**
 * Opens WhatsApp on its contact list with the payment link ready to send.
 *
 * Deliberately not addressed at the client's stored number. A shop's registered phone is very often
 * not the phone of whoever is standing at the counter paying — a son, an employee, a second line —
 * and a link sent to the wrong number is a payment that never arrives. So this hands WhatsApp the
 * message and lets the seller pick who receives it, which is also the choice they are already making
 * out loud with the client in front of them.
 *
 * `wa.me` with no number is what opens that chooser; the `whatsapp://` scheme would silently do
 * nothing on a phone without WhatsApp, while the https link fails in a way that can be caught and
 * fall through to the OS share sheet.
 */
export async function sharePaymentLink(chatUrl: string, amountBs: number): Promise<void> {
  const text = messageFor(chatUrl, amountBs);
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('whatsapp unavailable');
    await Linking.openURL(url);
  } catch {
    await Share.share({ message: text });
  }
}
