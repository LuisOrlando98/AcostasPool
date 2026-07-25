import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import AppShell from "@/components/layout/AppShell";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import ActionFeedbackToast from "@/components/ui/ActionFeedbackToast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import AddressAutocompleteSingle from "@/components/ui/AddressAutocompleteSingle";
import AdminCustomerProperties from "@/components/customers/AdminCustomerProperties";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import CustomerInvoicesTable from "@/components/customers/CustomerInvoicesTable";
import CustomerJobsTable from "@/components/customers/CustomerJobsTable";
import CustomerPlansTable from "@/components/customers/CustomerPlansTable";
import CustomerRepositoryExplorer from "@/components/customers/CustomerRepositoryExplorer";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { addPlanFrequency, combineDateAndTime } from "@/lib/jobs/scheduling";
import { serviceTypeOptions } from "@/lib/jobs/templates";
import {
  GLOBAL_RECURRING_PLAN_OPTIONS,
  DEFAULT_GLOBAL_PLAN_TIME,
  getGlobalRecurringPlan,
  resolveGlobalPlanStartDate,
} from "@/lib/jobs/recurring-plan-templates";
import {
  getDefaultServiceTierId,
  getServiceTierIdByName,
  getServiceTierChecklist,
  getServiceTiers,
} from "@/lib/service-tiers";
import { getRouteDayRange, queueTechDigestItem } from "@/lib/notifications/techDigest";
import { createNotification } from "@/lib/notifications/create";
import { formatCustomerName } from "@/lib/customers/format";
import { sendCustomerInvite } from "@/lib/customers/invite";
import { formatUsPhone, normalizeUsPhone } from "@/lib/phones";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { normalizeEmail } from "@/lib/auth/email";
import { logAuditEvent } from "@/lib/audit/log";
import { normalizePropertyAddress } from "@/lib/routing/address";
import {
  parseServicePaymentInfoInput,
  SERVICE_PAYMENT_TYPE_VALUES,
} from "@/lib/customers/service-payment-info";
import {
  normalizePaymentMethod,
  PAYMENT_METHOD_VALUES,
} from "@/lib/customers/financial-info";
import {
  parsePoolConditionInput,
  readPoolCondition,
} from "@/lib/customers/pool-condition";
import {
  startOfBusinessDay,
  endOfBusinessDay,
  formatBusinessDateInput,
  formatInBusinessTimeZone,
  getBusinessTimeParts,
} from "@/lib/timezone";
import { withFeedbackParam } from "@/lib/ui/action-feedback";
import { getCompanySignatureUrl } from "@/lib/site-settings";
import { sendContractReadyEmail } from "@/lib/contracts/notify";
import {
  buildSnapshotFields,
  customerLocale,
  loadCustomerForContract,
  renderAndStoreContractPdf,
  startOfCurrentPeriodMonth,
  storeSignatureDataUrl,
} from "@/lib/contracts/service";
import ContractInPersonSignForm from "@/components/contracts/ContractInPersonSignForm";

function customerDetailFeedbackPath(customerId: string, feedback: string) {
  return withFeedbackParam(`/admin/customers/${customerId}`, feedback);
}

function customerDetailErrorPath(customerId: string, feedback: string, errorMessage: string) {
  const base = withFeedbackParam(`/admin/customers/${customerId}`, feedback);
  const [pathname, queryString = ""] = base.split("?", 2);
  const params = new URLSearchParams(queryString);
  params.set("contractError", errorMessage);
  return `${pathname}?${params.toString()}`;
}

async function materializeServicePlanJob(
  planId: string,
  options?: {
    scheduledDate?: Date;
    advancePlan?: boolean;
  }
) {
  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId },
    include: { customer: true, property: true },
  });

  if (!plan || !plan.isActive) {
    return null;
  }

  let scheduledDate = options?.scheduledDate ?? plan.nextRunAt;
  if (!options?.scheduledDate) {
    const todayStart = startOfBusinessDay(new Date()) ?? new Date();
    while (scheduledDate < todayStart) {
      scheduledDate = addPlanFrequency(scheduledDate, plan.frequency);
    }
  }
  if (Number.isNaN(scheduledDate.getTime())) {
    return null;
  }

  const existingJob = await prisma.job.findFirst({
    where: {
      planId: plan.id,
      scheduledDate,
    },
    select: { id: true },
  });
  if (existingJob) {
    return null;
  }

  const timeParts = getBusinessTimeParts(scheduledDate);
  const sortOrder = (timeParts?.hour ?? 0) * 60 + (timeParts?.minute ?? 0);
  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();
  const status = scheduledDate > endOfToday ? "SCHEDULED" : "PENDING";
  const planTierId = plan.serviceTierId || (await getDefaultServiceTierId());
  const planChecklist = await getServiceTierChecklist(planTierId);

  const job = await prisma.job.create({
    data: {
      customerId: plan.customerId,
      propertyId: plan.propertyId,
      technicianId: plan.technicianId,
      scheduledDate,
      sortOrder,
      status,
      type: "ROUTINE",
      priority: plan.priority,
      serviceTierId: planTierId,
      serviceType: plan.serviceType,
      estimatedDurationMinutes: plan.estimatedDurationMinutes,
      checklist: planChecklist,
      planId: plan.id,
    },
    include: { customer: true, property: true },
  });

  if (options?.advancePlan) {
    await prisma.servicePlan.update({
      where: { id: plan.id },
      data: { nextRunAt: addPlanFrequency(scheduledDate, plan.frequency) },
    });
  }

  if (job.technicianId) {
    const { start, end } = getRouteDayRange(job.scheduledDate);
    const existingCount = await prisma.job.count({
      where: {
        technicianId: job.technicianId,
        scheduledDate: { gte: start, lte: end },
        NOT: { id: job.id },
      },
    });
    await queueTechDigestItem({
      technicianId: job.technicianId,
      jobId: job.id,
      routeDate: job.scheduledDate,
      changeType: existingCount === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED",
      payload: {
        scheduledDate: job.scheduledDate.toISOString(),
        customerName: formatCustomerName(job.customer),
        address: job.property.address,
      },
    });
  }

  await createNotification({
    customerId: plan.customerId,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    payload: {
      jobId: job.id,
      technicianId: job.technicianId,
      scheduledDate: job.scheduledDate.toISOString(),
    },
  });

  return job;
}

async function createProperty(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const poolType = String(formData.get("poolType") ?? "").trim();
  const volume = String(formData.get("poolVolumeGallons") ?? "").trim();
  const hasSpa = String(formData.get("hasSpa") ?? "no") === "yes";
  const sanitizerType = String(formData.get("sanitizerType") ?? "").trim();
  const filterType = String(formData.get("filterType") ?? "").trim();
  const accessLocationNotes = String(
    formData.get("accessLocationNotes") ?? ""
  ).trim();
  const servicePaymentInfo = parseServicePaymentInfoInput({
    serviceStartDate: String(formData.get("serviceStartDate") ?? ""),
    paymentDay: String(formData.get("paymentDay") ?? ""),
    servicePrice: String(formData.get("servicePrice") ?? ""),
    paymentType: String(formData.get("paymentType") ?? ""),
    paymentNotes: String(formData.get("paymentNotes") ?? ""),
  });

  if (
    !customerId ||
    !address ||
    !accessLocationNotes ||
    !servicePaymentInfo
  ) {
    return;
  }
  const normalizedAddress = await normalizePropertyAddress(address);

  await prisma.property.create({
    data: {
      customerId,
      name: name || null,
      address: normalizedAddress,
      poolType: poolType || null,
      waterType: null,
      sanitizerType: sanitizerType || null,
      filterType: filterType || null,
      poolVolumeGallons: volume ? Number(volume) : null,
      hasSpa,
      accessInfo: accessLocationNotes || null,
      locationNotes: null,
      serviceStartDate: servicePaymentInfo.serviceStartDate,
      paymentDay: servicePaymentInfo.paymentDay,
      servicePrice: servicePaymentInfo.servicePrice,
      paymentType: servicePaymentInfo.paymentType,
      paymentNotes: servicePaymentInfo.paymentNotes,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/invoices");
  redirect(customerDetailFeedbackPath(customerId, "property-created"));
}
async function updateCustomer(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const nombre = String(formData.get("nombre") ?? "").trim();
  const apellidos = String(formData.get("apellidos") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();
  const telefonoSecundarioRaw = String(
    formData.get("telefonoSecundario") ?? ""
  ).trim();
  const estadoCuenta = String(formData.get("estadoCuenta") ?? "ACTIVE");
  const idiomaPreferencia = String(formData.get("idiomaPreferencia") ?? "EN");
  const tipoCliente = String(formData.get("tipoCliente") ?? "RESIDENTIAL");
  const allowWeekendBooking = formData.get("allowWeekendBooking") === "on";
  const direccionLinea1 = String(
    formData.get("direccionLinea1") ?? ""
  ).trim();
  const direccionLinea2 = String(
    formData.get("direccionLinea2") ?? ""
  ).trim();
  const ciudad = String(formData.get("ciudad") ?? "").trim();
  const estadoProvincia = String(
    formData.get("estadoProvincia") ?? ""
  ).trim();
  const codigoPostal = String(formData.get("codigoPostal") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim();
  const nextAccountStatus = estadoCuenta === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  const telefono = telefonoRaw ? normalizeUsPhone(telefonoRaw) ?? "" : "";
  const telefonoSecundario = telefonoSecundarioRaw
    ? normalizeUsPhone(telefonoSecundarioRaw)
    : null;

  if (!customerId || !nombre) {
    return;
  }
  if (telefonoRaw && !telefono) {
    return;
  }
  if (telefonoSecundarioRaw && !telefonoSecundario) {
    return;
  }

  const hasAddress =
    direccionLinea1 || ciudad || estadoProvincia || codigoPostal;
  if (hasAddress && (!direccionLinea1 || !ciudad || !estadoProvincia || !codigoPostal)) {
    return;
  }

  const existingCustomer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      userId: true,
      email: true,
      estadoCuenta: true,
      user: {
        select: { email: true },
      },
    },
  });
  if (!existingCustomer) {
    return;
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
      return;
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
      nombre,
      apellidos,
      email: resolvedEmail,
      telefono,
      telefonoSecundario,
      estadoCuenta: nextAccountStatus,
      idiomaPreferencia: idiomaPreferencia === "EN" ? "EN" : "ES",
      tipoCliente: tipoCliente === "COMMERCIAL" ? "COMMERCIAL" : "RESIDENTIAL",
      allowWeekendBooking,
      pauseServicesFrom:
        nextAccountStatus === "INACTIVE"
          ? startOfBusinessDay(new Date()) ?? new Date()
          : existingCustomer.estadoCuenta === "INACTIVE"
            ? null
            : undefined,
      direccionLinea1: direccionLinea1 || null,
      direccionLinea2: direccionLinea2 || null,
      ciudad: ciudad || null,
      estadoProvincia: estadoProvincia || null,
      codigoPostal: codigoPostal || null,
      notas: notas || null,
    },
  });

  if (customer.userId) {
    const fullName = formatCustomerName(customer);
    await prisma.user.update({
      where: { id: customer.userId },
      data: {
        email: resolvedEmail,
        fullName,
        locale: customer.idiomaPreferencia,
        isActive: nextAccountStatus === "ACTIVE",
      },
    });
  }

  if (nextAccountStatus === "INACTIVE") {
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

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/invoices");
  redirect(customerDetailFeedbackPath(customerId, "customer-saved"));
}

async function updateCustomerFinancials(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) {
    return;
  }

  const contractedServiceTierId = String(
    formData.get("contractedServiceTierId") ?? ""
  ).trim();
  const paymentMethodRaw = String(formData.get("paymentMethod") ?? "").trim();
  const paymentMethod = paymentMethodRaw
    ? normalizePaymentMethod(paymentMethodRaw)
    : null;
  if (paymentMethodRaw && !paymentMethod) {
    return;
  }

  const primaryPropertyId = String(
    formData.get("primaryPropertyId") ?? ""
  ).trim();
  const servicePaymentInfo = parseServicePaymentInfoInput({
    serviceStartDate: String(formData.get("serviceStartDate") ?? ""),
    paymentDay: String(formData.get("paymentDay") ?? ""),
    servicePrice: String(formData.get("servicePrice") ?? ""),
    paymentType: String(formData.get("paymentType") ?? ""),
    paymentNotes: String(formData.get("paymentNotes") ?? ""),
  });
  if (!servicePaymentInfo) {
    return;
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      contractedServiceTierId: contractedServiceTierId || null,
      paymentMethod,
    },
  });

  if (primaryPropertyId) {
    await prisma.property.update({
      where: { id: primaryPropertyId },
      data: {
        serviceStartDate: servicePaymentInfo.serviceStartDate,
        paymentDay: servicePaymentInfo.paymentDay,
        servicePrice: servicePaymentInfo.servicePrice,
        paymentType: servicePaymentInfo.paymentType,
        paymentNotes: servicePaymentInfo.paymentNotes,
      },
    });
  }

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/invoices");
  redirect(customerDetailFeedbackPath(customerId, "customer-financials-saved"));
}

async function generateServiceContract(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) {
    return;
  }

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

    // A draft hasn't been shown to the client yet, so regenerating it just
    // refreshes the same record instead of piling up duplicate drafts for
    // the same period. Once sent/signed it's a delivered record, so a new
    // generation for that period starts a fresh row instead of mutating it.
    //
    // Must match the exact same "latest" row the admin page displays
    // (orderBy periodMonth desc, createdAt desc) - an unordered findFirst
    // could silently update a different, older duplicate draft than the
    // one actually shown on screen, making the refresh look like a no-op.
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("service-contract: failed to generate contract", customerId, error);
    redirectPath = customerDetailErrorPath(customerId, "contract-generate-failed", message);
  }

  revalidatePath(`/admin/customers/${customerId}`);
  redirect(redirectPath);
}

async function sendServiceContract(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const contractId = String(formData.get("contractId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  if (!contractId || !customerId) {
    return;
  }

  let redirectPath: string;
  try {
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

    try {
      const result = await sendContractReadyEmail(customerId);
      if (!result.ok) {
        console.error("Contract email failed:", result.error);
      }
    } catch (error) {
      console.error("Contract email failed:", error);
    }

    redirectPath = customerDetailFeedbackPath(customerId, "contract-sent");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("service-contract: failed to send contract", contractId, error);
    redirectPath = customerDetailErrorPath(customerId, "contract-send-failed", message);
  }

  revalidatePath(`/admin/customers/${customerId}`);
  redirect(redirectPath);
}

async function signServiceContractInPerson(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN");

  const contractId = String(formData.get("contractId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");
  const signatureDataUrl = String(formData.get("signatureDataUrl") ?? "");
  if (!contractId || !customerId || !signatureDataUrl.startsWith("data:image/png")) {
    return;
  }

  let redirectPath: string;
  try {
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("service-contract: failed to sign contract in person", contractId, error);
    redirectPath = customerDetailErrorPath(customerId, "contract-sign-failed", message);
  }

  revalidatePath(`/admin/customers/${customerId}`);
  redirect(redirectPath);
}

async function inviteCustomer(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  if (!customerId) {
    return;
  }

  try {
    const result = await sendCustomerInvite(customerId);
    if (!result.ok) {
      console.error("Invite failed:", result.error);
    }
  } catch (error) {
    console.error("Invite failed:", error);
  }

  revalidatePath(`/admin/customers/${customerId}`);
}

async function deleteCustomer(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN");

  const customerId = String(formData.get("customerId") ?? "");
  const confirmDelete = String(formData.get("confirmDelete") ?? "no");
  const typedConfirmation = String(
    formData.get("typedConfirmation") ?? ""
  )
    .trim()
    .toLowerCase();

  if (
    !customerId ||
    confirmDelete !== "yes" ||
    !["eliminar", "delete"].includes(typedConfirmation)
  ) {
    return;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      userId: true,
      email: true,
      nombre: true,
      apellidos: true,
    },
  });

  if (!customer) {
    redirect("/admin/customers");
  }

  const jobIds = await prisma.job.findMany({
    where: { customerId },
    select: { id: true },
  });
  const scopedJobIds = jobIds.map((job) => job.id);

  await prisma.$transaction(async (tx) => {
    if (scopedJobIds.length > 0) {
      await tx.jobPhoto.deleteMany({
        where: { jobId: { in: scopedJobIds } },
      });
      await tx.techDigestItem.deleteMany({
        where: { jobId: { in: scopedJobIds } },
      });
      await tx.emailLog.deleteMany({
        where: { jobId: { in: scopedJobIds } },
      });
    }

    await tx.invoice.deleteMany({
      where: { customerId },
    });
    await tx.notification.deleteMany({
      where: { customerId },
    });
    await tx.customerDocument.deleteMany({
      where: { customerId },
    });
    await tx.emailLog.deleteMany({
      where: { customerId },
    });
    await tx.job.deleteMany({
      where: { customerId },
    });
    await tx.servicePlan.deleteMany({
      where: { customerId },
    });
    await tx.property.deleteMany({
      where: { customerId },
    });
    await tx.customer.delete({
      where: { id: customerId },
    });

    if (customer.userId) {
      await tx.notification.updateMany({
        where: { actorUserId: customer.userId },
        data: { actorUserId: null },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: customer.userId },
      });
      await tx.notificationPreference.deleteMany({
        where: { userId: customer.userId },
      });
      await tx.auditLog.deleteMany({
        where: { userId: customer.userId },
      });
      await tx.user.delete({
        where: { id: customer.userId },
      });
    }
  });

  await logAuditEvent({
    userId: session.sub,
    action: "CUSTOMER_DELETED",
    entity: "Customer",
    entityId: customer.id,
    metadata: {
      email: customer.email,
      linkedUserId: customer.userId,
      fullName: formatCustomerName(customer),
      removedJobs: scopedJobIds.length,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/reports");
  redirect(withFeedbackParam("/admin/customers", "customer-deleted"));
}

async function deleteProperty(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const propertyId = String(formData.get("propertyId"));
  const customerId = String(formData.get("customerId"));
  const confirmDelete = String(formData.get("confirmDelete") ?? "no");

  if (!propertyId || !customerId || confirmDelete !== "yes") {
    return;
  }

  const jobsCount = await prisma.job.count({
    where: { propertyId },
  });

  if (jobsCount > 0) {
    return;
  }

  await prisma.property.delete({
    where: { id: propertyId },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/invoices");
  redirect(customerDetailFeedbackPath(customerId, "property-deleted"));
}

async function updateProperty(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const propertyId = String(formData.get("propertyId"));
  const customerId = String(formData.get("customerId"));
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const poolType = String(formData.get("poolType") ?? "").trim();
  const volume = String(formData.get("poolVolumeGallons") ?? "").trim();
  const hasSpa = String(formData.get("hasSpa") ?? "no") === "yes";
  const sanitizerType = String(formData.get("sanitizerType") ?? "").trim();
  const filterType = String(formData.get("filterType") ?? "").trim();
  const accessLocationNotes = String(
    formData.get("accessLocationNotes") ?? ""
  ).trim();
  const servicePaymentInfo = parseServicePaymentInfoInput({
    serviceStartDate: String(formData.get("serviceStartDate") ?? ""),
    paymentDay: String(formData.get("paymentDay") ?? ""),
    servicePrice: String(formData.get("servicePrice") ?? ""),
    paymentType: String(formData.get("paymentType") ?? ""),
    paymentNotes: String(formData.get("paymentNotes") ?? ""),
  });
  const filterBrand = String(formData.get("filterBrand") ?? "").trim();
  const filterModel = String(formData.get("filterModel") ?? "").trim();
  const pumpBrand = String(formData.get("pumpBrand") ?? "").trim();
  const pumpHorsepower = String(formData.get("pumpHorsepower") ?? "").trim();
  const poolConditionNotes = String(
    formData.get("poolConditionNotes") ?? ""
  ).trim();
  const poolCondition = parsePoolConditionInput((key) =>
    formData.get(key) ? String(formData.get(key)) : null
  );

  if (!propertyId || !customerId || !address || !servicePaymentInfo) {
    return;
  }
  const normalizedAddress = await normalizePropertyAddress(address);

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      name: name || null,
      address: normalizedAddress,
      poolType: poolType || null,
      waterType: null,
      sanitizerType: sanitizerType || null,
      filterType: filterType || null,
      poolVolumeGallons: volume ? Number(volume) : null,
      hasSpa,
      accessInfo: accessLocationNotes || null,
      locationNotes: null,
      serviceStartDate: servicePaymentInfo.serviceStartDate,
      paymentDay: servicePaymentInfo.paymentDay,
      servicePrice: servicePaymentInfo.servicePrice,
      paymentType: servicePaymentInfo.paymentType,
      paymentNotes: servicePaymentInfo.paymentNotes,
      filterBrand: filterBrand || null,
      filterModel: filterModel || null,
      pumpBrand: pumpBrand || null,
      pumpHorsepower: pumpHorsepower || null,
      poolCondition,
      poolConditionNotes: poolConditionNotes || null,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/invoices");
  redirect(customerDetailFeedbackPath(customerId, "property-saved"));
}

async function createJob(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const propertyId = String(formData.get("propertyId"));
  const technicianId = String(formData.get("technicianId") ?? "");
  const type = String(formData.get("type") ?? "ROUTINE");
  const priority = String(formData.get("priority") ?? "NORMAL");
  const serviceType = String(formData.get("serviceType") ?? "WEEKLY_CLEANING");
  const serviceTierId = String(formData.get("serviceTierId") ?? "").trim();
  const estimatedDurationRaw = String(
    formData.get("estimatedDuration") ?? ""
  );
  const notes = String(formData.get("notes") ?? "").trim();
  const scheduledDateRaw = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "09:00");

  if (!customerId || !propertyId || !scheduledDateRaw) {
    return;
  }
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { customerId: true },
  });
  if (!property || property.customerId !== customerId) {
    return;
  }

  const scheduledDate = combineDateAndTime(
    scheduledDateRaw,
    scheduledTime || "09:00"
  );
  const timeParts = getBusinessTimeParts(scheduledDate);
  const sortOrder = (timeParts?.hour ?? 0) * 60 + (timeParts?.minute ?? 0);
  const endOfToday = endOfBusinessDay(new Date()) ?? new Date();
  const status = scheduledDate > endOfToday ? "SCHEDULED" : "PENDING";
  const estimatedDurationMinutes = estimatedDurationRaw
    ? Number(estimatedDurationRaw)
    : null;
  const resolvedServiceTierId =
    serviceTierId || (await getDefaultServiceTierId());
  const checklist = await getServiceTierChecklist(resolvedServiceTierId);

  const job = await prisma.job.create({
    data: {
      customerId,
      propertyId,
      technicianId: technicianId || null,
      scheduledDate,
      sortOrder,
      status,
      type: type === "ON_DEMAND" ? "ON_DEMAND" : "ROUTINE",
      priority: priority === "URGENT" ? "URGENT" : "NORMAL",
      serviceTierId: resolvedServiceTierId,
      serviceType:
        serviceType === "FILTER_CHECK" ||
        serviceType === "CHEM_BALANCE" ||
        serviceType === "EQUIPMENT_CHECK"
          ? serviceType
          : "WEEKLY_CLEANING",
      estimatedDurationMinutes,
      checklist,
      notes: notes || null,
    },
    include: { customer: true, property: true },
  });

  if (job.technicianId) {
    const { start, end } = getRouteDayRange(job.scheduledDate);
    const existingCount = await prisma.job.count({
      where: {
        technicianId: job.technicianId,
        scheduledDate: { gte: start, lte: end },
        NOT: { id: job.id },
      },
    });
    await queueTechDigestItem({
      technicianId: job.technicianId,
      jobId: job.id,
      routeDate: job.scheduledDate,
      changeType: existingCount === 0 ? "ROUTE_ASSIGNED" : "JOB_ASSIGNED",
      payload: {
        scheduledDate: job.scheduledDate.toISOString(),
        customerName: formatCustomerName(job.customer),
        address: job.property.address,
      },
    });
  }

  await createNotification({
    customerId,
    recipientRole: "CUSTOMER",
    eventType: "SERVICE_SCHEDULED",
    severity: "INFO",
    payload: {
      jobId: job.id,
      technicianId: job.technicianId,
      scheduledDate: job.scheduledDate.toISOString(),
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  redirect(customerDetailFeedbackPath(customerId, "job-created"));
}

async function createServicePlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const propertyId = String(formData.get("propertyId"));
  const planTemplate = String(formData.get("planTemplate") ?? "MONDAY");
  const technicianId = String(formData.get("technicianId") ?? "");
  const serviceTierId = String(formData.get("serviceTierId") ?? "").trim();
  const nextDateRaw = String(formData.get("nextDate") ?? "");
  const estimatedDurationRaw = String(
    formData.get("estimatedDuration") ?? ""
  );
  const notes = String(formData.get("notes") ?? "").trim();

  if (!customerId || !propertyId || !technicianId || !nextDateRaw) {
    return;
  }
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { customerId: true },
  });
  if (!property || property.customerId !== customerId) {
    return;
  }

  const selectedPlan =
    getGlobalRecurringPlan(planTemplate) ?? GLOBAL_RECURRING_PLAN_OPTIONS[0];
  const nextRunAt = resolveGlobalPlanStartDate(
    nextDateRaw,
    selectedPlan.value,
    DEFAULT_GLOBAL_PLAN_TIME
  );
  if (Number.isNaN(nextRunAt.getTime())) {
    return;
  }
  const estimatedDurationMinutes = estimatedDurationRaw
    ? Number(estimatedDurationRaw)
    : null;
  if (
    estimatedDurationMinutes !== null &&
    (!Number.isFinite(estimatedDurationMinutes) || estimatedDurationMinutes < 0)
  ) {
    return;
  }

  const resolvedPlanTierId =
    serviceTierId ||
    (await getServiceTierIdByName("Standard", { activeOnly: true })) ||
    (await getServiceTierIdByName("Standard")) ||
    (await getDefaultServiceTierId());

  const createdPlan = await prisma.servicePlan.create({
    data: {
      customerId,
      propertyId,
      technicianId: technicianId || null,
      name: selectedPlan.name,
      frequency: "WEEKLY",
      serviceTierId: resolvedPlanTierId,
      serviceType: "WEEKLY_CLEANING",
      priority: "NORMAL",
      nextRunAt,
      preferredTime: null,
      estimatedDurationMinutes,
      checklist: await getServiceTierChecklist(resolvedPlanTierId),
      notes: notes || null,
    },
    select: { id: true },
  });

  await materializeServicePlanJob(createdPlan.id, { advancePlan: true });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers/assignments");
  revalidatePath("/admin/routes");
  redirect(customerDetailFeedbackPath(customerId, "plan-created"));
}

async function toggleServicePlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const planId = String(formData.get("planId"));
  const customerId = String(formData.get("customerId"));
  const isActive = String(formData.get("isActive") ?? "false") === "true";

  if (!planId || !customerId) {
    return;
  }

  await prisma.servicePlan.update({
    where: { id: planId },
    data: { isActive },
  });

  const todayStart = startOfBusinessDay(new Date()) ?? new Date();
  if (!isActive) {
    const futureJobs = await prisma.job.findMany({
      where: {
        planId,
        scheduledDate: { gte: todayStart },
        status: { in: ["SCHEDULED", "PENDING", "ON_THE_WAY"] },
      },
      select: { id: true },
    });
    const futureJobIds = futureJobs.map((job) => job.id);
    if (futureJobIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.jobPhoto.deleteMany({
          where: { jobId: { in: futureJobIds } },
        });
        await tx.techDigestItem.deleteMany({
          where: { jobId: { in: futureJobIds } },
        });
        await tx.emailLog.deleteMany({
          where: { jobId: { in: futureJobIds } },
        });
        await tx.invoice.updateMany({
          where: { jobId: { in: futureJobIds } },
          data: { jobId: null },
        });
        await tx.job.deleteMany({
          where: { id: { in: futureJobIds } },
        });
      });
    }
  } else {
    const futureJobCount = await prisma.job.count({
      where: {
        planId,
        scheduledDate: { gte: todayStart },
        status: { in: ["SCHEDULED", "PENDING", "ON_THE_WAY"] },
      },
    });
    if (futureJobCount === 0) {
      await materializeServicePlanJob(planId, { advancePlan: true });
    }
  }

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers/assignments");
  revalidatePath("/admin/routes");
}

async function deleteServicePlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const planId = String(formData.get("planId") ?? "");
  const customerId = String(formData.get("customerId") ?? "");

  if (!planId || !customerId) {
    return;
  }

  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId },
    select: { id: true, customerId: true },
  });

  if (!plan || plan.customerId !== customerId) {
    return;
  }

  const todayStart = startOfBusinessDay(new Date()) ?? new Date();
  const futureJobs = await prisma.job.findMany({
    where: {
      planId,
      scheduledDate: { gte: todayStart },
      status: { in: ["SCHEDULED", "PENDING", "ON_THE_WAY"] },
    },
    select: { id: true },
  });
  const futureJobIds = futureJobs.map((job) => job.id);

  await prisma.$transaction(async (tx) => {
    if (futureJobIds.length > 0) {
      await tx.jobPhoto.deleteMany({
        where: { jobId: { in: futureJobIds } },
      });
      await tx.techDigestItem.deleteMany({
        where: { jobId: { in: futureJobIds } },
      });
      await tx.emailLog.deleteMany({
        where: { jobId: { in: futureJobIds } },
      });
      await tx.invoice.updateMany({
        where: { jobId: { in: futureJobIds } },
        data: { jobId: null },
      });
      await tx.job.deleteMany({
        where: { id: { in: futureJobIds } },
      });
    }

    await tx.servicePlan.delete({
      where: { id: planId },
    });
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers/assignments");
  revalidatePath("/admin/routes");
  redirect(`/admin/customers/${customerId}`);
}

async function createJobFromPlan(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const planId = String(formData.get("planId"));
  const scheduledDateRaw = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");

  if (!planId) {
    return;
  }

  const plan = await prisma.servicePlan.findUnique({
    where: { id: planId },
  });

  if (!plan || !plan.isActive) {
    return;
  }

  const scheduledDate = scheduledDateRaw
    ? combineDateAndTime(
        scheduledDateRaw,
        scheduledTime || plan.preferredTime || "09:00"
      )
    : plan.nextRunAt;
  await materializeServicePlanJob(plan.id, {
    scheduledDate,
    advancePlan: true,
  });

  revalidatePath(`/admin/customers/${plan.customerId}`);
  revalidatePath("/admin/routes");
  redirect(customerDetailFeedbackPath(plan.customerId, "job-created"));
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const customerId = resolvedParams?.id;
  const feedbackValue = resolvedSearchParams?.feedback;
  const feedback = Array.isArray(feedbackValue) ? feedbackValue[0] : feedbackValue;
  const contractErrorValue = resolvedSearchParams?.contractError;
  const contractError = Array.isArray(contractErrorValue)
    ? contractErrorValue[0]
    : contractErrorValue;
  if (!customerId) {
    return (
      <AppShell
        title={t("admin.customers.detail.notFoundTitle")}
        subtitle={t("admin.customers.detail.notFoundSubtitle")}
        role="ADMIN"
      >
        <Link href="/admin/customers" className="text-sm text-slate-600">
          {t("admin.customers.detail.actions.back")}
        </Link>
      </AppShell>
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      user: {
        select: {
          id: true,
          createdAt: true,
          passwordResetTokens: {
            where: { purpose: "INVITE" },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              createdAt: true,
              expiresAt: true,
              usedAt: true,
            },
          },
        },
      },
      properties: true,
      contractedServiceTier: { select: { id: true, name: true } },
      serviceContracts: { orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }] },
      jobs: {
        orderBy: { scheduledDate: "desc" },
        include: {
          property: true,
          technician: { include: { user: true } },
          photos: true,
        },
      },
      servicePlans: {
        orderBy: { nextRunAt: "asc" },
        include: {
          property: true,
          technician: { include: { user: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          job: {
            include: {
              technician: { include: { user: true } },
            },
          },
        },
      },
    },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("admin.customers.detail.notFoundTitle")}
        subtitle={t("admin.customers.detail.notFoundMessage")}
        role="ADMIN"
      >
        <Link href="/admin/customers" className="text-sm text-slate-600">
          {t("admin.customers.detail.actions.back")}
        </Link>
      </AppShell>
    );
  }

  const customerName = formatCustomerName(customer);
  const now = new Date();
  const inviteTokens = customer.user?.passwordResetTokens ?? [];
  const hasPendingInvite = inviteTokens.some(
    (token) => !token.usedAt && token.expiresAt > now
  );
  const hasCompletedInvite = inviteTokens.some((token) => Boolean(token.usedAt));
  const portalStatusLabel = !customer.user
    ? t("admin.customers.detail.labels.portalNotInvited")
    : hasPendingInvite
    ? t("admin.customers.detail.labels.portalInvitePending")
    : hasCompletedInvite
    ? t("admin.customers.detail.labels.portalActive")
    : t("admin.customers.detail.labels.portalLinked");
  const portalStatusClass = !customer.user
    ? "border-slate-200 bg-slate-100 text-slate-700"
    : hasPendingInvite
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : hasCompletedInvite
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-indigo-200 bg-indigo-50 text-indigo-700";
  const technicians = await prisma.technician.findMany({
    include: { user: true },
    orderBy: { user: { fullName: "asc" } },
  });
  const serviceTiers = await getServiceTiers();
  const activeServiceTiers = serviceTiers.filter((tier) => tier.isActive);
  const tierOptions =
    activeServiceTiers.length > 0 ? activeServiceTiers : serviceTiers;
  const recurringPlanTierOptions = [...tierOptions].sort((left, right) => {
    const leftIsStandard = left.name.trim().toLowerCase() === "standard";
    const rightIsStandard = right.name.trim().toLowerCase() === "standard";

    if (leftIsStandard === rightIsStandard) {
      return 0;
    }

    return leftIsStandard ? -1 : 1;
  });
  const recurringPlanDefaultTierId =
    recurringPlanTierOptions.find(
      (tier) => tier.name.trim().toLowerCase() === "standard"
    )?.id ?? recurringPlanTierOptions[0]?.id;
  const serviceTierMap = new Map(
    serviceTiers.map((tier) => [tier.id, tier.name])
  );

  const jobsRows = customer.jobs.map((job) => ({
    id: job.id,
    scheduledDate: job.scheduledDate.toISOString(),
    status: job.status,
    priority: job.priority,
    serviceType: job.serviceType,
    serviceTierName: job.serviceTierId
      ? serviceTierMap.get(job.serviceTierId) ?? null
      : null,
    type: job.type,
    propertyName: job.property.name ?? "",
    address: job.property.address,
    technicianName: job.technician?.user.fullName ?? "",
    photosCount: job.photos.length,
  }));
  const plansRows = customer.servicePlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    propertyAddress: plan.property.address,
    frequency: plan.frequency,
    serviceType: plan.serviceType,
    serviceTierName: plan.serviceTierId
      ? serviceTierMap.get(plan.serviceTierId) ?? null
      : null,
    priority: plan.priority,
    nextRunAt: plan.nextRunAt.toISOString(),
    preferredTime: plan.preferredTime,
    technicianName: plan.technician?.user.fullName ?? "",
    isActive: plan.isActive,
    notes: plan.notes,
    customerId: customer.id,
  }));
  const propertyRows = customer.properties.map((property) => ({
    id: property.id,
    name: property.name,
    address: property.address,
    poolType: property.poolType,
    sanitizerType: property.sanitizerType,
    poolVolumeGallons: property.poolVolumeGallons,
    filterType: property.filterType,
    hasSpa: property.hasSpa,
    accessLocationNotes:
      [property.accessInfo, property.locationNotes]
        .filter((value) => Boolean(value?.trim()))
        .join("\n\n") || null,
    serviceStartDate: property.serviceStartDate
      ? formatBusinessDateInput(property.serviceStartDate)
      : null,
    paymentDay: property.paymentDay,
    servicePrice:
      property.servicePrice !== null ? Number(property.servicePrice) : null,
    paymentType: property.paymentType,
    paymentNotes: property.paymentNotes,
    filterBrand: property.filterBrand,
    filterModel: property.filterModel,
    pumpBrand: property.pumpBrand,
    pumpHorsepower: property.pumpHorsepower,
    poolCondition: readPoolCondition(property.poolCondition),
    poolConditionNotes: property.poolConditionNotes,
  }));
  const primaryProperty = customer.properties[0] ?? null;
  const invoicesRows = customer.invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    theme: invoice.theme,
    total: Number(invoice.total),
    createdAt: invoice.createdAt.toISOString(),
    jobLabel: invoice.job
      ? `${formatInBusinessTimeZone(invoice.job.scheduledDate, locale, {
          dateStyle: "short",
        })} - ${invoice.job.technician?.user.fullName ?? t("admin.invoices.list.noTech")}`
      : null,
    pdfUrl: invoice.pdfUrl,
  }));
  const customerEmailLabel = customer.email || t("common.labels.notAvailable");
  const hasCustomerEmail = Boolean(customer.email?.trim());
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const latestContract = customer.serviceContracts[0] ?? null;
  const contractHistory = customer.serviceContracts.slice(1, 6);
  const contractPdfHref = (contractId: string) =>
    `/api/admin/customers/${customer.id}/contracts/${contractId}/pdf`;
  const contractStatusBadgeClass = (status: string) =>
    status === "SIGNED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "SENT"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <AppShell
      title={t("admin.customers.detail.title", { name: customerName })}
      subtitle={t("admin.customers.detail.subtitle")}
      role="ADMIN"
      wide
    >
      {feedback === "customer-saved" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.saved")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "customer-financials-saved" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.financialsSaved")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "contract-generated" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.contractGenerated")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "contract-sent" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.contractSent")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "contract-signed" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.contractSigned")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "contract-generate-failed" ? (
        <ActionFeedbackToast
          tone="error"
          message={t("admin.customers.feedback.contractGenerateFailed", {
            error: contractError || t("common.labels.notAvailable"),
          })}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "contract-send-failed" ? (
        <ActionFeedbackToast
          tone="error"
          message={t("admin.customers.feedback.contractSendFailed", {
            error: contractError || t("common.labels.notAvailable"),
          })}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "contract-sign-failed" ? (
        <ActionFeedbackToast
          tone="error"
          message={t("admin.customers.feedback.contractSignFailed", {
            error: contractError || t("common.labels.notAvailable"),
          })}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "property-created" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.propertyCreated")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "property-saved" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.propertySaved")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "property-deleted" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.propertyDeleted")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "job-created" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.jobCreated")}
          dismissLabel={t("common.actions.close")}
        />
      ) : feedback === "plan-created" ? (
        <ActionFeedbackToast
          message={t("admin.customers.feedback.planCreated")}
          dismissLabel={t("common.actions.close")}
        />
      ) : null}
      <input id="new-plan" type="checkbox" className="peer/plan hidden" />
      <input id="new-property" type="checkbox" className="peer/property hidden" />
      <input id="new-job" type="checkbox" className="peer/job hidden" />
      <section className="customers-scope customers-detail space-y-5 sm:space-y-6">
        <div className="customers-detail-hero overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.25),_transparent_45%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sky-100/70">
                  {t("admin.customers.detail.kicker")}
                </p>
                <h2 className="text-2xl font-semibold">{customerName}</h2>
                <p className="text-sm text-sky-100/80">{customerEmailLabel}</p>
                <p className="text-xs text-sky-100/60">
                  {formatUsPhone(customer.telefono) ||
                    t("admin.routes.labels.noPhone")}
                </p>
                <p className="mt-2 inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                  {portalStatusLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    customer.estadoCuenta === "ACTIVE"
                      ? "border-teal-300 bg-teal-500 text-white"
                      : "border-white/30 bg-white/10 text-white"
                  }`}
                >
                  {customer.estadoCuenta === "ACTIVE"
                    ? t("common.status.active")
                    : t("common.status.inactive")}
                </span>
                <label
                  htmlFor="new-property"
                  className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.customers.detail.actions.addProperty")}
                </label>
                <label
                  htmlFor="new-job"
                  className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.customers.detail.actions.scheduleJob")}
                </label>
                <label
                  htmlFor="new-plan"
                  className="cursor-pointer rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 transition hover:bg-white/20"
                >
                  {t("admin.customers.detail.actions.newPlan")}
                </label>
              </div>
            </div>
          </div>
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.cards.properties")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {customer.properties.length}
              </p>
              <p className="text-xs text-slate-500">
                {t("admin.customers.detail.cards.propertiesHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-700">
                {t("admin.customers.detail.cards.jobs")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {customer.jobs.length}
              </p>
              <p className="text-xs text-sky-700">
                {t("admin.customers.detail.cards.jobsHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-700">
                {t("admin.customers.detail.cards.plans")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">
                {customer.servicePlans.length}
              </p>
              <p className="text-xs text-indigo-700">
                {t("admin.customers.detail.cards.plansHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {t("admin.customers.detail.cards.invoices")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {customer.invoices.length}
              </p>
              <p className="text-xs text-slate-500">
                {t("admin.customers.detail.cards.invoicesHint")}
              </p>
            </div>
          </div>
        </div>

        <div className="customers-detail-grid grid gap-5 sm:gap-6 2xl:grid-cols-2">
          <div className="min-w-0">
            <CollapsibleSection
              className="h-full lg:min-h-[360px]"
              title={t("admin.customers.detail.sections.profileTitle")}
              subtitle={t("admin.customers.detail.sections.profileSubtitle")}
              headerExtra={
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${portalStatusClass}`}
                  >
                    {portalStatusLabel}
                  </span>
                  <label
                    htmlFor="edit-customer"
                    className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                  >
                    {t("common.actions.edit")}
                  </label>
                  <form action={inviteCustomer}>
                    <input type="hidden" name="customerId" value={customer.id} />
                    <button
                      disabled={!hasCustomerEmail}
                      title={
                        hasCustomerEmail
                          ? undefined
                          : t("admin.customers.detail.actions.inviteNeedsEmail")
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        hasCustomerEmail
                          ? "border-slate-200 text-slate-600 hover:border-slate-300"
                          : "border-slate-100 text-slate-300"
                      }`}
                    >
                      {t("admin.customers.detail.actions.sendInvite")}
                    </button>
                  </form>
                </div>
              }
            >
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.customers.detail.profileFields.name")}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{customerName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("common.labels.email")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">{customerEmailLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("common.labels.phone")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {formatUsPhone(customer.telefono) || t("admin.routes.labels.noPhone")}
                  </dd>
                </div>
                {customer.telefonoSecundario ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t("common.labels.phoneSecondary")}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-700">
                      {formatUsPhone(customer.telefonoSecundario)}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.customers.new.fields.type")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {customer.tipoCliente === "COMMERCIAL"
                      ? t("admin.customers.types.commercial")
                      : t("admin.customers.types.residential")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("common.labels.language")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {customer.idiomaPreferencia === "EN"
                      ? t("common.language.en")
                      : t("common.language.es")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.customers.detail.profileFields.weekends")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {customer.allowWeekendBooking
                      ? t("admin.customers.new.fields.allowWeekendBooking")
                      : t("admin.customers.detail.labels.noWeekends")}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.customers.detail.sections.addressLabel")}
                  </dt>
                  <dd className="mt-1 text-sm text-slate-700">
                    {customer.direccionLinea1 ? (
                      <>
                        <p className="font-semibold text-slate-900">
                          {customer.direccionLinea1}
                        </p>
                        {customer.direccionLinea2 ? <p>{customer.direccionLinea2}</p> : null}
                        <p>
                          {[customer.ciudad, customer.estadoProvincia, customer.codigoPostal]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </>
                    ) : (
                      <p className="text-slate-500">
                        {t("admin.customers.detail.labels.noAddress")}
                      </p>
                    )}
                  </dd>
                </div>
              </dl>
            </CollapsibleSection>
          </div>

          <div className="min-w-0">
            <CollapsibleSection
              className="h-full lg:min-h-[360px]"
              title={t("admin.customers.detail.sections.financialsTitle")}
              subtitle={t("admin.customers.detail.sections.financialsSubtitle")}
              headerExtra={
                <label
                  htmlFor="edit-customer-financials"
                  className="cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                >
                  {t("common.actions.edit")}
                </label>
              }
            >
              <div className="grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.customers.detail.financials.fields.plan")}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {customer.contractedServiceTier?.name ??
                      t("common.labels.notAvailable")}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.customers.detail.financials.fields.paymentMethod")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {customer.paymentMethod
                      ? t(
                          `admin.customers.detail.financials.paymentMethods.${customer.paymentMethod}`
                        )
                      : t("common.labels.notAvailable")}
                  </p>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.invoices.servicePayment.fields.servicePrice")}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {primaryProperty?.servicePrice != null
                      ? currencyFormatter.format(Number(primaryProperty.servicePrice))
                      : t("common.labels.notAvailable")}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.invoices.servicePayment.fields.paymentDay")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {primaryProperty?.paymentDay
                      ? t("admin.invoices.servicePayment.dayOfMonth", {
                          day: String(primaryProperty.paymentDay),
                        })
                      : t("common.labels.notAvailable")}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("admin.invoices.servicePayment.fields.paymentType")}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {primaryProperty?.paymentType
                      ? t(
                          `admin.invoices.servicePayment.paymentTypes.${primaryProperty.paymentType}`
                        )
                      : t("common.labels.notAvailable")}
                  </p>
                </article>
              </div>
              {customer.properties.length > 1 ? (
                <p className="mt-3 text-xs text-slate-500">
                  {t("admin.customers.detail.financials.multiPropertyHint")}
                </p>
              ) : null}
              {customer.properties.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  {t("admin.customers.detail.financials.noPropertyHint")}
                </p>
              ) : null}
            </CollapsibleSection>
          </div>

          <div className="min-w-0 2xl:col-span-2">
            <AdminCustomerProperties
              customerId={customer.id}
              rows={propertyRows}
              addPropertyTargetId="new-property"
              onUpdateProperty={updateProperty}
              onDeleteProperty={deleteProperty}
            />
          </div>

          <div className="min-w-0 2xl:col-span-2">
            <CollapsibleSection
              title={t("admin.customers.detail.sections.contractTitle")}
              subtitle={t("admin.customers.detail.sections.contractSubtitle")}
              headerExtra={
                latestContract ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {t("admin.customers.detail.contract.period", {
                        month: formatInBusinessTimeZone(latestContract.periodMonth, locale, {
                          month: "long",
                          year: "numeric",
                        }),
                      })}
                    </span>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${contractStatusBadgeClass(
                        latestContract.status
                      )}`}
                    >
                      {t(`admin.customers.detail.contract.status.${latestContract.status}`)}
                    </span>
                  </div>
                ) : null
              }
            >
              {!latestContract ? (
                <div>
                  <p className="text-sm text-slate-500">
                    {t("admin.customers.detail.contract.noContract")}
                  </p>
                  <form action={generateServiceContract} className="mt-3">
                    <input type="hidden" name="customerId" value={customer.id} />
                    <FormSubmitButton
                      idleLabel={t("admin.customers.detail.contract.generate")}
                      pendingLabel={t("admin.customers.detail.contract.generating")}
                      className="px-4 py-2 text-xs"
                    />
                  </form>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {latestContract.pdfUrl ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {t("admin.customers.detail.contract.documentPreview")}
                          </p>
                          {latestContract.status === "SIGNED" ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {t("admin.customers.detail.contract.signedOn", {
                                date: latestContract.clientSignedAt
                                  ? formatInBusinessTimeZone(latestContract.clientSignedAt, locale, {
                                      dateStyle: "long",
                                    })
                                  : t("common.labels.notAvailable"),
                              })}
                              {latestContract.clientSignedVia
                                ? ` · ${t(
                                    `admin.customers.detail.contract.signedVia.${latestContract.clientSignedVia}`
                                  )}`
                                : ""}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-500">
                              {t("admin.customers.detail.contract.previewHint")}
                            </p>
                          )}
                          <p
                            className={`mt-1 text-xs ${
                              latestContract.companySignatureUrl
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {latestContract.companySignatureUrl
                              ? t("admin.customers.detail.contract.companySignatureIncluded")
                              : t("admin.customers.detail.contract.companySignatureMissing")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={generateServiceContract}>
                            <input type="hidden" name="customerId" value={customer.id} />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                            >
                              {latestContract.status === "DRAFT"
                                ? t("admin.customers.detail.contract.refreshDraft")
                                : t("admin.customers.detail.contract.generateNew")}
                            </button>
                          </form>
                          {latestContract.status === "DRAFT" ? (
                            <form action={sendServiceContract}>
                              <input type="hidden" name="contractId" value={latestContract.id} />
                              <input type="hidden" name="customerId" value={customer.id} />
                              <FormSubmitButton
                                idleLabel={t("admin.customers.detail.contract.send")}
                                pendingLabel={t("admin.customers.detail.contract.sending")}
                                className="rounded-full px-3.5 py-2 text-xs"
                              />
                            </form>
                          ) : null}
                          <label
                            htmlFor="view-contract"
                            className="cursor-pointer rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                          >
                            {latestContract.status === "SIGNED"
                              ? t("admin.customers.detail.contract.viewContract")
                              : t("admin.customers.detail.contract.viewAndSign")}
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-10 text-center">
                        <p className="text-sm text-slate-500">
                          {t("admin.customers.detail.contract.pdfUnavailable")}
                        </p>
                        {latestContract.pdfError ? (
                          <p className="mx-auto mt-3 max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left font-mono text-[11px] text-rose-700">
                            {latestContract.pdfError}
                          </p>
                        ) : null}
                        <form action={generateServiceContract} className="mt-4">
                          <input type="hidden" name="customerId" value={customer.id} />
                          <FormSubmitButton
                            idleLabel={t("admin.customers.detail.contract.retryGenerate")}
                            pendingLabel={t("admin.customers.detail.contract.generating")}
                            className="px-4 py-2 text-xs"
                          />
                        </form>
                      </div>
                    )}
                  </div>

                  {contractHistory.length > 0 ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {t("admin.customers.detail.contract.history")}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {contractHistory.map((historyContract) => (
                          <li
                            key={historyContract.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                          >
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="text-sm font-medium text-slate-700">
                                {formatInBusinessTimeZone(historyContract.periodMonth, locale, {
                                  month: "long",
                                  year: "numeric",
                                })}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${contractStatusBadgeClass(
                                  historyContract.status
                                )}`}
                              >
                                {t(
                                  `admin.customers.detail.contract.status.${historyContract.status}`
                                )}
                              </span>
                            </div>
                            {historyContract.pdfUrl ? (
                              <a
                                href={contractPdfHref(historyContract.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-sky-700 hover:underline"
                              >
                                {t("admin.customers.detail.contract.viewPdf")}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {t("common.labels.notAvailable")}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </CollapsibleSection>
          </div>

          <div className="min-w-0">
            <CustomerInvoicesTable rows={invoicesRows} />
          </div>

          <div className="min-w-0">
            <CustomerRepositoryExplorer customerId={customer.id} />
          </div>
        </div>

        <div className="space-y-6">
          <CustomerJobsTable
            rows={jobsRows}
            actionTargetId="new-job"
          />

          <CustomerPlansTable
            rows={plansRows}
            onToggle={toggleServicePlan}
            onDelete={deleteServicePlan}
            actionTargetId="new-plan"
          />

          <div className="flex justify-end">
            <DeleteCustomerButton
              customerId={customer.id}
              deleteCustomerAction={deleteCustomer}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
            />
          </div>
        </div>
      </section>

      <input id="edit-customer" type="checkbox" className="peer/profile hidden" />
      <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/profile:flex">
        <label
          htmlFor="edit-customer"
          className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
        />
        <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.sections.profileTitle")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.actions.saveChanges")}
                </h2>
                <p className="text-sm text-slate-500">{customerName}</p>
              </div>
              <label
                htmlFor="edit-customer"
                className="app-modal-close"
                aria-label={t("common.actions.close")}
                title={t("common.actions.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </label>
            </div>
            <form action={updateCustomer} className="mt-5 space-y-5">
              <input type="hidden" name="customerId" value={customer.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.firstName")}
                  </label>
                  <input
                    name="nombre"
                    defaultValue={customer.nombre}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.lastName")}
                  </label>
                  <input
                    name="apellidos"
                    defaultValue={customer.apellidos ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.email")}
                  </label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={customer.email ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.language")}
                  </label>
                  <select
                    name="idiomaPreferencia"
                    defaultValue={customer.idiomaPreferencia}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="ES">{t("common.language.es")}</option>
                    <option value="EN">{t("common.language.en")}</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.phone")}
                  </label>
                  <input
                    name="telefono"
                    defaultValue={formatUsPhone(customer.telefono) ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("common.labels.phoneSecondary")}
                  </label>
                  <input
                    name="telefonoSecundario"
                    defaultValue={formatUsPhone(customer.telefonoSecundario) ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.new.fields.status")}
                  </label>
                  <select
                    name="estadoCuenta"
                    defaultValue={customer.estadoCuenta}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="ACTIVE">{t("common.status.active")}</option>
                    <option value="INACTIVE">{t("common.status.inactive")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.new.fields.type")}
                  </label>
                  <select
                    name="tipoCliente"
                    defaultValue={customer.tipoCliente}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="RESIDENTIAL">
                      {t("admin.customers.types.residential")}
                    </option>
                    <option value="COMMERCIAL">
                      {t("admin.customers.types.commercial")}
                    </option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                <input
                  type="checkbox"
                  name="allowWeekendBooking"
                  defaultChecked={Boolean(customer.allowWeekendBooking)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>{t("admin.customers.new.fields.allowWeekendBooking")}</span>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {t("address.sectionTitle")}
                </h3>
                <div className="mt-4">
                  <AddressAutocomplete
                    defaultValue={{
                      line1: customer.direccionLinea1,
                      line2: customer.direccionLinea2,
                      city: customer.ciudad,
                      state: customer.estadoProvincia,
                      postalCode: customer.codigoPostal,
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("common.labels.notes")}
                </label>
                <textarea
                  name="notas"
                  defaultValue={customer.notas ?? ""}
                  className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <FormSubmitButton
                  idleLabel={t("admin.customers.detail.actions.saveChanges")}
                  pendingLabel={t("admin.customers.detail.actions.saving")}
                  successLabel={t("common.feedback.saved")}
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      <input
        id="edit-customer-financials"
        type="checkbox"
        className="peer/financials hidden"
      />
      <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/financials:flex">
        <label
          htmlFor="edit-customer-financials"
          className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
        />
        <div className="app-modal-card relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.sections.financialsTitle")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.actions.saveChanges")}
                </h2>
                <p className="text-sm text-slate-500">{customerName}</p>
              </div>
              <label
                htmlFor="edit-customer-financials"
                className="app-modal-close"
                aria-label={t("common.actions.close")}
                title={t("common.actions.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </label>
            </div>
            <form action={updateCustomerFinancials} className="mt-5 space-y-5">
              <input type="hidden" name="customerId" value={customer.id} />
              <input
                type="hidden"
                name="primaryPropertyId"
                value={primaryProperty?.id ?? ""}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.detail.financials.fields.plan")}
                  </label>
                  <select
                    name="contractedServiceTierId"
                    defaultValue={customer.contractedServiceTierId ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="">{t("common.labels.notAvailable")}</option>
                    {tierOptions.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.customers.detail.financials.fields.paymentMethod")}
                  </label>
                  <select
                    name="paymentMethod"
                    defaultValue={customer.paymentMethod ?? ""}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="">{t("common.labels.notAvailable")}</option>
                    {PAYMENT_METHOD_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`admin.customers.detail.financials.paymentMethods.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  {t("admin.invoices.servicePayment.sectionTitle")}
                </p>
                {primaryProperty ? (
                  <>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("admin.customers.detail.financials.primaryPropertyHint", {
                        address: primaryProperty.address,
                      })}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                        </label>
                        <input
                          type="date"
                          name="serviceStartDate"
                          defaultValue={
                            primaryProperty.serviceStartDate
                              ? formatBusinessDateInput(primaryProperty.serviceStartDate)
                              : ""
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.paymentDay")}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          name="paymentDay"
                          defaultValue={primaryProperty.paymentDay ?? ""}
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.servicePrice")}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          name="servicePrice"
                          defaultValue={
                            primaryProperty.servicePrice !== null
                              ? Number(primaryProperty.servicePrice).toFixed(2)
                              : ""
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {t("admin.invoices.servicePayment.fields.paymentType")}
                        </label>
                        <select
                          name="paymentType"
                          defaultValue={primaryProperty.paymentType ?? ""}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                        >
                          <option value="">
                            {t("admin.invoices.servicePayment.placeholders.paymentType")}
                          </option>
                          {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {t(`admin.invoices.servicePayment.paymentTypes.${value}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("admin.invoices.servicePayment.fields.paymentNotes")}
                      </label>
                      <textarea
                        name="paymentNotes"
                        defaultValue={primaryProperty.paymentNotes ?? ""}
                        className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    {t("admin.customers.detail.financials.noPropertyHint")}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <FormSubmitButton
                  idleLabel={t("admin.customers.detail.actions.saveChanges")}
                  pendingLabel={t("admin.customers.detail.actions.saving")}
                  successLabel={t("common.feedback.saved")}
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/property:flex">
        <label
          htmlFor="new-property"
          className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
        />
        <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.properties.modalKicker")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.properties.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.properties.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-property"
                className="app-modal-close"
                aria-label={t("common.actions.close")}
                title={t("common.actions.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </label>
            </div>
            <form action={createProperty} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.properties.fields.name")}
                </label>
                <input
                  name="name"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t(
                    "admin.customers.detail.properties.placeholders.nameExample"
                  )}
                />
              </div>
              <AddressAutocompleteSingle
                name="address"
                label={t("admin.routes.labels.address")}
                placeholder={t(
                  "admin.customers.detail.properties.placeholders.address"
                )}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.poolType")}
                </label>
                <select
                  name="poolType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">
                    {t("admin.customers.detail.properties.options.select")}
                  </option>
                  <option value="Concreto">
                    {t("admin.customers.detail.properties.options.concrete")}
                  </option>
                  <option value="Fibra">
                    {t("admin.customers.detail.properties.options.fiberglass")}
                  </option>
                  <option value="Vinilo">
                    {t("admin.customers.detail.properties.options.vinyl")}
                  </option>
                  <option value="Material alternativo">
                    {t("admin.customers.detail.properties.options.altMaterial")}
                  </option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.properties.fields.sanitizerType")}
                </label>
                <select
                  name="sanitizerType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">
                    {t("admin.customers.detail.properties.options.select")}
                  </option>
                  <option value="Sal">
                    {t("admin.customers.detail.properties.options.salt")}
                  </option>
                  <option value="Cloro">
                    {t("admin.customers.detail.properties.options.chlorine")}
                  </option>
                  <option value="Otro">
                    {t("admin.customers.detail.properties.options.other")}
                  </option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.routes.labels.filterType")}
              </label>
              <select
                name="filterType"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                defaultValue=""
              >
                <option value="">
                  {t("admin.customers.detail.properties.options.select")}
                </option>
                <option value="Arena">
                  {t("admin.customers.detail.properties.options.filterSand")}
                </option>
                <option value="Cartucho">
                  {t("admin.customers.detail.properties.options.filterCartridge")}
                </option>
                <option value="D.E.">
                  {t("admin.customers.detail.properties.options.filterDE")}
                </option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.poolVolume")}
                </label>
                <input
                  name="poolVolumeGallons"
                  type="number"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.properties.fields.spa")}
                </label>
                <select
                  name="hasSpa"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="no">{t("common.labels.no")}</option>
                  <option value="yes">{t("common.labels.yes")}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.properties.fields.accessLocationNotes")}
              </label>
              <textarea
                name="accessLocationNotes"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                placeholder={t("admin.customers.detail.properties.placeholders.accessLocationNotes")}
                required
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {t("admin.invoices.servicePayment.sectionTitle")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("admin.invoices.servicePayment.adminOnly")}
                  </p>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  {t("admin.invoices.servicePayment.adminBadge")}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.servicePayment.fields.serviceStartDate")}
                  </label>
                  <input
                    type="date"
                    name="serviceStartDate"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.servicePayment.fields.paymentDay")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    name="paymentDay"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder={t("admin.invoices.servicePayment.placeholders.paymentDay")}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.servicePayment.fields.servicePrice")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="servicePrice"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder={t("admin.invoices.servicePayment.placeholders.servicePrice")}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.servicePayment.fields.paymentType")}
                  </label>
                  <select
                    name="paymentType"
                    defaultValue=""
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <option value="">
                      {t("admin.invoices.servicePayment.placeholders.paymentType")}
                    </option>
                    {SERVICE_PAYMENT_TYPE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {t(`admin.invoices.servicePayment.paymentTypes.${value}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.servicePayment.fields.paymentNotes")}
                </label>
                <textarea
                  name="paymentNotes"
                  className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder={t("admin.invoices.servicePayment.placeholders.paymentNotes")}
                />
              </div>
            </div>
            <FormSubmitButton
              idleLabel={t("admin.customers.detail.actions.saveProperty")}
              pendingLabel={t("admin.customers.detail.actions.saving")}
              successLabel={t("common.feedback.created")}
              className="w-full"
            />
            </form>
          </div>
        </div>
      </div>

      <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/job:flex">
        <label
          htmlFor="new-job"
          className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
        />
        <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.jobs.modalKicker")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.jobs.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.jobs.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-job"
                className="app-modal-close"
                aria-label={t("common.actions.close")}
                title={t("common.actions.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </label>
            </div>
            <form action={createJob} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.routes.labels.property")}
              </label>
              <select
                name="propertyId"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                required
              >
                {customer.properties.length === 0 ? (
                  <option value="">{t("admin.routes.labels.noProperties")}</option>
                ) : (
                  customer.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name
                        ? `${property.name} · ${property.address}`
                        : property.address}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.date")}
                </label>
                <input
                  name="scheduledDate"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.time")}
                </label>
                <input
                  name="scheduledTime"
                  type="time"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceTier")}
                </label>
                <select
                  name="serviceTierId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {tierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceType")}
                </label>
                <select
                  name="serviceType"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {serviceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.labelKey ? t(option.labelKey) : option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.priority")}
                </label>
                <select
                  name="priority"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="NORMAL">{t("jobs.priority.normal")}</option>
                  <option value="URGENT">{t("jobs.priority.urgent")}</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.durationMinutes")}
                </label>
                <input
                  name="estimatedDuration"
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="60"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.tech")}
                </label>
                <select
                  name="technicianId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="">{t("admin.routes.labels.unassigned")}</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.user.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("jobs.detail.fields.jobType")}
              </label>
              <select
                name="type"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <option value="ROUTINE">{t("jobs.type.routine")}</option>
                <option value="ON_DEMAND">{t("jobs.type.onDemand")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("common.labels.notes")}
              </label>
              <textarea
                name="notes"
                className="mt-2 min-h-[80px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <FormSubmitButton
              idleLabel={t("admin.customers.detail.actions.createJob")}
              pendingLabel={t("admin.customers.detail.actions.saving")}
              successLabel={t("common.feedback.created")}
              className="w-full"
            />
            </form>
          </div>
        </div>
      </div>

      <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/plan:flex">
        <label
          htmlFor="new-plan"
          className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
        />
        <div className="app-modal-card relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="app-modal-scroll modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.customers.detail.plans.modalKicker")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.customers.detail.plans.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.customers.detail.plans.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="new-plan"
                className="app-modal-close"
                aria-label={t("common.actions.close")}
                title={t("common.actions.close")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </label>
            </div>
            <form action={createServicePlan} className="mt-5 space-y-4">
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.plans.fields.weeklyRoute")}
                </label>
                <select
                  name="planTemplate"
                  defaultValue={GLOBAL_RECURRING_PLAN_OPTIONS[0]?.value}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  required
                >
                  {GLOBAL_RECURRING_PLAN_OPTIONS.map((planOption) => (
                    <option key={planOption.value} value={planOption.value}>
                      {t(planOption.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.routes.labels.property")}
                </label>
                <select
                  name="propertyId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  required
                >
                  {customer.properties.length === 0 ? (
                    <option value="">{t("admin.routes.labels.noProperties")}</option>
                  ) : (
                    customer.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name
                          ? `${property.name} · ${property.address}`
                          : property.address}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.serviceTier")}
                </label>
                <select
                  name="serviceTierId"
                  defaultValue={recurringPlanDefaultTierId}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                >
                  {recurringPlanTierOptions.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.tech")}
                </label>
                <select
                  name="technicianId"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  required
                >
                  <option value="">{t("admin.customers.detail.plans.placeholders.selectTechnician")}</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.user.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.customers.detail.plans.fields.startDate")}
                </label>
                <input
                  name="nextDate"
                  type="date"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("jobs.detail.fields.duration")}
                </label>
                <input
                  name="estimatedDuration"
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                  placeholder="60"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("admin.customers.detail.plans.fields.notes")}
              </label>
              <textarea
                name="notes"
                className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <FormSubmitButton
              idleLabel={t("admin.customers.detail.actions.createPlan")}
              pendingLabel={t("admin.customers.detail.actions.saving")}
              successLabel={t("common.feedback.created")}
              className="w-full"
            />
            </form>
          </div>
        </div>
      </div>

      {latestContract ? (
        <>
          <input id="view-contract" type="checkbox" className="peer/contract hidden" />
          <div className="app-modal-layer fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/contract:flex">
            <label
              htmlFor="view-contract"
              className="app-modal-backdrop absolute inset-0 bg-slate-900/60"
            />
            <div className="app-modal-card relative z-10 flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="app-modal-scroll modal-scroll flex-1 overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
                <div className="app-modal-header flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                      {t("admin.customers.detail.sections.contractTitle")}
                    </p>
                    <h2 className="text-lg font-semibold">
                      {t("admin.customers.detail.contract.period", {
                        month: formatInBusinessTimeZone(latestContract.periodMonth, locale, {
                          month: "long",
                          year: "numeric",
                        }),
                      })}
                    </h2>
                    <p className="text-sm text-slate-500">{customerName}</p>
                  </div>
                  <label
                    htmlFor="view-contract"
                    className="app-modal-close"
                    aria-label={t("common.actions.close")}
                    title={t("common.actions.close")}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-4 w-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6l-12 12" />
                    </svg>
                  </label>
                </div>

                <div className="mt-5 flex h-[64vh] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <iframe
                    src={contractPdfHref(latestContract.id)}
                    title={t("admin.customers.detail.contract.documentPreview")}
                    className="w-full flex-1 border-0 bg-white"
                  />
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
                    <p className="text-xs text-slate-500">
                      {t("admin.customers.detail.contract.previewHint")}
                    </p>
                    <a
                      href={contractPdfHref(latestContract.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      {t("admin.customers.detail.contract.openNewTab")}
                    </a>
                  </div>
                </div>

                {latestContract.status === "SIGNED" ? (
                  <p className="mt-4 text-xs text-slate-500">
                    {t("admin.customers.detail.contract.signedOn", {
                      date: latestContract.clientSignedAt
                        ? formatInBusinessTimeZone(latestContract.clientSignedAt, locale, {
                            dateStyle: "long",
                          })
                        : t("common.labels.notAvailable"),
                    })}
                    {latestContract.clientSignedVia
                      ? ` · ${t(
                          `admin.customers.detail.contract.signedVia.${latestContract.clientSignedVia}`
                        )}`
                      : ""}
                  </p>
                ) : (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-800">
                      {t("admin.customers.detail.contract.inPersonTitle")}
                    </p>
                    <ContractInPersonSignForm
                      action={signServiceContractInPerson}
                      contractId={latestContract.id}
                      customerId={customer.id}
                      hint={t("admin.customers.detail.contract.inPersonHint")}
                      clearLabel={t("admin.customers.detail.contract.clearSignature")}
                      submitIdleLabel={t("admin.customers.detail.contract.signAction")}
                      submitPendingLabel={t("admin.customers.detail.contract.signing")}
                      missingSignatureLabel={t(
                        "admin.customers.detail.contract.missingSignature"
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}




