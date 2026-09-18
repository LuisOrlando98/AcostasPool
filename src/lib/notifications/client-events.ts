/**
 * Canal in-process entre vistas de notificaciones de la misma pestaña.
 *
 * El centro de notificaciones (`AdminNotificationsCenter`) y la campana
 * (`NotificationsBell`) conviven en la misma página. Cuando una de las dos
 * cambia el estado en el servidor, emite este evento para que la otra recargue
 * sin esperar al sondeo. La recarga resultante es silenciosa: es la propia
 * acción del usuario, no una novedad, y no debe sonar.
 */

export const NOTIFICATIONS_CHANGED_EVENT = "ap:notifications-changed";

export function emitNotificationsChanged(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
}

/** Devuelve la función de baja; segura de llamar durante la limpieza de un efecto. */
export function subscribeNotificationsChanged(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  };
}
