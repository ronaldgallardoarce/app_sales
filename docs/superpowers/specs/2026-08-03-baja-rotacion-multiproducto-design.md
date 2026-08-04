# Baja rotación: varios productos por tarea

**Fecha:** 2026-08-03
**Estado:** aprobado, pendiente de plan de implementación

## Problema

La tarea de respuesta `baja-rotacion` registra **un solo** producto. En el punto de venta el
vendedor encuentra varios productos con baja rotación en la misma visita y hoy no tiene forma
de cargarlos: la tarea se completa con uno y los demás se pierden.

El objetivo es que una tarea de baja rotación acepte N productos, cada uno con la misma
estructura que hoy tiene el registro único — producto, vencimiento, lote, cantidad y fotos.

Junto con eso, el lote pasa a ser dos datos y no uno: el depósito de origen (el select actual,
`SC` / `LP`) y el número de lote impreso en el paquete, que hoy no se registra en ningún lado.

## Estado actual

- `src/components/client/low-rotation-form.tsx` exporta `LowRotationValue`
  (`productId`, `expiry`, `lot`, `qty`), `emptyLowRotation()`, el formulario `LowRotationForm`
  y `ProductPickerView`.
- `src/app/client/tasks.tsx` guarda la respuesta en curso en `Draft`, con
  `lowRotation: LowRotationValue`. Las fotos del registro se guardan en `draft.photos`,
  el mismo campo que usan las tareas de tipo `foto`.
- El sheet alterna entre dos contenidos con `TaskSheetView = 'task' | 'product'`. El picker de
  producto es un intercambio de contenido y no un segundo sheet, porque `BottomSheet` es un
  `Modal` y un sheet levantado sobre otro quedaría por debajo y nunca sería visible.
- `isDraftComplete` exige, para `baja-rotacion`, producto + vencimiento estrictamente válido +
  lote + cantidad > 0 + al menos una foto.

## Modelo de datos

`LowRotationValue` se reemplaza por un registro con identidad y fotos propias:

```ts
export type LowRotationEntry = {
  /** Identidad local: permite editar y eliminar sin depender de la posición en el array. */
  id: string;
  productId: number | null;
  /** String tipeado DD/MM/AAAA, no `Date`: el campo es una máscara y un valor a medio
   *  tipear es un estado intermedio normal. */
  expiry: string;
  /** Depósito de origen. El select de siempre. */
  lot: LotCode | null;
  /** Número de lote impreso en el paquete. Texto libre: lo define el fabricante, no el
   *  depósito, y no hay lista posible contra la cual validarlo. */
  lotNumber: string;
  qty: number;
  /** Hasta 3, sólo cámara. Se mueve acá desde `draft.photos`. */
  photos: string[];
};
```

`emptyLowRotationEntry(): LowRotationEntry` reemplaza a `emptyLowRotation()`.

Los ids se generan con un contador a nivel de módulo (`lr-1`, `lr-2`, …). El proyecto no tiene
`nanoid` ni ninguna librería de ids, y no hace falta una: los ids sólo tienen que ser únicos
dentro de la sesión y nunca salen de la pantalla.

En `Draft` (tasks.tsx): `lowRotation: LowRotationValue` → `lowRotation: LowRotationEntry[]`,
inicializado como `[]`.

`draft.photos` queda usado únicamente por las tareas de tipo `foto`. Ese acoplamiento — dos
tipos de respuesta compartiendo un campo — es justamente lo que impedía tener fotos por
producto.

## Navegación del sheet

`TaskSheetView` pasa de `'task' | 'product'` a `'task' | 'entry' | 'product'`:

| Vista | Contenido | Botón del footer |
|---|---|---|
| `task` | Lista de tarjetas + "Agregar producto" | **Completar tarea** — habilitado si la tarea no es obligatoria, o si hay ≥ 1 producto cargado |
| `entry` | Formulario del registro: producto, vencimiento, lote, cantidad, fotos | **Guardar producto** — habilitado sólo con el registro completo |
| `product` | `ProductPickerView` | ninguno; el footer queda bloqueado, igual que hoy |

El editor trabaja sobre una copia y no sobre el array:

- `entryDraft: LowRotationEntry | null` — el registro en edición.
- Agregar: `entryDraft = emptyLowRotationEntry()`, vista `entry`.
- Editar: `entryDraft = { ...entry }` (con `photos` copiado), vista `entry`.
- Guardar: *upsert* por `id` en `draft.lowRotation` — reemplaza si el id ya está, agrega al
  final si no. Vuelve a `task`.
- Volver atrás desde `entry`: descarta `entryDraft` sin tocar el array.

El picker de producto escribe en `entryDraft` y vuelve a `entry`, **no** a `task`. Ese es el
único cambio de comportamiento del picker: hoy vuelve a la única vista que existe.

Abrir otra tarea resetea `sheetView` a `task` y `entryDraft` a `null`, por la misma razón por
la que hoy se resetea a `task`: un sheet dejado en el editor abriría la tarea siguiente
mostrando un formulario de producto.

## Componentes

**Nuevo: `src/components/client/low-rotation-list.tsx`.** `low-rotation-form.tsx` ya tiene
~520 líneas; sumarle la lista y la tarjeta lo llevaría cerca de 750, y son responsabilidades
distintas: una edita un registro, la otra muestra el conjunto.

Contiene `LowRotationList`, que recibe `entries`, `onAdd`, `onEdit(id)`, `onRemove(id)` y
renderiza:

- Estado vacío: ícono, "Sin productos cargados" y la indicación de agregar el primero.
- Una tarjeta por registro: `código-nombre` del producto (una línea, truncada), fila
  secundaria `Vto 12/09/26 · SC L-2481 · 8u` — depósito y número de lote juntos, separados por
  un espacio —, contador de fotos, y las acciones editar y eliminar.
- Chip ámbar **"Duplicado"** en las tarjetas que lo sean (ver abajo).
- Botón "Agregar producto" al pie.

Eliminar es inmediato, sin confirmación: es un mockup y rehacer el registro son dos toques.

**`low-rotation-form.tsx`** conserva el tipo, `LowRotationForm` y `ProductPickerView`. El
formulario deja de recibir `photos` / `onPhotosChange` por separado: `photos` ya es un campo
del registro, así que se maneja con el mismo `onChange` de patch que el resto de los campos.
Además exporta dos funciones nuevas:

- `isLowRotationEntryComplete(entry): boolean` — producto elegido, vencimiento válido según
  `isExpiryValid` (la verificación estricta, la que rechaza `31/02`), depósito elegido, número
  de lote no vacío, cantidad > 0 y al menos una foto. Es la que habilita "Guardar producto".
- `duplicateIds(entries): Set<string>` — los ids de los registros que comparten producto,
  depósito, número de lote y vencimiento con algún otro. El número de lote entra en la
  comparación normalizado (mayúsculas y sin espacios en los extremos), igual que se guarda.
  Se calcula con `useMemo` en la lista.

### Campo lote

Una fila con el `Select` actual y un `TextInput` al lado: el select toma el ancho que necesita
para su contenido y el input ocupa el resto (`flex: 1`), porque `SC` / `LP` son dos caracteres
y el número de lote puede tener diez.

Bajo el mismo rótulo `LOTE`, cada control se explica con su placeholder: "Depósito" en el
select, "N° de lote" en el input. Dos rótulos chicos debajo de los controles dirían lo mismo
ocupando otra línea del sheet.

El input usa `autoCapitalize="characters"` — los lotes se imprimen en mayúsculas — y se guarda
con `trim()`. No se limita el largo ni se valida el formato: lo define cada fabricante.

Un duplicado es sólo un aviso visual: no bloquea guardar ni completar la tarea. Un mismo
producto puede aparecer legítimamente dos veces con distinto lote o vencimiento; lo que el
chip señala es la carga repetida por accidente, y decidir es del vendedor.

No hay límite de productos por tarea.

## Validación de la tarea

`isDraftComplete` para `baja-rotacion` se reduce a `draft.lowRotation.length > 0`. La validación
por registro ya ocurrió en el editor: como "Guardar producto" exige el registro completo, el
array no puede contener registros a medias.

Como consecuencia, `tasks.tsx` deja de importar `isExpiryValid`: la verificación del vencimiento
pasa a vivir dentro de `isLowRotationEntryComplete`, junto al resto de las reglas del registro.
La re-exportación de `isExpiryComplete` / `isExpiryValid` en `low-rotation-form.tsx` se mantiene
sólo si queda algún consumidor; si no, se elimina.

## Copy

- `RESPONSE_META['baja-rotacion'].hint` pasa a: "Registrá cada producto de baja rotación con
  su vencimiento, lote, cantidad y fotos." — en plural, porque ahora son varios.
- El rótulo `Lote` del formulario ya no nombra un solo control; los dos placeholders
  ("Depósito", "N° de lote") son los que distinguen qué va en cada uno.
- El resto de los textos de la tarea (`title`, `description` en `mock-tasks.ts`) pasan al
  plural en la tarea `t-chan-trad-baja-rotacion`: "Registrá los productos con baja rotación
  detectados en el punto de venta."
- El comentario de `LotCode` en `mock-tasks.ts` dice que esos códigos son lo que está impreso
  en el paquete. Deja de ser cierto: lo impreso es el número de lote nuevo, y `SC` / `LP` son
  el depósito de origen. Se corrige junto con el cambio.

## Verificación

El proyecto no tiene tests. La verificación es `npx tsc --noEmit` más un recorrido manual en
la app:

1. Abrir la tarea de baja rotación en un cliente del canal `tradicional`.
2. Cargar dos productos distintos; confirmar que cada uno guarda sus propias fotos.
3. Confirmar que "Guardar producto" sigue bloqueado con el depósito elegido pero el número de
   lote vacío.
4. Editar el primero y confirmar que volver atrás sin guardar descarta el cambio.
5. Cargar el mismo producto con mismo depósito, mismo número de lote y mismo vencimiento;
   confirmar el chip "Duplicado" en ambas tarjetas. Cambiarle el número de lote a uno de los
   dos y confirmar que el chip desaparece.
6. Eliminar registros hasta vaciar la lista; confirmar que "Completar tarea" se bloquea en una
   tarea obligatoria.
7. Confirmar que las tareas de tipo `foto` siguen funcionando (no quedaron acopladas al cambio
   de `draft.photos`).

`expo lint` puede instalar dependencias por su cuenta; no se corre sin pedirlo antes.
