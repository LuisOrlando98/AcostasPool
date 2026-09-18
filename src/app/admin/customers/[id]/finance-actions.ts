"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  CUSTOMER_DETAIL_ERRORS,
  CUSTOMER_DETAIL_INLINE_ERRORS,
  failure,
  type ActionResult,
  type ActionState,
} from "@/components/customers/forms/action-result";
import {
  applyMembershipFeeSchema,
  cancelMembershipSchema,
  generateServiceContractSchema,
  parseFormData,
  sendServiceStartSchema,
  signServiceContractSchema,
  updateContractedPlanSchema,
  updateCustomerFinancialsSchema,
} from "@/components/customers/forms/schemas";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { sendContractReadyEmail } from "@/lib/contracts/notify";
import {
  buildSnapshotFields,
  customerLocale,
  loadCustomerForContract,
  renderAndStoreContractPdf,
  startOfCurrentPeriodMonth,
  storeSignatureDataUrl,
} from "@/lib/contracts/service";
import { createNotification } from "@/lib/notifications/create";
import { cancelMembership } from "@/lib/payments/cancel";
import { applyFeeToMembership } from "@/lib/payments/fees";
import { sendMembershipStartEmail } from "@/lib/payments/notify";
import { revalidateAttentionPaths } from "@/lib/reports/revalidate";
import { getCompanySignatureUrl } from "@/lib/site-settings";
import {
  ACCOUNTING_PATH,
  INVOICES_PATH,
  LIVE_MEMBERSHIP_STATUSES,
  customerDetailErrorPath,
  customerDetailFeedbackPath,
  customerDetailPath,
  errorMessageOf,
  findCustomerProperty,
  redirectOnFailure,
  translatedError,
} from "./action-helpers";

/**
 * Finanzas, contrato de servicio y membresía de autopago de la ficha de
 * cliente. Se separan de `actions.ts` (perfil, propiedades, trabajos y planes)
 * para que ningún módulo de acciones pase del techo de mantenibilidad.
 */

/**
 * Finanzas del cliente: plan contratado y método de pago viven en Customer;
 * los datos de cobro (inicio de servicio, día, precio, tipo y notas) en la
 * propiedad principal, que es la que factura el autopago.
 */
export async function updateCustomerFinancials(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(updateCustomerFinancialsSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { data } = parsed;
  const { customerId, primaryPropertyId } = data;

  if (primaryPropertyId && !(await findCustomerProperty(primaryPropertyId, customerId))) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyNotFound);
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      contractedServiceTierId: data.contractedServiceTierId || null,
      paymentMethod: data.paymentMethod,
    },
  });

  if (primaryPropertyId) {
    await prisma.property.update({
      where: { id: primaryPropertyId },
      data: data.servicePaymentInfo,
    });
  }

  revalidatePath(INVOICES_PATH);
  revalidateAttentionPaths(customerId);
  redirect(customerDetailFeedbackPath(customerId, "customer-financials-saved"));
}

/**
 * Genera (o refresca) el contrato de servicio del periodo en curso y su PDF.
 *
 * Un borrador todavía no se ha enseñado al cliente, así que regenerarlo
 * refresca el mismo registro en vez de acumular duplicados del mismo periodo.
 * Una vez enviado o firmado es un documento entregado, así que una nueva
 * generación abre una fila nueva en lugar de mutarlo.
 *
 * El `findFirst` usa el mismo orden que la ficha (periodMonth desc, createdAt
 * desc): sin ese orden podría actualizar en silencio un borrador antiguo
 * distinto del que se ve en pantalla.
 */
export async function generateServiceContract(formData: FormData): Promise<void> {
  await requireRole("ADMIN");

  const parsed = parseFormData(generateServiceContractSchema, formData);
  if (!parsed.success) {
    redirectOnFailure(parsed.result, formData);
    return;
  }
  const { customerId } = parsed.data;

  let redirectPath: string;
  try {
    const customer = await loadCustomerForContract(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const snapshot = buildSnapshotFields(customer);
    const locale = customerLocale(customer.idiomaPreferencia);
    const companySignatureUrl = await getCompanySignatureUrl();
    const periodMonth = startOfCurrentPeriodMonth();

    const mostRecentContract = await prisma.serviceContract.findFirst({
      where: { customerId },
      orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }],
    });
    const existingDraft =
      mostRecentContract &&
      mostRecentContract.status === "DRAFT" &&
      mostRecentContract.periodMonth.getTime() === periodMonth.getTime()
        ? mostRecentContract
        : null;

    const contract = existingDraft
      ? await prisma.serviceContract.update({
          where: { id: existingDraft.id },
          data: { locale, companySignatureUrl, ...snapshot },
        })
      : await prisma.serviceContract.create({
          data: {
            customerId,
            locale,
            status: "DRAFT",
            periodMonth,
            companySignatureUrl,
            ...snapshot,
          },
        });

    await renderAndStoreContractPdf(contract);
    redirectPath = customerDetailFeedbackPath(customerId, "contract-generated");
  } catch (error) {
    console.error("service-contract: failed to generate contract", customerId, error);
    redirectPath = customerDetailErrorPath(
      customerId,
      "contract-generate-failed",
      errorMessageOf(error)
    );
  }

  revalidateAttentionPaths(customerId);
  redirect(redirectPath);
}

/** Firma presencial: el admin recoge la firma del cliente en su dispositivo. */
export async function signServiceContractInPerson(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN");

  const parsed = parseFormData(signServiceContractSchema, formData);
  if (!parsed.success) {
    redirectOnFailure(parsed.result, formData);
    return;
  }
  const { contractId, customerId, signatureDataUrl } = parsed.data;

  let redirectPath: string;
  try {
    const contract = await prisma.serviceContract.findUnique({
      where: { id: contractId },
      select: { customerId: true },
    });
    if (!contract || contract.customerId !== customerId) {
      throw new Error("Contract not found");
    }

    const requestHeaders = await headers();
    const clientSignatureUrl = await storeSignatureDataUrl(
      customerId,
      contractId,
      "client",
      signatureDataUrl
    );

    const updated = await prisma.serviceContract.update({
      where: { id: contractId },
      data: {
        status: "SIGNED",
        clientSignatureUrl,
        clientSignedAt: new Date(),
        clientSignedVia: "IN_PERSON_ADMIN",
        clientSignedByUserId: session.sub,
        clientSignedIp: requestHeaders.get("x-forwarded-for") ?? null,
        clientSignedUserAgent: requestHeaders.get("user-agent") ?? null,
      },
    });

    await renderAndStoreContractPdf(updated);
    redirectPath = customerDetailFeedbackPath(customerId, "contract-signed");
  } catch (error) {
    console.error("service-contract: failed to sign contract in person", contractId, error);
    redirectPath = customerDetailErrorPath(
      customerId,
      "contract-sign-failed",
      errorMessageOf(error)
    );
  }

  revalidateAttentionPaths(customerId);
  redirect(redirectPath);
}

/** Cancela la membresía de autopago al final del periodo o de inmediato. */
export async function cancelMembershipAction(formData: FormData): Promise<void> {
  await requireRole("ADMIN");

  const parsed = parseFormData(cancelMembershipSchema, formData);
  if (!parsed.success) {
    redirectOnFailure(parsed.result, formData);
    return;
  }
  const { membershipId, customerId, mode } = parsed.data;

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { customerId: true },
  });
  if (!membership || membership.customerId !== customerId) {
    redirectOnFailure(failure(CUSTOMER_DETAIL_ERRORS.customerNotFound), formData);
    return;
  }

  await cancelMembership(membershipId, mode);
  revalidatePath(ACCOUNTING_PATH);
  revalidateAttentionPaths(customerId);
}

/**
 * Las tres acciones siguientes las invocan `SendServiceStartModal` e
 * `InlineActionButton` desde el cliente, que muestran el mensaje tal cual:
 * por eso devuelven `{ error }` ya traducido en vez de una clave i18n.
 */
export async function updateContractedPlanAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  await requireRole("ADMIN");

  const parsed = parseFormData(updateContractedPlanSchema, formData);
  if (!parsed.success) {
    return translatedError(parsed.result);
  }
  const { customerId, contractedServiceTierId } = parsed.data;

  const tier = await prisma.serviceTier.findUnique({
    where: { id: contractedServiceTierId },
    select: { id: true },
  });
  if (!tier) {
    return translatedError(failure(CUSTOMER_DETAIL_INLINE_ERRORS.planRequired));
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { contractedServiceTierId },
  });

  revalidatePath(customerDetailPath(customerId));
}

/**
 * Envía al cliente el arranque del servicio: marca el borrador como enviado,
 * le avisa en el portal y manda el correo de firma (si ya paga por autopago)
 * o el de alta de membresía.
 */
export async function sendServiceStartAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  await requireRole("ADMIN");

  const parsed = parseFormData(sendServiceStartSchema, formData);
  if (!parsed.success) {
    return translatedError(parsed.result);
  }
  const { customerId, propertyId, contractId } = parsed.data;

  if (!(await findCustomerProperty(propertyId, customerId))) {
    return translatedError(failure(CUSTOMER_DETAIL_ERRORS.propertyNotFound));
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { contractedServiceTierId: true },
  });
  if (!customer?.contractedServiceTierId) {
    return translatedError(failure(CUSTOMER_DETAIL_INLINE_ERRORS.planRequired));
  }

  const activeMembership = await prisma.membership.findFirst({
    where: { customerId, propertyId, status: { in: [...LIVE_MEMBERSHIP_STATUSES] } },
    select: { id: true },
  });

  if (contractId) {
    const contract = await prisma.serviceContract.findUnique({
      where: { id: contractId },
      select: { customerId: true },
    });
    if (!contract || contract.customerId !== customerId) {
      return translatedError(failure(CUSTOMER_DETAIL_INLINE_ERRORS.sendFailed));
    }
    await prisma.serviceContract.update({
      where: { id: contractId },
      data: { status: "SENT", sentAt: new Date() },
    });
    await createNotification({
      customerId,
      recipientRole: "CUSTOMER",
      eventType: "CONTRACT_READY_TO_SIGN",
      severity: "INFO",
      payload: { contractId },
    });
  }

  // El correo ya llega traducido y con el detalle del fallo SMTP.
  const result = activeMembership
    ? await sendContractReadyEmail(customerId)
    : await sendMembershipStartEmail(customerId, propertyId);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidateAttentionPaths(customerId);
}

/** Añade la comisión de pago a una membresía creada antes de que existiera. */
export async function applyMembershipFeeAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  await requireRole("ADMIN");

  const parsed = parseFormData(applyMembershipFeeSchema, formData);
  if (!parsed.success) {
    return translatedError(parsed.result);
  }
  const { membershipId, customerId } = parsed.data;

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { customerId: true },
  });
  if (!membership || membership.customerId !== customerId) {
    return translatedError(failure(CUSTOMER_DETAIL_INLINE_ERRORS.membershipFailed));
  }

  try {
    await applyFeeToMembership(membershipId);
  } catch (error) {
    console.error("[admin] applyFeeToMembership failed", error);
    return translatedError(failure(CUSTOMER_DETAIL_INLINE_ERRORS.membershipFeeFailed));
  }

  revalidatePath(customerDetailPath(customerId));
}
