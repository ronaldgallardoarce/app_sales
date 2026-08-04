import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CenterModal } from '@/components/ui/center-modal';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { countdownLabel, usePromptPayment } from '@/context/prompt-payment-context';
import { useTheme } from '@/hooks/use-theme';
import { formatBs } from '@/utils/currency';
import { sharePaymentLink } from '@/utils/prompt-payment-share';

/**
 * Collecting a prompt payment: the QR, the clock, and whatever the payment turned out to be.
 *
 * Centred rather than a bottom sheet, and that is not decoration. Against the bottom edge the clock
 * and the code end up in the least visible part of the screen — often behind the hand holding the
 * phone — and this is content the seller and the client both read while it counts down.
 *
 * There is no way out of it except its own buttons. A reservation is running, a payment may be seconds
 * from landing, and a stray tap on the backdrop is not a decision anybody made. Giving up is a button
 * that says so, and it releases the stock on the way.
 *
 * It owns none of the payment's state and decides nothing about it. It starts the payment when it
 * opens, shows what the provider says, and hands the one ending that needs a decision back to the
 * screen: nothing was collected, so the order has to fall back to contado.
 *
 * A payment that lands needs no decision at all — the order is registered the moment the money is
 * confirmed, and this becomes the receipt for that.
 */
export function PromptPaymentModal({
  visible,
  amountBs,
  orderLabel,
  invoiceReady,
  sharingInvoice,
  onShareInvoice,
  onDone,
  onGiveUp,
}: {
  visible: boolean;
  /** What is being collected. Fixed for the life of the reservation — it is what was reserved. */
  amountBs: number;
  /** The order number, once the confirmed payment has registered it. Null before that. */
  orderLabel: string | null;
  /** Whether the factura exists yet. It arrives a moment after the money does. */
  invoiceReady: boolean;
  sharingInvoice: boolean;
  /** Send the factura as a PDF. */
  onShareInvoice: () => void;
  /** Done with a collected, registered order — leaves the screen. */
  onDone: () => void;
  /** Nothing was collected — expired, refused or given up on — and the seller acknowledged it. */
  onGiveUp: () => void;
}) {
  const theme = useTheme();
  const { session, remainingMs, start, cancel, reconcile, reset } = usePromptPayment();
  const [sharing, setSharing] = useState(false);

  const intent = 'intent' in session ? session.intent : null;
  const collectedAmount = intent?.amountBs ?? amountBs;
  /** A request is genuinely in flight — not merely "we are in the verifying state". */
  const checking = session.state === 'verifying' && !session.failed;


  /**
   * Opening the modal is what opens the payment, and only ever from `idle`. Any other state means a
   * payment already exists — the seller closed this and came back — and starting a second one would
   * reserve the same stock twice and leave the first reservation held with nobody watching it.
   */
  useEffect(() => {
    if (!visible || session.state !== 'idle') return;
    void start(amountBs);
  }, [visible, session.state, amountBs, start]);

  const handleShareLink = async () => {
    if (sharing || !intent) return;
    setSharing(true);
    try {
      await sharePaymentLink(intent.chatUrl, intent.amountBs);
    } finally {
      setSharing(false);
    }
  };

  /**
   * Gives the stock back. Deliberately does not report up: cancelling lands on the `cancelled` state
   * below, which says the stock was released, and the same button every other ending uses is what
   * carries the decision out of here. Reporting from here as well would skip past the one screen
   * confirming that nothing was charged.
   */
  const handleCancel = async () => {
    await cancel();
  };

  return (
    <CenterModal
      visible={visible}
      // Nothing here is dismissable by tapping away from it. A reservation is running, a payment may
      // be seconds from landing, and a stray tap on the backdrop is not a decision anyone made — so
      // the buttons below are the only way out, in every state.
      dismissible={false}
      onClose={noop}
      footer={
        <View style={styles.footerActions}>
          {session.state === 'awaiting' || session.state === 'verifying' ? (
            <>
              {/* Opens WhatsApp on its contact list rather than at the client's registered number:
                  whoever is paying is very often not the phone on the client record, and the seller
                  is the one who knows which it is. */}
              <Pressable
                disabled={sharing || checking}
                onPress={() => void handleShareLink()}
                style={[
                  styles.primaryButton,
                  { backgroundColor: theme.success, opacity: sharing || checking ? 0.5 : 1 },
                ]}>
                {sharing ? (
                  <ActivityIndicator size="small" color={theme.onSuccess} />
                ) : (
                  <Icon name="whatsapp" size={16} color={theme.onSuccess} />
                )}
                <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.onSuccess }}>
                  Enviar link por WhatsApp
                </ThemedText>
              </Pressable>

              {/* The manual way to ask. The confirmation normally arrives on its own, but a seller
                  whose client says "ya pagué" needs to be able to check rather than wait.

                  Disabled only while a check is actually in flight: one that came back with nothing
                  has to stay pressable, because it is the only way out of that state and it is
                  exactly the state a seller in a shop with bad signal ends up in. */}
              <Pressable
                disabled={checking}
                onPress={() => void reconcile()}
                style={[
                  styles.outlineButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                    opacity: checking ? 0.5 : 1,
                  },
                ]}>
                <Icon name="sync" size={15} color={theme.accent} />
                <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.accent }}>
                  {session.state === 'verifying' && session.failed
                    ? 'Volver a verificar'
                    : 'Ya pagó · Verificar'}
                </ThemedText>
              </Pressable>

              {/* Quiet, and last. It is the one control here that throws away a reservation, and it
                  must never be the thing a thumb lands on while reaching for the one above. */}
              <Pressable onPress={() => void handleCancel()} hitSlop={6} style={styles.cancelRow}>
                <Icon name="xmark.circle.fill" size={13} color={theme.danger} />
                <ThemedText type="smallBold" style={[styles.cancelLabel, { color: theme.danger }]}>
                  Cancelar cobro y liberar el stock
                </ThemedText>
              </Pressable>
            </>
          ) : null}

          {/* Nothing to confirm here any more — the order is already registered. The factura is the
              only thing left to do with it, and leaving is the way out. */}
          {/* Side by side and both filled. They are the two things left to do with a closed sale —
              send the paper, or move on — and neither is a lesser version of the other, which is what
              a quiet outlined "Listo" under a solid button was saying. Both carry a glyph and their
              own colour, so the one being reached for is recognisable without reading. */}
          {session.state === 'paid' ? (
            <View style={styles.buttonRow}>
              {invoiceReady ? (
                <Pressable
                  disabled={sharingInvoice}
                  onPress={onShareInvoice}
                  style={[
                    styles.rowButton,
                    { backgroundColor: theme.accent, opacity: sharingInvoice ? 0.5 : 1 },
                  ]}>
                  {sharingInvoice ? (
                    <ActivityIndicator size="small" color={theme.onAccent} />
                  ) : (
                    <Icon name="doc.pdf" size={16} color={theme.onAccent} />
                  )}
                  <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.onAccent }}>
                    Factura PDF
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={onDone}
                style={[styles.rowButton, { backgroundColor: theme.success }]}>
                <Icon name="checkmark" size={16} color={theme.onSuccess} />
                <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.onSuccess }}>
                  Listo
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {session.state === 'failed' ? (
            <Pressable
              onPress={() => {
                // Straight back to `idle`, which is what the opening effect above waits for: a
                // refused payment is usually retried on the spot with another method.
                reset();
              }}
              style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
              <Icon name="sync" size={16} color={theme.onAccent} />
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Reintentar cobro
              </ThemedText>
            </Pressable>
          ) : null}

          {session.state === 'expired' ||
          session.state === 'failed' ||
          session.state === 'cancelled' ? (
            <Pressable
              onPress={onGiveUp}
              style={[
                session.state === 'failed' ? styles.outlineButton : styles.primaryButton,
                session.state === 'failed'
                  ? { borderColor: theme.border, backgroundColor: theme.background }
                  : { backgroundColor: theme.accent },
              ]}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={{ color: session.state === 'failed' ? theme.text : theme.onAccent }}>
                Volver a elegir método de pago
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      }>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ThemedText type="smallBold" style={styles.title}>
          Cobro por pronto pago
        </ThemedText>

        {/* While collecting: the clock, then the code, then the figure — top to bottom in the order
            they get used. The clock is the thing being watched, so it leads and takes the colour. The
            QR is what the client acts on. The amount sits under it because it is what the seller reads
            back once the client is already looking at the code, and it does not change while any of
            this happens.

            Nothing under the QR. The caption that used to sit there restated what the button below
            already says and printed a payload reference nobody reads. */}
        {session.state === 'awaiting' ? (
          <>
            <Countdown remainingMs={remainingMs} />
            {intent ? <QrPreview payload={intent.qrPayload} /> : null}
            <AmountRow amount={collectedAmount} />
            <Note
              tone={theme.accentAlt}
              soft={theme.accentAltSoft}
              icon="exclamationmark.circle"
              text="Si el pago no entra a tiempo, el pedido vuelve a contado."
            />
          </>
        ) : (
          /* Every other state has no clock and no code, so the figure leads: it is what was reserved,
             what was charged, or what was not — the one fact all of them are about. */
          <AmountRow amount={collectedAmount} />
        )}

        {session.state === 'starting' ? <Waiting label="Generando el QR y reservando el stock…" /> : null}

        {session.state === 'idle' ? <Waiting label="Preparando el cobro…" /> : null}

        {/* A check that came back with nothing is not a payment that failed. Nothing is known, so
            the modal says that and leaves a way to ask again — the reservation is still running. */}
        {session.state === 'verifying' ? (
          session.failed ? (
            <Note
              tone={theme.danger}
              soft={theme.dangerSoft}
              icon="wifi.slash"
              text="No pudimos verificar el pago. La reserva sigue en pie: volvé a intentar cuando tengas señal."
            />
          ) : (
            <Waiting label="Verificando el pago…" />
          )
        ) : null}

        {session.state === 'paid' ? (
          <>
            <Status
              icon="checkmark.circle.fill"
              tone={theme.success}
              soft={theme.successSoft}
              title="Pago confirmado"
              body={`Se recibió ${formatBs(collectedAmount)}. El descuento por pronto pago queda firme.`}
            />

            {/* Said, not implied: the order is registered without the seller pressing anything, and
                the number is what they read out if the client asks. */}
            {orderLabel ? (
              <Note
                tone={theme.success}
                soft={theme.successSoft}
                icon="cart"
                text={`Pedido ${orderLabel} registrado.`}
              />
            ) : null}

            {invoiceReady ? (
              <Note
                tone={theme.success}
                soft={theme.successSoft}
                icon="doc.text"
                text="La factura ya está lista para enviar."
              />
            ) : (
              <Note
                tone={theme.accentAlt}
                soft={theme.accentAltSoft}
                icon="clock.fill"
                text="Factura en camino. En unos segundos vas a poder enviarla."
              />
            )}
          </>
        ) : null}

        {session.state === 'expired' ? (
          <Status
            icon="clock.fill"
            tone={theme.accentAlt}
            soft={theme.accentAltSoft}
            title="Se agotó el tiempo"
            body="La reserva se liberó y no se cobró nada. El pedido vuelve a contado, así que hay que aplicar descuentos y bonificaciones otra vez antes de confirmarlo."
          />
        ) : null}

        {session.state === 'failed' ? (
          <Status
            icon="exclamationmark.circle"
            tone={theme.danger}
            soft={theme.dangerSoft}
            title="El pago no se completó"
            body={session.reason}
          />
        ) : null}

        {session.state === 'cancelled' ? (
          <Status
            icon="xmark.circle.fill"
            tone={theme.textSecondary}
            soft={theme.background}
            title="Cobro cancelado"
            body="El stock volvió a estar disponible y no se cobró nada. El pedido vuelve a contado."
          />
        ) : null}
      </ScrollView>
    </CenterModal>
  );
}

/**
 * How worried the clock should look. Blue for the first seven minutes, amber for the next two, red for
 * the last one.
 *
 * The digits alone read the same at 8:14 as at 0:38, and those are not the same situation: one is
 * routine, the other is the seller deciding whether to chase the client down the street.
 *
 * Blue and not green for the calm state, which is a correction. Green means *done* everywhere else in
 * this app — the confirmed payment, the placed order, every total — and a running clock is the one
 * thing that is emphatically not done yet. The accent blue is what the rest of the app already uses
 * for something in progress, so a countdown wearing it says "on its way" rather than "settled", and
 * green goes back to meaning only one thing.
 */
function urgencyOf(remainingMs: number, theme: ReturnType<typeof useTheme>) {
  if (remainingMs > 3 * 60_000) return { tone: theme.accent, onTone: theme.onAccent };
  if (remainingMs > 60_000) return { tone: theme.accentAlt, onTone: theme.onAccentAlt };
  return { tone: theme.danger, onTone: theme.onDanger };
}

/**
 * Stands in for the QR the client is handed after opening the link.
 *
 * A pattern derived from the payload rather than a real code: rendering a scannable one needs a
 * generator this project does not carry. What it is here for is recognition — so the seller can see
 * at a glance that a payment is open and which one — and the reference underneath is what makes it
 * checkable against what the client is looking at.
 */
function QrPreview({ payload }: { payload: string }) {
  const theme = useTheme();

  // Deterministic from the payload, so the same payment always draws the same pattern.
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const cells = Array.from({ length: QR_GRID * QR_GRID }, (_, index) => {
    const bit = Math.imul(hash ^ index, 2654435761) >>> 0;
    return (bit >>> 12) % 3 !== 0;
  });

  return (
    <View style={styles.qrBlock}>
      <View style={[styles.qrTile, { backgroundColor: '#FFFFFF', borderColor: theme.border }]}>
        {cells.map((filled, index) => (
          <View key={index} style={[styles.qrCell, { backgroundColor: filled ? '#11181C' : '#FFFFFF' }]} />
        ))}
      </View>
    </View>
  );
}

/**
 * How long is left: one solid pill, and the only thing in this modal meant to be read across a
 * counter.
 *
 * Solid fill rather than a tinted panel, and a pill rather than a card. The colour is what does the
 * work here — filled, it is a live indicator the eye finds without being sent looking, where coloured
 * digits on a soft background read as one more block of content.
 *
 * Losing the progress bar cost nothing once that was true. The bar and the digits were saying the same
 * thing twice, and the bar was the half that needed the room.
 */
function Countdown({ remainingMs }: { remainingMs: number }) {
  const theme = useTheme();
  const urgency = urgencyOf(remainingMs, theme);

  return (
    <View style={styles.countdownBlock}>
      <View style={[styles.countdownPill, { backgroundColor: urgency.tone }]}>
        <Icon name="clock.fill" size={15} color={urgency.onTone} />
        <ThemedText style={[styles.countdownValue, { color: urgency.onTone }]}>
          {countdownLabel(remainingMs)}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={styles.countdownCaption}>
        Tiempo para pagar
      </ThemedText>
    </View>
  );
}

/**
 * What the client owes. Quiet next to the clock above it, and deliberately so: the figure does not
 * change while the modal is open, so it is a thing to read once and confirm — not the thing being
 * watched.
 */
function AmountRow({ amount }: { amount: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.amountRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText themeColor="textSecondary" style={styles.amountCaption}>
        A cobrar
      </ThemedText>
      <ThemedText style={styles.amountValue}>{formatBs(amount)}</ThemedText>
    </View>
  );
}

function Waiting({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.waiting}>
      <ActivityIndicator size="small" color={theme.accent} />
      <ThemedText themeColor="textSecondary" style={styles.waitingLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function Status({
  icon,
  tone,
  soft,
  title,
  body,
}: {
  icon: IconName;
  tone: string;
  soft: string;
  title: string;
  body: string;
}) {
  return (
    <View style={[styles.status, { backgroundColor: soft }]}>
      <Icon name={icon} size={22} color={tone} />
      <ThemedText type="smallBold" style={[styles.statusTitle, { color: tone }]}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.statusBody}>
        {body}
      </ThemedText>
    </View>
  );
}

function Note({
  icon,
  tone,
  soft,
  text,
}: {
  icon: IconName;
  tone: string;
  soft: string;
  text: string;
}) {
  return (
    <View style={[styles.note, { backgroundColor: soft }]}>
      <Icon name={icon} size={14} color={tone} />
      <ThemedText style={[styles.noteText, { color: tone }]}>{text}</ThemedText>
    </View>
  );
}

/** Required by `CenterModal`, and never called: this modal is not dismissable. */
function noop() {}

/** Cells per side of the stand-in QR. Odd, so it has a centre the way a real one does. */
const QR_GRID = 17;
/**
 * Smaller than it was in the bottom sheet. A centred card is bounded above *and* below, so every point
 * the code takes is one the clock above it and the buttons under it have to give up — and on a short
 * phone that is the difference between the whole thing fitting and the seller scrolling a payment.
 */
const QR_TILE_SIZE = 150;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.three,
    // Its own top padding now: a centred card has no drag handle above the content to stand in for it.
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    lineHeight: 19,
    textAlign: 'center',
  },
  countdownBlock: {
    alignItems: 'center',
    gap: 3,
  },
  /** Hugs its contents rather than stretching: a pill the width of the card is a banner. */
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  /** The one figure in this modal meant to be read from arm's length. */
  countdownValue: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countdownCaption: {
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  amountCaption: {
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountValue: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qrBlock: {
    alignItems: 'center',
    gap: 6,
  },
  /** A fixed square laid out as rows of cells — `flexWrap` over a known width is the whole grid. */
  qrTile: {
    width: QR_TILE_SIZE,
    height: QR_TILE_SIZE,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  qrCell: {
    width: QR_TILE_SIZE / QR_GRID,
    height: QR_TILE_SIZE / QR_GRID,
  },
  waiting: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.four,
  },
  waitingLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  status: {
    alignItems: 'center',
    gap: 4,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  statusTitle: {
    fontSize: 15,
    lineHeight: 19,
    textAlign: 'center',
  },
  statusBody: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: Spacing.two,
    borderRadius: Radius.sm,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  footerActions: {
    gap: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  /** Equal halves, so neither of the two closing actions reads as the secondary one. */
  rowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  cancelLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
});
