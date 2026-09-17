import {
  EnvValidationError,
  validateEnv,
  type EnvSource,
  type EnvValidationResult,
} from "@/lib/config/env";
import type { WorkerLogger } from "@/lib/worker/logger";

/**
 * Variables obligatorias de la web que el worker no usa: no firma sesiones,
 * así que su ausencia no debe impedir el arranque del worker.
 */
const WEB_ONLY_VARIABLES: readonly string[] = ["AUTH_SECRET"];
const PRODUCTION_ENV = "production";
const ENV_LOG_PREFIX = "[env]";

function concernsWebOnlyVariable(message: string): boolean {
  return WEB_ONLY_VARIABLES.some((name) => message.startsWith(`${name} `));
}

/** `validateEnv` de la app sin los problemas de variables que solo usa la web. */
export function validateWorkerEnv(source: EnvSource = process.env): EnvValidationResult {
  const result = validateEnv(source);
  const missingRequired = result.missingRequired.filter(
    (name) => !WEB_ONLY_VARIABLES.includes(name)
  );
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    errors: result.errors.filter((message) => !concernsWebOnlyVariable(message)),
    warnings: result.warnings.filter((message) => !concernsWebOnlyVariable(message)),
  };
}

/**
 * Registra advertencias y errores del entorno. Igual que `src/instrumentation.ts`
 * para la web: solo con NODE_ENV=production un problema bloqueante aborta el
 * arranque (lanza `EnvValidationError`).
 */
export function reportWorkerEnv(
  logger: WorkerLogger,
  source: EnvSource = process.env
): EnvValidationResult {
  const result = validateWorkerEnv(source);
  result.warnings.forEach((message) => logger.warn(`${ENV_LOG_PREFIX} ${message}`));
  result.errors.forEach((message) => logger.error(`${ENV_LOG_PREFIX} ${message}`));
  if (source.NODE_ENV === PRODUCTION_ENV && !result.ok) {
    throw new EnvValidationError(result);
  }
  return result;
}
