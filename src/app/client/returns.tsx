import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReturnLineCard } from '@/components/returns/return-line-card';
import { ReturnLineSheet } from '@/components/returns/return-line-sheet';
import { ThemedText } from '@/components/themed-text';
import { DateInputField } from '@/components/ui/date-input-field';
import { useDialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { OfflineBadge } from '@/components/ui/offline-badge';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useClientVisits } from '@/context/client-visit-context';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';
import type { ReturnLine } from '@/types/returns';
import { draftBlockers } from '@/utils/returns';

/**
 * A return: what the client is sending back, from which lot, with the evidence and the reason.
 *
 * Reached from inside a visit, the same as the order flow, and it carries the client with it
 * rather than asking again — a return is always about the shelf the seller is standing in front
 * of. The client card is pinned above the scroll for the same reason it is on the confirm
 * screen: "am I filing this against the right client?" has to stay answerable at any depth in
 * the form.
 *
 * The three sections are ordered by what blocks what. The replacement date is one tap and
 * commits the seller to a return trip, the products are the work, and the justification is
 * written last because it is a summary of everything above it.
 */
export default function ReturnsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useContentInsets();
  const dialog = useDialog();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients } = useClientVisits();
  const client = clients.find((c) => c.id === id) ?? null;

  const [replacementDate, setReplacementDate] = useState('');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<ReturnLine[]>([]);
  /**
   * The line the sheet is editing. `null` with the sheet open means a new one, which is what
   * sends the sheet to its product picker — so the two states cannot be collapsed into one.
   */
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const editingLine = editingKey === null ? null : lines.find((line) => line.key === editingKey) ?? null;

  const blockers = draftBlockers({ replacementDate, justification, lines });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/clients' as Href));

  const openNewLine = () => {
    setEditingKey(null);
    setSheetVisible(true);
  };

  const saveLine = (line: ReturnLine) => {
    setLines((current) =>
      current.some((existing) => existing.key === line.key)
        ? current.map((existing) => (existing.key === line.key ? line : existing))
        : [...current, line],
    );
    setSheetVisible(false);
  };

  const removeLine = (line: ReturnLine) =>
    dialog.show({
      icon: 'trash',
      tone: 'danger',
      title: 'Quitar producto',
      message: `${line.productName} sale de la devolución, junto con sus fotos.`,
      actions: [
        { label: 'Cancelar', variant: 'outline' },
        {
          label: 'Quitar',
          variant: 'primary',
          tone: 'danger',
          onPress: () => setLines((current) => current.filter((existing) => existing.key !== line.key)),
        },
      ],
    });

  const submit = () =>
    dialog.show({
      icon: 'checkmark.circle.fill',
      tone: 'success',
      title: 'Devolución registrada',
      message: `${lines.length === 1 ? '1 producto' : `${lines.length} productos`} para reponer el ${replacementDate}.`,
      actions: [{ label: 'Listo', variant: 'primary', onPress: goBack }],
    });

  if (!client) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.background }]}>
        <ThemedText themeColor="textSecondary">Cliente no encontrado.</ThemedText>
      </View>
    );
  }

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
            Devolución
          </ThemedText>
          <OfflineBadge />
        </View>
      </SafeAreaView>

      <View style={styles.pinned}>
        <View style={[styles.clientCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.clientIcon, { backgroundColor: theme.accentSoft }]}>
            <Icon name="store" size={16} color={theme.accent} />
          </View>
          <View style={styles.clientTexts}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.clientName}>
              {client.code}-{client.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.clientMeta}>
              {client.address}
            </ThemedText>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        {/* The label asks the whole question, so the field under it needs no caption of its
            own — a card wrapping one control was three lines of chrome around one tap. */}
        <SectionLabel>Fecha probable de reposición</SectionLabel>
        <DateInputField
          value={replacementDate}
          onChange={setReplacementDate}
          title="Fecha probable de reposición"
        />

        <View style={styles.sectionHeader}>
          <SectionLabel>Productos</SectionLabel>
          {lines.length > 0 ? (
            <View style={[styles.count, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="smallBold" style={[styles.countText, { color: theme.accent }]}>
                {lines.length}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {lines.map((line) => (
          <ReturnLineCard
            key={line.key}
            line={line}
            onPress={() => {
              setEditingKey(line.key);
              setSheetVisible(true);
            }}
            onRemove={() => removeLine(line)}
          />
        ))}

        <Pressable
          onPress={openNewLine}
          style={[styles.addButton, { borderColor: theme.accent, backgroundColor: theme.backgroundElement }]}>
          <Icon name="plus" size={15} color={theme.accent} />
          <ThemedText type="smallBold" style={[styles.addLabel, { color: theme.accent }]}>
            Agregar producto
          </ThemedText>
        </Pressable>

        <SectionLabel>Justificación</SectionLabel>
        <TextInput
          value={justification}
          onChangeText={setJustification}
          placeholder="Por qué el cliente devuelve esta mercadería"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.input,
            styles.notesInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        />
        <ThemedText themeColor="textSecondary" style={styles.fieldCaption}>
          Aplica a toda la devolución. Lo puntual de cada producto va en su observación.
        </ThemedText>
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
        {/* The first thing still missing, named. A disabled button with no explanation is the
            reason a seller taps it three times and then calls supervision. */}
        {blockers.length > 0 ? (
          <View style={styles.blockerRow}>
            <Icon name="exclamationmark.circle" size={13} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.blockerText}>
              {blockers[0]}
            </ThemedText>
          </View>
        ) : null}

        <Pressable
          disabled={blockers.length > 0}
          onPress={submit}
          style={[
            styles.submitButton,
            { backgroundColor: theme.accent, opacity: blockers.length > 0 ? 0.4 : 1 },
          ]}>
          <Icon name="shippingbox.slash" size={16} color={theme.onAccent} />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Registrar devolución
            {lines.length > 0 ? ` · ${lines.length}` : ''}
          </ThemedText>
        </Pressable>
      </View>

      <ReturnLineSheet
        visible={sheetVisible}
        line={editingLine}
        onSave={saveLine}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
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
  },
  pinned: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  clientIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientTexts: {
    flex: 1,
    gap: 1,
  },
  clientName: {
    fontSize: 12,
    lineHeight: 16,
  },
  clientMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  count: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  countText: {
    fontSize: 11,
  },
  fieldCaption: {
    fontSize: 11,
    lineHeight: 15,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: ControlHeight.input,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addLabel: {
    fontSize: 12,
  },
  input: {
    minHeight: ControlHeight.input,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    fontSize: 13,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  blockerText: {
    flex: 1,
    fontSize: 11,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
  },
});
