import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { OrderSummaryDocument } from '@/components/orders/order-summary-document';
import { ThemedText } from '@/components/themed-text';
import { useDialog } from '@/components/ui/dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useOrderSummary } from '@/context/order-summary-context';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import { previewPdf, shareImage, sharePdf, shareWhatsApp } from '@/utils/order-summary-share';

/** Which export is running, so the footer can say so and refuse to start a second one. */
type Busy = 'pdf' | 'image' | 'whatsapp' | 'preview-pdf' | 'preview-image' | null;

/** What the PNG about to be taken is for — the same capture serves both. */
type CaptureIntent = 'share' | 'preview';

/**
 * The order as a document the seller can read, check and send.
 *
 * A screen rather than the sheet it used to be. An order of thirty lines in a sheet is a table
 * read through a letterbox: the half-height it leaves is spent scrolling rather than checking,
 * and the one thing this document is for is being checked against a shelf line by line. Given
 * the whole screen, most orders need no scrolling at all.
 *
 * It takes no route params. The document arrives through `OrderSummaryProvider`, because the
 * confirm screen opens this on an order that has not been placed and so has no id to look up.
 */
export default function OrderSummaryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useContentInsets();
  const dialog = useDialog();
  const { data } = useOrderSummary();

  const [busy, setBusy] = useState<Busy>(null);
  /** Set while the off-screen copy the PNG is taken from is mounted; null the rest of the time. */
  const [captureIntent, setCaptureIntent] = useState<CaptureIntent | null>(null);
  /** The PNG being previewed, and null whenever the preview is closed. */
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const shotRef = useRef<View>(null);
  /**
   * How tall the off-screen copy laid out. Kept so the preview can show the PNG at its own
   * proportions instead of guessing — a squashed preview of the picture being sent would defeat
   * the point of showing it at all.
   */
  const captureHeight = useRef(0);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/orders' as Href));

  const fail = (message: string) =>
    dialog.show({
      title: 'No se pudo compartir',
      message,
      icon: 'exclamationmark.circle',
      tone: 'danger',
    });

  /**
   * Takes the PNG off the copy rendered off-screen, not off what is on screen.
   *
   * `captureRef` photographs a view at the size it is laid out at, and the document on screen is
   * laid out inside a scroll view — so capturing that would return the visible window and cut the
   * order off at whatever row the seller happened to have stopped on. The copy is the same
   * component with no scroll container around it, which makes it as tall as the order actually is.
   */
  useEffect(() => {
    if (!captureIntent || !data) return;

    let cancelled = false;
    const intent = captureIntent;

    const run = async () => {
      try {
        // Two frames: one for the copy to be laid out, one for it to be drawn. Reading it back
        // any earlier returns a blank bitmap.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (cancelled || !shotRef.current) return;

        const uri = await captureRef(shotRef, { format: 'png', quality: 1, result: 'tmpfile' });
        if (cancelled) return;

        if (intent === 'preview') setPreviewUri(uri);
        else await shareImage(data, uri);
      } catch {
        if (!cancelled) fail('No se pudo generar la imagen del pedido.');
      } finally {
        if (!cancelled) {
          setCaptureIntent(null);
          setBusy(null);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // `data` and `fail` are stable for as long as this screen is open; re-running on either would
    // restart a capture that is already in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureIntent]);

  /** One guard for every export: they all open something modal, and two at once is a lost tap. */
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>, message: string) => {
    if (busy || !data) return;
    setBusy(kind);
    try {
      await action();
    } catch {
      fail(message);
    } finally {
      setBusy(null);
    }
  };

  /**
   * Starts a capture. It cannot be awaited here: the bitmap does not exist until React has put
   * the off-screen copy on the screen, so the effect above finishes what this begins.
   */
  const startCapture = (intent: CaptureIntent) => {
    if (busy) return;
    setBusy(intent === 'preview' ? 'preview-image' : 'image');
    setCaptureIntent(intent);
  };

  const onCaptureLayout = (event: LayoutChangeEvent) => {
    captureHeight.current = event.nativeEvent.layout.height;
  };

  // Reachable by reload or deep link with nothing handed over. Nothing to show and nothing to
  // rebuild it from, so it steps back out rather than presenting an empty document.
  useEffect(() => {
    if (!data) goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return <View style={[styles.root, { backgroundColor: theme.background }]} />;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <SafeAreaView edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={8}
            onPress={goBack}
            style={[styles.roundButton, { backgroundColor: theme.backgroundElement }]}>
            <Icon name="chevron.left" size={18} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle} numberOfLines={1}>
            Resumen del pedido
          </ThemedText>
          {/* Both "ver" actions sit up here, away from the three filled buttons below, because
              neither of them sends anything. They answer "what is the client about to receive?",
              which is a question you ask before choosing where to send it, not after. The eye
              says view; the colour matches the share button for the same format. */}
          <PreviewPill
            label="PDF"
            color={theme.accent}
            soft={theme.accentSoft}
            loading={busy === 'preview-pdf'}
            disabled={busy !== null}
            onPress={() => run('preview-pdf', () => previewPdf(data), 'No se pudo abrir el PDF.')}
          />
          <PreviewPill
            label="Imagen"
            color={theme.accentAlt}
            soft={theme.accentAltSoft}
            loading={busy === 'preview-image'}
            disabled={busy !== null}
            onPress={() => startCapture('preview')}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <OrderSummaryDocument data={data} />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.backgroundElement,
            borderTopColor: theme.border,
            paddingBottom: Spacing.two + insets.bottom,
          },
        ]}>
        <ShareButton
          icon="doc.pdf"
          label="PDF"
          color={theme.accent}
          onColor={theme.onAccent}
          loading={busy === 'pdf'}
          disabled={busy !== null}
          onPress={() => run('pdf', () => sharePdf(data), 'No se pudo generar el PDF.')}
        />
        <ShareButton
          icon="photo"
          label="Imagen"
          color={theme.accentAlt}
          onColor={theme.onAccentAlt}
          loading={busy === 'image'}
          disabled={busy !== null}
          onPress={() => startCapture('share')}
        />
        <ShareButton
          icon="whatsapp"
          label="WhatsApp"
          color={theme.success}
          onColor={theme.onSuccess}
          loading={busy === 'whatsapp'}
          disabled={busy !== null}
          onPress={() => run('whatsapp', () => shareWhatsApp(data), 'No se pudo abrir WhatsApp.')}
        />
      </View>

      {/* Parked far off the left edge instead of hidden: a view with no opacity or no size is not
          drawn, and view-shot can only read back pixels that were drawn. */}
      {captureIntent ? (
        <View pointerEvents="none" style={styles.offscreen}>
          <View
            ref={shotRef}
            collapsable={false}
            onLayout={onCaptureLayout}
            style={[styles.capture, { backgroundColor: theme.background }]}>
            <OrderSummaryDocument data={data} />
          </View>
        </View>
      ) : null}

      <ImagePreview
        uri={previewUri}
        // The ratio of the copy that was captured, so the preview is the picture and not a
        // stretched approximation of it.
        aspectRatio={captureHeight.current > 0 ? CAPTURE_WIDTH / captureHeight.current : 0.7}
        onClose={() => setPreviewUri(null)}
        onShare={() => {
          if (!previewUri) return;
          setPreviewUri(null);
          // Reuses the PNG already on disk rather than capturing a second one: the seller has
          // just approved these exact pixels, and re-taking them is how the two could differ.
          run('image', () => shareImage(data, previewUri), 'No se pudo compartir la imagen.');
        }}
      />
    </View>
  );
}

/**
 * The generated PNG, full screen, before it goes anywhere.
 *
 * On its own dark backdrop and not the app's background: this is a picture being inspected, and
 * the neutral surround is what lets the seller see where the image actually ends — the document
 * is white-on-white against a light theme, so its edges would otherwise be invisible.
 */
function ImagePreview({
  uri,
  aspectRatio,
  onClose,
  onShare,
}: {
  uri: string | null;
  aspectRatio: number;
  onClose: () => void;
  onShare: () => void;
}) {
  const theme = useTheme();
  const insets = useContentInsets();

  return (
    <Modal visible={uri !== null} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.previewBackdrop}>
        <SafeAreaView edges={['top']}>
          <View style={styles.previewHeader}>
            <Pressable hitSlop={8} onPress={onClose} style={styles.previewClose}>
              <Icon name="xmark" size={18} color="#FFFFFF" />
            </Pressable>
            <ThemedText type="smallBold" style={styles.previewTitle} numberOfLines={1}>
              Imagen del pedido
            </ThemedText>
          </View>
        </SafeAreaView>

        {/* Scrollable because a long order makes a tall, narrow picture: fitting it entirely on
            screen would shrink the figures past the point of being checkable, which is the one
            thing this preview is for. */}
        <ScrollView
          style={styles.previewScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.previewContent}>
          {uri ? (
            <Image source={{ uri }} style={[styles.previewImage, { aspectRatio }]} contentFit="contain" />
          ) : null}
        </ScrollView>

        <View style={[styles.previewFooter, { paddingBottom: Spacing.three + insets.bottom }]}>
          <Pressable
            onPress={onShare}
            style={[styles.previewShare, { backgroundColor: theme.accentAlt }]}>
            <Icon name="share" size={16} color={theme.onAccentAlt} />
            <ThemedText type="smallBold" style={{ color: theme.onAccentAlt }}>
              Compartir imagen
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PreviewPill({
  label,
  color,
  soft,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  color: string;
  soft: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={[styles.previewPill, { backgroundColor: soft, opacity: disabled && !loading ? 0.4 : 1 }]}>
      {loading ? <ActivityIndicator size="small" color={color} /> : <Icon name="eye" size={14} color={color} />}
      <ThemedText type="smallBold" style={[styles.previewPillLabel, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ShareButton({
  icon,
  label,
  color,
  onColor,
  loading,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  color: string;
  onColor: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.shareButton, { backgroundColor: color, opacity: disabled && !loading ? 0.4 : 1 }]}>
      {loading ? <ActivityIndicator size="small" color={onColor} /> : <Icon name={icon} size={16} color={onColor} />}
      <ThemedText type="smallBold" style={[styles.shareLabel, { color: onColor }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** The width the PNG is rendered at — the phone's, so the picture matches the screen it came from. */
const CAPTURE_WIDTH = Dimensions.get('window').width;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    marginRight: Spacing.one,
  },
  previewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: Radius.pill,
  },
  previewPillLabel: {
    fontSize: 11,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.four,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
  shareLabel: {
    fontSize: 12,
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -10000,
  },
  capture: {
    width: CAPTURE_WIDTH,
    padding: Spacing.three,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 14, 0.96)',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  previewClose: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  previewTitle: {
    flex: 1,
    color: '#FFFFFF',
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  previewImage: {
    width: '100%',
    borderRadius: Radius.sm,
  },
  previewFooter: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  previewShare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
});
