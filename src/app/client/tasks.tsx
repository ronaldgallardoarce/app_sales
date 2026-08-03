import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  LowRotationForm,
  ProductPickerView,
  emptyLowRotationEntry,
  isLowRotationEntryComplete,
  type LowRotationEntry,
} from '@/components/client/low-rotation-form';
import { LowRotationList } from '@/components/client/low-rotation-list';
import { VisitTimer } from '@/components/client/visit-timer';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon, type IconName } from '@/components/ui/icon';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { CardShadow, ChipPadding, ControlHeight, Radius, Spacing } from '@/constants/theme';
import { mapClients } from '@/data/mock-clients';
import {
  // PRIORITY_META — re-add when the priority chips below are uncommented.
  RESPONSE_META,
  TASK_COLOR_META,
  tasksForClient,
  type SupervisorTask,
} from '@/data/mock-tasks';
import { useClientVisits } from '@/context/client-visit-context';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme, useThemeScheme } from '@/hooks/use-theme';
import { withAlpha } from '@/utils/color';

type TaskStatus = 'pendiente' | 'completada';
type Filter = 'todas' | 'pendientes' | 'hechas';

/**
 * Which content the execution sheet shows. Each of these is a swap rather than a second
 * sheet: this renders inside a `BottomSheet`, which is a `Modal`, so another sheet would be
 * presented *below* the open one and never appear. The flag lives here and not in the forms
 * because the sheet footer — mounted outside them — has to know which action it is offering.
 *
 * `entry` is the editor for one slow-moving product; `product` is the picker raised from
 * inside that editor, so going back from it returns to `entry` and not to `task`.
 */
type TaskSheetView = 'task' | 'entry' | 'product';

/** Max photos allowed on a "foto" task. */
const MAX_PHOTOS = 3;

/** In-progress answer while a task sheet is open. Committed on "Completar". */
type Draft = {
  photos: string[];
  text: string;
  checked: Record<string, boolean>;
  rating: number;
  /** The slow-moving products loaded so far. Owned by the form component, which is the only
   *  thing that reads the fields of an entry. */
  lowRotation: LowRotationEntry[];
};

function emptyDraft(): Draft {
  return { photos: [], text: '', checked: {}, rating: 0, lowRotation: [] };
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'hechas', label: 'Hechas' },
];

export default function ClientTasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useContentInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { markTasksDone } = useClientVisits();

  const client = mapClients.find((c) => c.id === id) ?? null;
  const tasks = useMemo(() => (client ? tasksForClient(client) : []), [client]);

  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({});
  const [filter, setFilter] = useState<Filter>('todas');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [sheetView, setSheetView] = useState<TaskSheetView>('task');
  /**
   * The entry being added or edited. A scratch copy, not a reference into `draft.lowRotation`:
   * backing out of the editor has to leave the loaded record exactly as it was, and saving is
   * the only thing that writes to the list.
   */
  const [entryDraft, setEntryDraft] = useState<LowRotationEntry | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/map' as Href));

  if (!client) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: theme.background }]}>
        <Icon name="person.2.fill" size={28} color={theme.textSecondary} />
        <ThemedText type="smallBold">Cliente no encontrado</ThemedText>
        <Pressable onPress={goBack} style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Volver
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const statusOf = (taskId: string): TaskStatus => statuses[taskId] ?? 'pendiente';
  const total = tasks.length;
  const done = tasks.filter((t) => statusOf(t.id) === 'completada').length;
  const requiredPending = tasks.filter((t) => t.required && statusOf(t.id) === 'pendiente').length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const visibleTasks = tasks.filter((t) => {
    if (filter === 'pendientes') return statusOf(t.id) === 'pendiente';
    if (filter === 'hechas') return statusOf(t.id) === 'completada';
    return true;
  });

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  const openTask = (task: SupervisorTask) => {
    // Seed the draft: re-open a completed task with a fresh sheet (mockup keeps
    // no persisted answer), otherwise start blank.
    setDraft(emptyDraft());
    // A sheet left on the editor or the picker would open the next task showing a
    // half-filled product form.
    setSheetView('task');
    setEntryDraft(null);
    setActiveId(task.id);
  };

  const closeSheet = () => setActiveId(null);

  const completeTask = () => {
    if (!activeTask) return;
    setStatuses((prev) => ({ ...prev, [activeTask.id]: 'completada' }));
    // Signal the visit that at least one task was done — drives the exit status.
    if (client) markTasksDone(client.id);
    setActiveId(null);
  };

  /* --- Slow-moving entries: the list lives in the draft, the editor in `entryDraft` --- */

  const addEntry = () => {
    setEntryDraft(emptyLowRotationEntry());
    setSheetView('entry');
  };

  const editEntry = (id: string) => {
    const entry = draft.lowRotation.find((e) => e.id === id);
    if (!entry) return;
    setEntryDraft({ ...entry, photos: [...entry.photos] });
    setSheetView('entry');
  };

  const removeEntry = (id: string) =>
    setDraft((d) => ({ ...d, lowRotation: d.lowRotation.filter((e) => e.id !== id) }));

  /** Upsert by id: editing replaces in place, adding appends. */
  const saveEntry = () => {
    if (!entryDraft) return;
    setDraft((d) => ({
      ...d,
      lowRotation: d.lowRotation.some((e) => e.id === entryDraft.id)
        ? d.lowRotation.map((e) => (e.id === entryDraft.id ? entryDraft : e))
        : [...d.lowRotation, entryDraft],
    }));
    setEntryDraft(null);
    setSheetView('task');
  };

  /** Back out of the editor. The scratch copy is dropped, so the list is untouched. */
  const cancelEntry = () => {
    setEntryDraft(null);
    setSheetView('task');
  };

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

          <View style={styles.titleColumn}>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              Tareas
            </ThemedText>
            {/* Owner: route-level context, matching every other screen header. */}
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {client.ownerCode}-{client.owner}
            </ThemedText>
          </View>

          {/* Visit counter — same placement across every client screen */}
          <VisitTimer clientId={client.id} compact />

          <View style={[styles.countChip, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {done}/{total}
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.three }]}>
        {/* Progress summary */}
        <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={styles.summaryTop}>
            <ThemedText type="smallBold" style={styles.summaryValue}>
              {done} de {total} completadas
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: pct === 100 ? theme.success : theme.accent }}>
              {pct}%
            </ThemedText>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${pct}%`, backgroundColor: pct === 100 ? theme.success : theme.accent },
              ]}
            />
          </View>

          <View style={styles.reqRow}>
            <Icon
              name={requiredPending > 0 ? 'exclamationmark.circle' : 'checkmark.circle.fill'}
              size={12}
              color={requiredPending > 0 ? theme.danger : theme.success}
            />
            <ThemedText
              type="smallBold"
              style={[styles.reqRowText, { color: requiredPending > 0 ? theme.danger : theme.success }]}>
              {requiredPending > 0
                ? `${requiredPending} obligatoria${requiredPending > 1 ? 's' : ''} pendiente${requiredPending > 1 ? 's' : ''}`
                : 'Sin obligatorias pendientes'}
            </ThemedText>
          </View>
        </View>

        {/* Filters */}
        <View style={[styles.segmented, { backgroundColor: theme.backgroundSelected }]}>
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.segment, selected && { backgroundColor: theme.backgroundElement }]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.segmentText, { color: selected ? theme.text : theme.textSecondary }]}>
                  {f.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Task list */}
        {visibleTasks.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="checklist" size={30} color={theme.textSecondary} />
            <ThemedText type="smallBold" themeColor="textSecondary">
              {filter === 'hechas' ? 'Todavía no completaste tareas' : 'No hay tareas para mostrar'}
            </ThemedText>
          </View>
        ) : (
          visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              status={statusOf(task.id)}
              onPress={() => openTask(task)}
            />
          ))
        )}
      </ScrollView>

      {/* Execution sheet */}
      <BottomSheet
        visible={activeTask !== null}
        onClose={closeSheet}
        footer={
          activeTask ? (
            <SheetFooter
              task={activeTask}
              draft={draft}
              view={sheetView}
              entryDraft={entryDraft}
              completed={statusOf(activeTask.id) === 'completada'}
              onComplete={completeTask}
              onSaveEntry={saveEntry}
            />
          ) : null
        }>
        {activeTask ? (
          <TaskSheet
            task={activeTask}
            draft={draft}
            setDraft={setDraft}
            view={sheetView}
            onViewChange={setSheetView}
            entryDraft={entryDraft}
            setEntryDraft={setEntryDraft}
            onAddEntry={addEntry}
            onEditEntry={editEntry}
            onRemoveEntry={removeEntry}
            onCancelEntry={cancelEntry}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Task list card — mirrors the client card's gradient wash            */
/* ------------------------------------------------------------------ */

function TaskCard({
  task,
  status,
  onPress,
}: {
  task: SupervisorTask;
  status: TaskStatus;
  onPress: () => void;
}) {
  const theme = useTheme();
  const scheme = useThemeScheme();
  const accent = TASK_COLOR_META[task.color];
  const accentColor = theme[accent.color];
  const response = RESPONSE_META[task.responseType];
  const completed = status === 'completada';

  // Dark surfaces swallow low-alpha tints, so the color wash needs more opacity there than on light.
  const gradientAlphas = scheme === 'dark' ? [0.3, 0.12, 0] : [0.16, 0.04, 0];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.taskCard,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        CardShadow,
      ]}>
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(accentColor, gradientAlphas[0]),
          withAlpha(accentColor, gradientAlphas[1]),
          withAlpha(accentColor, gradientAlphas[2]),
        ]}
        locations={[0, 0.45, 0.8]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.taskBody}>
        <View style={styles.taskTop}>
          <View style={[styles.taskIcon, { backgroundColor: theme[accent.soft] }]}>
            <Icon name={response.icon} size={18} color={accentColor} />
          </View>

          <View style={styles.taskTitleCol}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.taskTitle}>
              {task.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {task.description}
            </ThemedText>
          </View>

          {completed ? (
            <Icon name="checkmark.circle.fill" size={22} color={theme.success} />
          ) : (
            <Icon name="chevron.right" size={18} color={theme.textSecondary} />
          )}
        </View>

        <View style={styles.chipsRow}>
          <Chip icon={response.icon} label={response.label} color={theme.textSecondary} soft={theme.backgroundSelected} />
          {/* Priority is hidden for now — the attribute stays in the domain model
              (SupervisorTask.priority) so re-enabling it is just uncommenting this.
          {task.priority ? (
            <Chip
              icon="flag.fill"
              label={PRIORITY_META[task.priority].label}
              color={theme[PRIORITY_META[task.priority].color]}
              soft={theme[PRIORITY_META[task.priority].soft]}
            />
          ) : null}
          */}
          {task.required ? (
            <Chip icon="exclamationmark.circle" label="Obligatoria" color={theme.danger} soft={theme.dangerSoft} />
          ) : null}
          {task.dueDate ? (
            <Chip icon="calendar" label={task.dueDate} color={theme.textSecondary} soft={theme.backgroundSelected} />
          ) : null}
          {completed ? (
            <Chip icon="checkmark" label="Completada" color={theme.success} soft={theme.successSoft} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Execution sheet — renders the input for the task's response type    */
/* ------------------------------------------------------------------ */

function TaskSheet({
  task,
  draft,
  setDraft,
  view,
  onViewChange,
  entryDraft,
  setEntryDraft,
  onAddEntry,
  onEditEntry,
  onRemoveEntry,
  onCancelEntry,
}: {
  task: SupervisorTask;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  view: TaskSheetView;
  onViewChange: (view: TaskSheetView) => void;
  entryDraft: LowRotationEntry | null;
  setEntryDraft: React.Dispatch<React.SetStateAction<LowRotationEntry | null>>;
  onAddEntry: () => void;
  onEditEntry: (id: string) => void;
  onRemoveEntry: (id: string) => void;
  onCancelEntry: () => void;
}) {
  const theme = useTheme();
  const accent = TASK_COLOR_META[task.color];
  const response = RESPONSE_META[task.responseType];

  // Nothing of the task renders while picking — no header, chips, description or hint.
  // Giving the picker the whole sheet is the reason for swapping instead of expanding
  // the list inline. Back returns to the editor it was raised from, not to the task.
  if (view === 'product' && entryDraft) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.sheetScroll}>
        <ProductPickerView
          selectedId={entryDraft.productId}
          onSelect={(productId) => setEntryDraft((e) => (e ? { ...e, productId } : e))}
          onBack={() => onViewChange('entry')}
        />
      </ScrollView>
    );
  }

  // The editor takes the sheet the same way, for the same reason: it is a form of its own
  // and the task's header above it would only compete with the product being loaded.
  if (view === 'entry' && entryDraft) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.sheetScroll}>
        <View style={styles.entryHeader}>
          <Pressable
            hitSlop={8}
            onPress={onCancelEntry}
            style={[styles.roundButton, { backgroundColor: theme.background }]}>
            <Icon name="chevron.left" size={18} color={theme.text} />
          </Pressable>
          <View style={styles.entryTitles}>
            <ThemedText type="smallBold" style={styles.entryTitle}>
              {draft.lowRotation.some((e) => e.id === entryDraft.id)
                ? 'Editar producto'
                : 'Nuevo producto'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.entrySubtitle}>
              Vencimiento, lote, cantidad y fotos
            </ThemedText>
          </View>
        </View>

        <LowRotationForm
          value={entryDraft}
          onChange={(patch) => setEntryDraft((e) => (e ? { ...e, ...patch } : e))}
          onOpenProductPicker={() => onViewChange('product')}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.sheetScroll}>
      {/* Header */}
      <View style={styles.sheetHeader}>
        <View style={[styles.sheetIcon, { backgroundColor: theme[accent.soft] }]}>
          <Icon name={response.icon} size={18} color={theme[accent.color]} />
        </View>
        <View style={styles.sheetHeaderText}>
          <ThemedText type="smallBold" style={styles.sheetTitle}>
            {task.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {response.label}
          </ThemedText>
        </View>
      </View>

      <View style={styles.chipsRow}>
        {/* Priority is hidden for now — see the matching note in TaskCard.
        {task.priority ? (
          <Chip
            icon="flag.fill"
            label={`Prioridad ${PRIORITY_META[task.priority].label.toLowerCase()}`}
            color={theme[PRIORITY_META[task.priority].color]}
            soft={theme[PRIORITY_META[task.priority].soft]}
          />
        ) : null}
        */}
        {task.required ? (
          <Chip icon="exclamationmark.circle" label="Obligatoria" color={theme.danger} soft={theme.dangerSoft} />
        ) : null}
        {task.dueDate ? (
          <Chip icon="calendar" label={`Vence ${task.dueDate}`} color={theme.textSecondary} soft={theme.backgroundSelected} />
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary" style={styles.sheetDescription}>
        {task.description}
      </ThemedText>

      <View style={[styles.hintRow, { backgroundColor: theme.background }]}>
        <Icon name="exclamationmark.circle" size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.hintText}>
          {response.hint}
        </ThemedText>
      </View>

      {/* Response input */}
      {task.responseType === 'foto' ? (
        <PhotoPicker
          uris={draft.photos}
          onChange={(photos) => setDraft((d) => ({ ...d, photos }))}
          max={MAX_PHOTOS}
        />
      ) : task.responseType === 'texto' ? (
        <TextInput
          value={draft.text}
          onChangeText={(text) => setDraft((d) => ({ ...d, text }))}
          placeholder="Escribí tu respuesta…"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.textArea,
            { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
          ]}
        />
      ) : task.responseType === 'checklist' ? (
        <ChecklistInput task={task} draft={draft} setDraft={setDraft} />
      ) : task.responseType === 'baja-rotacion' ? (
        <LowRotationList
          entries={draft.lowRotation}
          onAdd={onAddEntry}
          onEdit={onEditEntry}
          onRemove={onRemoveEntry}
        />
      ) : (
        <RatingInput value={draft.rating} onChange={(rating) => setDraft((d) => ({ ...d, rating }))} />
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Photo response — capture, pick from gallery, preview (max 3)        */
/* ------------------------------------------------------------------ */

function ChecklistInput({
  task,
  draft,
  setDraft,
}: {
  task: SupervisorTask;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}) {
  const theme = useTheme();
  const toggle = (itemId: string) =>
    setDraft((d) => ({ ...d, checked: { ...d.checked, [itemId]: !d.checked[itemId] } }));

  return (
    <View style={styles.inputGroup}>
      {task.checklist?.map((item) => {
        const on = !!draft.checked[item.id];
        return (
          <Pressable
            key={item.id}
            onPress={() => toggle(item.id)}
            style={[styles.checkRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View
              style={[
                styles.checkbox,
                on
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { borderColor: theme.border },
              ]}>
              {on ? <Icon name="checkmark" size={13} color={theme.onAccent} /> : null}
            </View>
            <ThemedText type="small" style={styles.checkLabel}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function RatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.ratingRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <Pressable key={n} hitSlop={4} onPress={() => onChange(n)} style={styles.starButton}>
            <Icon name={on ? 'star.fill' : 'star'} size={34} color={on ? theme.accentAlt : theme.border} />
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Footer action                                                       */
/* ------------------------------------------------------------------ */

/** Whether the draft satisfies the minimum needed to complete a required task. */
function isDraftComplete(task: SupervisorTask, draft: Draft): boolean {
  switch (task.responseType) {
    case 'foto':
      return draft.photos.length > 0;
    case 'texto':
      return draft.text.trim().length > 0;
    case 'checklist':
      return Object.values(draft.checked).some(Boolean);
    case 'calificacion':
      return draft.rating > 0;
    case 'baja-rotacion':
      // Only the count: "Guardar producto" already refused anything incomplete, so a loaded
      // entry is a complete one by construction.
      return draft.lowRotation.length > 0;
  }
}

/**
 * The sheet's one action, which is a different action per view. The footer stays mounted
 * across the swaps, so leaving "Completar tarea" there while the editor is open would let an
 * optional task be finished from a view that is not showing the task at all — and the button
 * would read as the way to confirm the product.
 */
function SheetFooter({
  task,
  draft,
  view,
  entryDraft,
  completed,
  onComplete,
  onSaveEntry,
}: {
  task: SupervisorTask;
  draft: Draft;
  view: TaskSheetView;
  entryDraft: LowRotationEntry | null;
  completed: boolean;
  onComplete: () => void;
  onSaveEntry: () => void;
}) {
  // The picker has its own back button and confirms by tapping a product. A footer action
  // there would be a second, competing way to leave.
  if (view === 'product') return null;

  if (view === 'entry') {
    return (
      <FooterButton
        icon="tray.and.arrow.down"
        label="Guardar producto"
        enabled={entryDraft !== null && isLowRotationEntryComplete(entryDraft)}
        onPress={onSaveEntry}
      />
    );
  }

  return (
    <FooterButton
      icon="checkmark"
      label={completed ? 'Actualizar respuesta' : 'Completar tarea'}
      enabled={!task.required || isDraftComplete(task, draft)}
      onPress={onComplete}
    />
  );
}

function FooterButton({
  icon,
  label,
  enabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      style={[
        styles.primaryButton,
        { backgroundColor: enabled ? theme.accent : theme.backgroundSelected },
      ]}>
      <Icon name={icon} size={16} color={enabled ? theme.onAccent : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ color: enabled ? theme.onAccent : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Shared chip                                                         */
/* ------------------------------------------------------------------ */

function Chip({
  icon,
  label,
  color,
  soft,
}: {
  icon: IconName;
  label: string;
  color: string;
  soft: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: soft }]}>
      <Icon name={icon} size={11} color={color} />
      <ThemedText type="smallBold" style={[styles.chipText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
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
  titleColumn: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
  },
  countChip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: 6,
  },
  summaryCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 6,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryValue: {
    fontSize: 13,
  },
  progressTrack: {
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: Radius.pill,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reqRowText: {
    fontSize: 11,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    height: ControlHeight.segment,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  taskCard: {
    // md, not lg: the tighter body below would look swollen inside a wider corner.
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  taskBody: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.two,
    gap: 6,
  },
  taskTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitleCol: {
    flex: 1,
    gap: 1,
  },
  taskTitle: {
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: ChipPadding.horizontal,
    paddingVertical: ChipPadding.vertical,
    borderRadius: Radius.pill,
  },
  chipText: {
    fontSize: 11,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: ControlHeight.input,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
  },
  sheetScroll: {
    // Spacing.three is the gutter every other screen and sheet uses.
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    // Small: the footer's own top padding already separates the content from the
    // button, so a full Spacing.three here just doubled that gap.
    paddingBottom: Spacing.one,
    gap: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  entryTitles: {
    flex: 1,
    gap: 1,
  },
  entryTitle: {
    fontSize: 15,
    lineHeight: 19,
  },
  entrySubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderText: {
    flex: 1,
    gap: 1,
  },
  sheetTitle: {
    fontSize: 15,
    // Explicit alongside every reduced font size here: the `small` / `smallBold` types
    // carry lineHeight 20, so a smaller font on its own keeps the old row height.
    lineHeight: 19,
  },
  sheetDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  hintText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  textArea: {
    minHeight: 88,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.two,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  inputGroup: {
    gap: Spacing.two,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 8,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  starButton: {
    padding: 2,
  },
});
