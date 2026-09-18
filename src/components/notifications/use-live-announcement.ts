"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CLEAR_DELAY_MS = 2500;

export type LiveAnnouncement = {
  /** Texto actual de la región viva (cadena vacía cuando no hay anuncio pendiente). */
  readonly message: string;
  readonly announce: (text: string) => void;
};

/**
 * Mensaje para una región viva (`aria-live`/`role="status"`). Se vacía tras
 * `clearDelayMs` para que un anuncio idéntico posterior vuelva a leerse: varios
 * lectores de pantalla ignoran un contenido que no cambia.
 */
export function useLiveAnnouncement(
  clearDelayMs: number = DEFAULT_CLEAR_DELAY_MS
): LiveAnnouncement {
  const [message, setMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const announce = useCallback(
    (text: string) => {
      clearTimer();
      setMessage(text);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setMessage("");
      }, clearDelayMs);
    },
    [clearDelayMs, clearTimer]
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { message, announce };
}
