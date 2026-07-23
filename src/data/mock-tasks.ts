import type { ThemeColor } from '@/constants/theme';
import type { IconName } from '@/components/ui/icon';

/**
 * How the seller is expected to answer a task. The response type drives which
 * input the app renders when the seller opens the task to complete it.
 */
export type TaskResponseType = 'foto' | 'texto' | 'checklist' | 'calificacion';

/** Optional urgency the supervisor may assign to a task. */
export type TaskPriority = 'baja' | 'normal' | 'alta' | 'urgente';

/**
 * Accent color the supervisor picks for the task. Kept as a small named set that
 * maps to theme tokens so the palette stays consistent with the rest of the app.
 */
export type TaskColor = 'accent' | 'violet' | 'accentAlt' | 'success' | 'danger';

export type ChecklistItem = { id: string; label: string };

/**
 * A task defined by the supervisor and surfaced per client in the seller app.
 * This is the domain model — the screen only reads it. When a real backend is
 * wired in, this is the shape the API should return.
 */
export type SupervisorTask = {
  id: string;
  /** Client this task targets. `null` means it applies to every client. */
  clientId: string | null;
  title: string;
  description: string;
  color: TaskColor;
  responseType: TaskResponseType;
  /** Absent when the supervisor left the task without a priority. */
  priority?: TaskPriority;
  /** Whether the seller must complete it before closing the visit. */
  required: boolean;
  /** Human-formatted deadline; absent when open-ended. */
  dueDate?: string;
  /** Items for `checklist` tasks. */
  checklist?: ChecklistItem[];
};

/** Visual + copy metadata for each response type (theme color token keys). */
export const RESPONSE_META: Record<
  TaskResponseType,
  { label: string; icon: IconName; hint: string }
> = {
  foto: { label: 'Foto', icon: 'camera', hint: 'Adjuntá hasta 3 fotos como evidencia.' },
  texto: { label: 'Texto', icon: 'doc.text', hint: 'Escribí tu respuesta.' },
  checklist: { label: 'Checklist', icon: 'checklist', hint: 'Marcá cada punto verificado.' },
  calificacion: { label: 'Calificación', icon: 'star', hint: 'Asigná una calificación de 1 a 5.' },
};

/** Visual metadata for each priority (theme color token keys). */
export const PRIORITY_META: Record<TaskPriority, { label: string; color: ThemeColor; soft: ThemeColor }> = {
  baja: { label: 'Baja', color: 'textSecondary', soft: 'backgroundSelected' },
  normal: { label: 'Normal', color: 'accent', soft: 'accentSoft' },
  alta: { label: 'Alta', color: 'accentAlt', soft: 'accentAltSoft' },
  urgente: { label: 'Urgente', color: 'danger', soft: 'dangerSoft' },
};

/** Sort weight so the highest-urgency tasks float to the top of the list. */
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgente: 0,
  alta: 1,
  normal: 2,
  baja: 3,
};

/** Maps a task color to its (base, soft) theme token pair. */
export const TASK_COLOR_META: Record<TaskColor, { color: ThemeColor; soft: ThemeColor }> = {
  accent: { color: 'accent', soft: 'accentSoft' },
  violet: { color: 'violet', soft: 'violetSoft' },
  accentAlt: { color: 'accentAlt', soft: 'accentAltSoft' },
  success: { color: 'success', soft: 'successSoft' },
  danger: { color: 'danger', soft: 'dangerSoft' },
};

// Tasks that apply to every client — one per response type so any client shows
// the full range of task kinds.
const allClientTasks: SupervisorTask[] = [
  {
    id: 't-photo-shelf',
    clientId: null,
    title: 'Foto de exhibición en góndola',
    description: 'Capturá la exhibición actual de nuestros productos en el punto de venta.',
    color: 'accent',
    responseType: 'foto',
    priority: 'alta',
    required: true,
    dueDate: 'Hoy',
  },
  {
    id: 't-checklist-visibility',
    clientId: null,
    title: 'Checklist de visibilidad',
    description: 'Verificá los materiales de punto de venta instalados en el local.',
    color: 'violet',
    responseType: 'checklist',
    priority: 'normal',
    required: true,
    checklist: [
      { id: 'ck-1', label: 'Afiche en vidriera' },
      { id: 'ck-2', label: 'Exhibidor en caja' },
      { id: 'ck-3', label: 'Precio visible al público' },
      { id: 'ck-4', label: 'Productos al frente de góndola' },
    ],
  },
  {
    id: 't-text-notes',
    clientId: null,
    title: 'Observaciones de la visita',
    description: 'Registrá cualquier comentario relevante del cliente o del punto de venta.',
    color: 'success',
    responseType: 'texto',
    required: false,
  },
  {
    id: 't-rating-service',
    clientId: null,
    title: 'Calificación de atención',
    description: 'Calificá la experiencia general de atención en el punto de venta.',
    color: 'accentAlt',
    responseType: 'calificacion',
    priority: 'baja',
    required: false,
  },
];

// Extra tasks targeted at specific clients, on top of the shared ones above.
const perClientTasks: SupervisorTask[] = [
  {
    id: 't-urgent-debt',
    clientId: 'c-540902',
    title: 'Gestionar deuda en mora',
    description: 'Conversá con el cliente sobre el saldo vencido y registrá el compromiso de pago.',
    color: 'danger',
    responseType: 'texto',
    priority: 'urgente',
    required: true,
    dueDate: 'Hoy',
  },
  {
    id: 't-new-client-photo',
    clientId: 'c-778112',
    title: 'Foto de fachada del local',
    description: 'Cliente nuevo: registrá una foto de la fachada para el alta comercial.',
    color: 'violet',
    responseType: 'foto',
    priority: 'alta',
    required: true,
    dueDate: '24 jul 2026',
  },
];

const tasks: SupervisorTask[] = [...allClientTasks, ...perClientTasks];

/**
 * Tasks the seller sees for a given client: the ones targeted at that client
 * plus every task that applies to all clients, ordered by priority.
 */
export function tasksForClient(clientId: string): SupervisorTask[] {
  return tasks
    .filter((t) => t.clientId === null || t.clientId === clientId)
    .sort((a, b) => {
      const pa = a.priority ? PRIORITY_WEIGHT[a.priority] : 4;
      const pb = b.priority ? PRIORITY_WEIGHT[b.priority] : 4;
      return pa - pb;
    });
}
