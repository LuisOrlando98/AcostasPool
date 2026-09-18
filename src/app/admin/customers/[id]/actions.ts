"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ACTION_SUCCESS,
  CUSTOMER_DETAIL_ERRORS,
  failure,
  type ActionResult,
  type ActionState,
} from "@/components/customers/forms/action-result";
import {
  createJobSchema,
  createPropertySchema,
  createServicePlanSchema,
  deleteCustomerSchema,
  deletePropertySchema,
  deleteServicePlanSchema,
  inviteCustomerSchema,
  parseFormData,
  toggleServicePlanSchema,
  updateCustomerSchema,
  updatePropertySchema,
} from "@/components/customers/forms/schemas";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit/log";
import { requireRole } from "@/lib/auth/guards";
import {
  CustomerHasFinancialRecordsError,
  deleteCustomerWithRelations,
} from "@/lib/customers/delete-customer";
import { formatCustomerName } from "@/lib/customers/format";
import { sendCustomerInvite } from "@/lib/customers/invite";
import {
  countUpcomingPlanJobs,
  deleteUpcomingPlanJobs,
  materializeServicePlanJob,
  queueJobScheduledNotifications,
} from "@/lib/jobs/materialize";
import {
  DEFAULT_GLOBAL_PLAN_TIME,
  GLOBAL_RECURRING_PLAN_OPTIONS,
  getGlobalRecurringPlan,
  resolveGlobalPlanStartDate,
} from "@/lib/jobs/recurring-plan-templates";
import { combineDateAndTime } from "@/lib/jobs/scheduling";
import { revalidateAttentionPaths } from "@/lib/reports/revalidate";
import { normalizePropertyAddress } from "@/lib/routing/address";
import {
  getDefaultServiceTierId,
  getServiceTierChecklist,
  getServiceTierIdByName,
} from "@/lib/service-tiers";
import {
  endOfBusinessDay,
  getBusinessTimeParts,
  startOfBusinessDay,
} from "@/lib/timezone";
import { withFeedbackParam } from "@/lib/ui/action-feedback";
import {
  ASSIGNMENTS_PATH,
  CUSTOMERS_LIST_PATH,
  INVOICES_PATH,
  ROUTES_PATH,
  customerDetailFeedbackPath,
  customerDetailPath,
  findCustomerProperty,
  redirectOnFailure,
} from "./action-helpers";

const MINUTES_PER_HOUR = 60;
const STANDARD_TIER_NAME = "Standard";

/**
 * Coordenadas persistidas por el asistente de rutas: si la dirección
 * normalizada cambia se ponen a null para forzar una nueva geocodificación.
 */
function geocodeResetFor(currentAddress: string, nextAddress: string) {
  return currentAddress === nextAddress
    ? {}
    : { lat: null, lng: null, geocodedAt: null };
}

async function findCustomerPlan(planId: string, customerId: string) {
  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId },
    include: {
      customer: { select: { estadoCuenta: true, pauseServicesFrom: true } },
    },
  });
  return plan && plan.customerId === customerId ? plan : null;
}

async function materializePlanAndNotify(planId: string, customerId: string) {
  const plan = await findCustomerPlan(planId, customerId);
  if (!plan) {
    return;
  }
  const job = await materializeServicePlanJob(prisma, plan, {
    now: new Date(),
    advancePlan: true,
  });
  if (job) {
    await queueJobScheduledNotifications(job);
  }
}

function revalidatePlanViews(customerId: string) {
  revalidatePath(customerDetailPath(customerId));
  revalidatePath(ASSIGNMENTS_PATH);
  revalidatePath(ROUTES_PATH);
}

async function pauseCustomerServices(customerId: string) {
  const pauseFrom = startOfBusinessDay(new Date()) ?? new Date();
  await prisma.$transaction([
    prisma.servicePlan.updateMany({
      where: { customerId, isActive: true },
      data: { isActive: false },
    }),
    prisma.job.deleteMany({
      where: {
        customerId,
        planId: { not: null },
        status: { in: ["SCHEDULED", "PENDING"] },
        scheduledDate: { gte: pauseFrom },
      },
    }),
  ]);
}

export async function createProperty(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(createPropertySchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { data } = parsed;
  const normalizedAddress = await normalizePropertyAddress(data.address);

  await prisma.property.create({
    data: {
      customerId: data.customerId,
      name: data.name || null,
      address: normalizedAddress,
      poolType: data.poolType || null,
      waterType: null,
      sanitizerType: data.sanitizerType || null,
      filterType: data.filterType || null,
      poolVolumeGallons: data.poolVolumeGallons,
      hasSpa: data.hasSpa,
      accessInfo: data.accessLocationNotes || null,
      locationNotes: null,
      ...data.servicePaymentInfo,
    },
  });

  revalidatePath(customerDetailPath(data.customerId));
  revalidatePath(INVOICES_PATH);
  redirect(customerDetailFeedbackPath(data.customerId, "property-created"));
}

export async function updateCustomer(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(updateCustomerSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { data } = parsed;
  const { customerId, email } = data;
  const nextAccountStatus = data.estadoCuenta;

  const existingCustomer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      userId: true,
      email: true,
      estadoCuenta: true,
      user: { select: { email: true } },
    },
  });
  if (!existingCustomer) {
    return failure(CUSTOMER_DETAIL_ERRORS.customerNotFound);
  }
  if (email && existingCustomer.userId) {
    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: existingCustomer.userId },
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return failure(CUSTOMER_DETAIL_ERRORS.emailInUse, {
        email: CUSTOMER_DETAIL_ERRORS.emailInUse,
      });
    }
  }

  const resolvedEmail =
    email ||
    (existingCustomer.userId
      ? existingCustomer.user?.email ?? existingCustomer.email ?? ""
      : "");

  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: resolvedEmail,
      telefono: data.telefono,
      telefonoSecundario: data.telefonoSecundario || null,
      estadoCuenta: nextAccountStatus,
      idiomaPreferencia: data.idiomaPreferencia,
      tipoCliente: data.tipoCliente,
      allowWeekendBooking: data.allowWeekendBooking,
      pauseServicesFrom:
        nextAccountStatus === "INACTIVE"
          ? startOfBusinessDay(new Date()) ?? new Date()
          : existingCustomer.estadoCuenta === "INACTIVE"
            ? null
            : undefined,
      direccionLinea1: data.direccionLinea1 || null,
      direccionLinea2: data.direccionLinea2 || null,
      ciudad: data.ciudad || null,
      estadoProvincia: data.estadoProvincia || null,
      codigoPostal: data.codigoPostal || null,
      notas: data.notas || null,
    },
  });

  if (customer.userId) {
    await prisma.user.update({
      where: { id: customer.userId },
      data: {
        email: resolvedEmail,
        fullName: formatCustomerName(customer),
        locale: customer.idiomaPreferencia,
        isActive: nextAccountStatus === "ACTIVE",
      },
    });
  }

  if (nextAccountStatus === "INACTIVE") {
    await pauseCustomerServices(customerId);
  }

  revalidatePath(customerDetailPath(customerId));
  revalidatePath(INVOICES_PATH);
  redirect(customerDetailFeedbackPath(customerId, "customer-saved"));
}

export async function inviteCustomer(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(inviteCustomerSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { customerId } = parsed.data;

  const result = await sendCustomerInvite(customerId).catch((error: unknown) => {
    console.error("Invite failed:", error);
    return { ok: false as const, error: "unexpected" };
  });
  if (!result.ok) {
    console.error("Invite failed:", result.error);
  }

  revalidatePath(customerDetailPath(customerId));
  return result.ok ? ACTION_SUCCESS : failure(CUSTOMER_DETAIL_ERRORS.inviteFailed);
}

export async function deleteCustomer(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  const session = await requireRole("ADMIN");

  const parsed = parseFormData(deleteCustomerSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { customerId } = parsed.data;

  // Contratos, pagos y membresías son `Restrict`: el borrado se aborta entero.
  const outcome = await deleteCustomerWithRelations(prisma, customerId).catch(
    (error: unknown) => {
      if (error instanceof CustomerHasFinancialRecordsError) {
        return error;
      }
      throw error;
    }
  );
  if (outcome instanceof CustomerHasFinancialRecordsError) {
    console.error("Customer delete blocked:", customerId, outcome.counts);
    return failure(CUSTOMER_DETAIL_ERRORS.hasFinancialRecords);
  }
  if (!outcome) {
    redirect(CUSTOMERS_LIST_PATH);
  }

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_DELETED",
    entity: "Customer",
    entityId: outcome.customer.id,
    metadata: {
      email: outcome.customer.email,
      linkedUserId: outcome.customer.userId,
      fullName: formatCustomerName(outcome.customer),
      removedJobs: outcome.removedJobs,
    },
  });

  revalidatePath("/admin");
  revalidatePath(INVOICES_PATH);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/reports");
  revalidateAttentionPaths();
  redirect(withFeedbackParam(CUSTOMERS_LIST_PATH, "customer-deleted"));
}

export async function deleteProperty(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(deletePropertySchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { propertyId, customerId } = parsed.data;

  if (!(await findCustomerProperty(propertyId, customerId))) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyNotFound);
  }
  const jobsCount = await prisma.job.count({ where: { propertyId } });
  if (jobsCount > 0) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyHasJobs);
  }
  const plansCount = await prisma.servicePlan.count({ where: { propertyId } });
  if (plansCount > 0) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyHasPlans);
  }

  await prisma.property.delete({ where: { id: propertyId } });

  revalidatePath(INVOICES_PATH);
  revalidateAttentionPaths(customerId);
  redirect(customerDetailFeedbackPath(customerId, "property-deleted"));
}

export async function updateProperty(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(updatePropertySchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { data } = parsed;

  const currentProperty = await findCustomerProperty(data.propertyId, data.customerId);
  if (!currentProperty) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyNotFound);
  }
  const normalizedAddress = await normalizePropertyAddress(data.address);

  await prisma.property.update({
    where: { id: data.propertyId },
    data: {
      name: data.name || null,
      address: normalizedAddress,
      poolType: data.poolType || null,
      waterType: null,
      sanitizerType: data.sanitizerType || null,
      filterType: data.filterType || null,
      poolVolumeGallons: data.poolVolumeGallons,
      hasSpa: data.hasSpa,
      accessInfo: data.accessLocationNotes || null,
      locationNotes: null,
      ...data.servicePaymentInfo,
      ...data.poolEquipment,
      ...geocodeResetFor(currentProperty.address, normalizedAddress),
    },
  });

  revalidatePath(INVOICES_PATH);
  revalidateAttentionPaths(data.customerId);
  redirect(customerDetailFeedbackPath(data.customerId, "property-saved"));
}

export async function createJob(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(createJobSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { data } = parsed;
  const { customerId } = data;

  if (!(await findCustomerProperty(data.propertyId, customerId))) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyNotFound);
  }

  const scheduledDate = combineDateAndTime(data.scheduledDate, data.scheduledTime);
  if (Number.isNaN(scheduledDate.getTime())) {
    return failure(CUSTOMER_DETAIL_ERRORS.invalidInput, {
      scheduledDate: CUSTOMER_DETAIL_ERRORS.dateInvalid,
    });
  }
  const timeParts = getBusinessTimeParts(scheduledDate);
  const sortOrder =
    (timeParts?.hour ?? 0) * MINUTES_PER_HOUR + (timeParts?.minute ?? 0);
  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();
  const resolvedServiceTierId =
    data.serviceTierId || (await getDefaultServiceTierId());
  const checklist = await getServiceTierChecklist(resolvedServiceTierId);

  const job = await prisma.job.create({
    data: {
      customerId,
      propertyId: data.propertyId,
      technicianId: data.technicianId || null,
      scheduledDate,
      sortOrder,
      status: scheduledDate > endOfToday ? "SCHEDULED" : "PENDING",
      type: data.type,
      priority: data.priority,
      serviceTierId: resolvedServiceTierId,
      serviceType: data.serviceType,
      estimatedDurationMinutes: data.estimatedDuration,
      checklist,
      notes: data.notes || null,
    },
    include: { customer: true, property: true },
  });

  await queueJobScheduledNotifications(job);

  revalidatePath(customerDetailPath(customerId));
  redirect(customerDetailFeedbackPath(customerId, "job-created"));
}

export async function createServicePlan(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(createServicePlanSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { data } = parsed;
  const { customerId } = data;

  if (!(await findCustomerProperty(data.propertyId, customerId))) {
    return failure(CUSTOMER_DETAIL_ERRORS.propertyNotFound);
  }

  const selectedPlan =
    getGlobalRecurringPlan(data.planTemplate) ?? GLOBAL_RECURRING_PLAN_OPTIONS[0];
  const nextRunAt = resolveGlobalPlanStartDate(
    data.nextDate,
    selectedPlan.value,
    DEFAULT_GLOBAL_PLAN_TIME
  );
  if (Number.isNaN(nextRunAt.getTime())) {
    return failure(CUSTOMER_DETAIL_ERRORS.invalidInput, {
      nextDate: CUSTOMER_DETAIL_ERRORS.dateInvalid,
    });
  }

  const resolvedPlanTierId =
    data.serviceTierId ||
    (await getServiceTierIdByName(STANDARD_TIER_NAME, { activeOnly: true })) ||
    (await getServiceTierIdByName(STANDARD_TIER_NAME)) ||
    (await getDefaultServiceTierId());

  const createdPlan = await prisma.servicePlan.create({
    data: {
      customerId,
      propertyId: data.propertyId,
      technicianId: data.technicianId || null,
      name: selectedPlan.name,
      frequency: "WEEKLY",
      serviceTierId: resolvedPlanTierId,
      serviceType: "WEEKLY_CLEANING",
      priority: "NORMAL",
      nextRunAt,
      preferredTime: null,
      estimatedDurationMinutes: data.estimatedDuration,
      checklist: await getServiceTierChecklist(resolvedPlanTierId),
      notes: data.notes || null,
    },
    select: { id: true },
  });

  await materializePlanAndNotify(createdPlan.id, customerId);

  revalidatePlanViews(customerId);
  redirect(customerDetailFeedbackPath(customerId, "plan-created"));
}

export async function toggleServicePlan(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(toggleServicePlanSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { planId, customerId, isActive } = parsed.data;

  const plan = await findCustomerPlan(planId, customerId);
  if (!plan) {
    return failure(CUSTOMER_DETAIL_ERRORS.planNotFound);
  }

  await prisma.servicePlan.update({
    where: { id: planId },
    data: { isActive },
  });

  const now = new Date();
  if (!isActive) {
    await deleteUpcomingPlanJobs(prisma, planId, now);
  } else if ((await countUpcomingPlanJobs(prisma, planId, now)) === 0) {
    await materializePlanAndNotify(planId, customerId);
  }

  revalidatePlanViews(customerId);
  return ACTION_SUCCESS;
}

export async function deleteServicePlan(
  _state: ActionState,
  formData: FormData
): Promise<ActionResult> {
  await requireRole("ADMIN");

  const parsed = parseFormData(deleteServicePlanSchema, formData);
  if (!parsed.success) {
    return parsed.result;
  }
  const { planId, customerId } = parsed.data;

  const plan = await findCustomerPlan(planId, customerId);
  if (!plan) {
    return failure(CUSTOMER_DETAIL_ERRORS.planNotFound);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await deleteUpcomingPlanJobs(tx, planId, now);
    await tx.servicePlan.delete({ where: { id: planId } });
  });

  revalidatePlanViews(customerId);
  redirect(customerDetailPath(customerId));
}

export async function deleteCustomerFormAction(formData: FormData): Promise<void> {
  redirectOnFailure(await deleteCustomer(null, formData), formData);
}

export async function deletePropertyFormAction(formData: FormData): Promise<void> {
  redirectOnFailure(await deleteProperty(null, formData), formData);
}

export async function updatePropertyFormAction(formData: FormData): Promise<void> {
  redirectOnFailure(await updateProperty(null, formData), formData);
}

export async function toggleServicePlanFormAction(formData: FormData): Promise<void> {
  redirectOnFailure(await toggleServicePlan(null, formData), formData);
}

export async function deleteServicePlanFormAction(formData: FormData): Promise<void> {
  redirectOnFailure(await deleteServicePlan(null, formData), formData);
}
