# Sugerencias: sección propia y scroll horizontal visible

**Fecha:** 2026-08-03
**Estado:** aprobado

## Problema

En el sheet de detalle de producto del catálogo, la sección "Sugerencias" es una tira de
tarjetas que scrollea horizontal. Dos cosas no se leen:

1. **Que es una sección aparte.** La tira comparte superficie con el resto del sheet y las
   tarjetas son `backgroundElement` sobre `backgroundElement`, así que el bloque se disuelve
   en el flujo vertical.
2. **Que scrollea.** Nada anuncia que hay más tarjetas a la derecha. El indicador nativo está
   apagado (`showsHorizontalScrollIndicator={false}`), y en Android además sería una barra
   permanente que no encaja con el resto del diseño.

El pedido es marcar ambas cosas de forma sutil, sin volver la sección llamativa.

## Estado actual

- `src/components/product-detail/product-detail-sheet.tsx` tiene dos vistas dentro del mismo
  sheet:
  - `detail` (líneas 368-402): una sola tira, con cabecera "Sugerencias" + botón "Ver más" y
    el hint "Toca para cambiar de producto".
  - `related` (líneas 260-277): una tira por cada eje de sugerencia (sabor, tamaño), cada una
    bajo su rótulo en mayúsculas.
- Ambas usan `<ScrollView horizontal showsHorizontalScrollIndicator={false}
  contentContainerStyle={styles.cardsRow}>` con `SuggestionCard` de 112×112.
- El contenido del sheet tiene `paddingHorizontal: Spacing.three`.

## Diseño

### `SuggestionStrip` (nuevo)

`src/components/product-detail/suggestion-strip.tsx`:

```tsx
<SuggestionStrip fadeTo={theme.background}>{cards}</SuggestionStrip>
```

Un `View` relativo que contiene el `ScrollView horizontal` de siempre — mismo
`contentContainerStyle`, mismo indicador apagado — y, absolutamente posicionado sobre el borde
derecho, un `LinearGradient` de 32 px de ancho con `pointerEvents="none"`.

El degradado va de `fadeTo` con alfa 0 a `fadeTo` opaco. **No** a `'transparent'`: en Android
esa palabra interpola pasando por negro transparente y deja un manchón gris sobre las
tarjetas. Por eso `fadeTo` es un parámetro y no algo que el componente deduzca — el que lo usa
es el único que sabe sobre qué superficie está apoyado.

El degradado se auto-oculta cuando no hace falta: si las tarjetas no desbordan, cae sobre el
fondo del contenedor, que es exactamente su color final, y no se ve nada. No hay que medir el
ancho del contenido ni seguir el offset de scroll.

La tira no sangra fuera de su contenedor: el `ScrollView` recorta a sus propios límites, así
que la última tarjeta visible ya queda cortada ahí y el degradado se apoya justo encima.

### Vista `detail`: panel

La sección pasa de `styles.section` a un panel con `backgroundColor: theme.background`,
`borderRadius: Radius.md` y `padding: Spacing.two`, que envuelve cabecera, hint y tira.

Es el mismo gris tenue que ya usan el bloque de precios (`infoCard`) y el de equivalencias
(`equivalenceRow`), así que la sección se separa sin introducir un estilo nuevo en el sheet.
Como efecto lateral las tarjetas ganan contraste: hoy son `backgroundElement` sobre
`backgroundElement`.

`fadeTo` es `theme.background`, el color del panel.

### Vista `related`: sólo el degradado

Cada tira de eje se envuelve en `SuggestionStrip` con `fadeTo={theme.backgroundElement}` — la
superficie del sheet. Sin panel: ahí la pantalla entera ya son sugerencias, así que un panel
por eje no separaría nada de nada y convertiría la vista en una pila de cajas grises.

### `withAlpha` compartido

`withAlpha(hex, alpha)` está hoy copiado idéntico en tres archivos:
`src/app/client/tasks.tsx:72`, `src/app/client/[id].tsx:834` y
`src/components/map/client-card.tsx:19`. El degradado necesita una cuarta.

Se muda a `src/utils/color.ts` y los tres duplicados pasan a importarlo. Cuatro copias de una
función que parsea hex son cuatro lugares donde puede aparecer una diferencia.

No se toca `withAlpha` en `src/constants/category-colors.ts`: tiene otra firma (alfa como
sufijo hex, no como número) y no es el mismo problema.

## Fuera de alcance

- El contenido de las tarjetas y su tamaño (`suggestion-card.tsx`) no cambian.
- El comportamiento no cambia: la tira scrollea y las tarjetas se tocan igual que hoy.
- El otro `withAlpha`, el de `category-colors.ts`.

## Verificación

El proyecto no tiene tests. La verificación es `npx tsc --noEmit` más un recorrido manual:

1. Abrir el catálogo, tocar un producto con sugerencias: la sección se lee como un bloque
   aparte y la última tarjeta se desvanece contra el borde derecho del panel.
2. Deslizar la tira hasta el final: no queda un degradado tapando la última tarjeta cuando ya
   no hay nada más a la derecha (se apoya sobre el panel, del mismo color).
3. Abrir un producto cuya tira no desborde: no se ve ningún degradado.
4. "Ver más": cada tira de eje muestra el mismo desvanecido, sobre la superficie del sheet.
5. Repetir 1 y 4 en modo oscuro: el degradado no debe leerse como una franja gris — es el
   síntoma de que se interpoló contra negro.

`expo lint` puede instalar dependencias por su cuenta; no se corre sin pedirlo antes.
