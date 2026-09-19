/**
 * Iconos SVG en línea del asistente (mismo estilo que `AppShell.tsx`: trazo de
 * 1.8, `currentColor`). Siempre decorativos: el nombre accesible lo pone el
 * texto o el `aria-label` del botón que los contiene.
 */

type IconProps = { readonly className?: string };

const DEFAULT_CLASS = "h-4 w-4";
const DEFAULT_STROKE_WIDTH = 1.8;

function Icon({
  className = DEFAULT_CLASS,
  d,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: IconProps & { readonly d: string; readonly strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

/** Asa de arrastre: los seis puntos del ⠿, con trazo redondo. */
export function DragHandleIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      strokeWidth={2.6}
      d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"
    />
  );
}

/** Chincheta de mapa para "Corregir ubicación". */
export function LocationIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      d="M12 21c4.5-4.6 7-8 7-11a7 7 0 10-14 0c0 3 2.5 6.4 7 11zM12 10.5h.01"
    />
  );
}

export function MoveIcon(props: IconProps) {
  return <Icon {...props} d="M4 8h11m0 0l-3-3m3 3l-3 3M20 16H9m0 0l3-3m-3 3l3 3" />;
}

export function RemoveIcon(props: IconProps) {
  return <Icon {...props} d="M6 6l12 12M18 6L6 18" />;
}

export function RestoreIcon(props: IconProps) {
  return <Icon {...props} d="M4 10h10a5 5 0 110 10H9M4 10l4-4M4 10l4 4" />;
}

export function RecalculateIcon(props: IconProps) {
  return (
    <Icon
      {...props}
      d="M20 12a8 8 0 11-2.6-5.9M20 4v4h-4"
    />
  );
}

export function UndoIcon(props: IconProps) {
  return <Icon {...props} d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12h-1" />;
}

export function ResetIcon(props: IconProps) {
  return <Icon {...props} d="M4 6h16M7 6v12a2 2 0 002 2h6a2 2 0 002-2V6M10 11v5M14 11v5" />;
}

export function ListIcon(props: IconProps) {
  return <Icon {...props} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />;
}

export function WarningIcon(props: IconProps) {
  return <Icon {...props} d="M12 9v4m0 3h.01M10.3 4.3L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" />;
}
