import {
  MAX_SEND_ATTEMPTS,
  RETRY_BACKOFF_FACTOR,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from "@/lib/worker/constants";

const FIRST_RETRY_EXPONENT = 0;

/** Espera antes del siguiente intento tras `attempts` intentos: base * factor^(attempts-1), con tope. */
export function computeRetryDelayMs(attempts: number): number {
  const exponent = Math.max(attempts - 1, FIRST_RETRY_EXPONENT);
  return Math.min(RETRY_BASE_DELAY_MS * RETRY_BACKOFF_FACTOR ** exponent, RETRY_MAX_DELAY_MS);
}

export function canRetry(attempts: number): boolean {
  return attempts < MAX_SEND_ATTEMPTS;
}

/** True cuando quedan intentos y ya pasó el backoff desde el último (sin intento previo, siempre). */
export function isRetryDue(attempts: number, lastAttemptAt: Date | null, now: Date): boolean {
  if (!canRetry(attempts)) {
    return false;
  }
  if (!lastAttemptAt) {
    return true;
  }
  return lastAttemptAt.getTime() + computeRetryDelayMs(attempts) <= now.getTime();
}
