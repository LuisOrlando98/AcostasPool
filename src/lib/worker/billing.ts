import {
  CONTRACT_REGENERATE_TIMEOUT_MS,
  STRIPE_RECONCILE_TIMEOUT_MS,
} from "@/lib/worker/constants";
import {
  callInternalEndpoint,
  type InternalEndpointDeps,
  type InternalEndpointSummary,
} from "@/lib/worker/internal-endpoint";

/**
 * Tareas de facturación que la web ejecuta tras la llamada del worker:
 * regeneración mensual de contratos de servicio y conciliación diaria con Stripe.
 */

export const CONTRACT_REGENERATE_PATH = "/api/internal/contracts/regenerate";
export const STRIPE_RECONCILE_PATH = "/api/internal/stripe/reconcile";
const CONTRACT_REGENERATE_LABEL = "contract regeneration";
const STRIPE_RECONCILE_LABEL = "stripe reconcile";

export type BillingTriggerDeps = InternalEndpointDeps;
export type BillingTriggerSummary = InternalEndpointSummary;

/** Regenera el contrato del periodo en curso para los clientes cuyo último contrato está firmado. */
export async function triggerContractRegeneration(
  deps: BillingTriggerDeps
): Promise<BillingTriggerSummary> {
  return callInternalEndpoint(deps, {
    path: CONTRACT_REGENERATE_PATH,
    label: CONTRACT_REGENERATE_LABEL,
    timeoutMs: CONTRACT_REGENERATE_TIMEOUT_MS,
  });
}

/** Contrasta contra Stripe el estado de membresías y pagos registrados en la base de datos. */
export async function triggerStripeReconcile(
  deps: BillingTriggerDeps
): Promise<BillingTriggerSummary> {
  return callInternalEndpoint(deps, {
    path: STRIPE_RECONCILE_PATH,
    label: STRIPE_RECONCILE_LABEL,
    timeoutMs: STRIPE_RECONCILE_TIMEOUT_MS,
  });
}
