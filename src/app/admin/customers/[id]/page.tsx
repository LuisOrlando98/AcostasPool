import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ActionFeedbackToast from "@/components/ui/ActionFeedbackToast";
import AdminCustomerProperties from "@/components/customers/AdminCustomerProperties";
import CustomerInvoicesTable from "@/components/customers/CustomerInvoicesTable";
import CustomerJobsTable from "@/components/customers/CustomerJobsTable";
import CustomerPlansTable from "@/components/customers/CustomerPlansTable";
import CustomerRepositoryExplorer from "@/components/customers/CustomerRepositoryExplorer";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import ActionErrorToast from "@/components/customers/forms/ActionErrorToast";
import CustomerHeroSection from "@/components/customers/forms/CustomerHeroSection";
import CustomerProfileSection from "@/components/customers/forms/CustomerProfileSection";
import EditCustomerModal from "@/components/customers/forms/EditCustomerModal";
import NewJobModal from "@/components/customers/forms/NewJobModal";
import NewPlanModal from "@/components/customers/forms/NewPlanModal";
import NewPropertyModal from "@/components/customers/forms/NewPropertyModal";
import { CustomerDetailModalsProvider } from "@/components/customers/forms/CustomerDetailModals";
import { pickEditCustomerFields } from "@/components/customers/forms/edit-customer-fields";
import type { ServiceTierOption } from "@/components/customers/forms/types";
import {
  ACTION_ERROR_PARAM,
  resolveActionErrorKey,
} from "@/components/customers/forms/action-result";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { getServiceTiers } from "@/lib/service-tiers";
import { formatCustomerName } from "@/lib/customers/format";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import {
  formatBusinessDateInput,
  formatInBusinessTimeZone,
} from "@/lib/timezone";
import {
  createJob,
  createProperty,
  createServicePlan,
  deleteCustomerFormAction,
  deletePropertyFormAction,
  deleteServicePlanFormAction,
  inviteCustomer,
  toggleServicePlanFormAction,
  updateCustomer,
  updatePropertyFormAction,
} from "./actions";

const STANDARD_TIER_NAME = "standard";
const INVITE_TOKENS_TO_INSPECT = 5;

const FEEDBACK_MESSAGE_KEYS: Record<string, string> = {
  "customer-saved": "admin.customers.feedback.saved",
  "property-created": "admin.customers.feedback.propertyCreated",
  "property-saved": "admin.customers.feedback.propertySaved",
  "property-deleted": "admin.customers.feedback.propertyDeleted",
  "job-created": "admin.customers.feedback.jobCreated",
  "plan-created": "admin.customers.feedback.planCreated",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isStandardTier(tier: { name: string }) {
  return tier.name.trim().toLowerCase() === STANDARD_TIER_NAME;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const customerId = resolvedParams?.id;
  const feedback = firstParam(resolvedSearchParams?.feedback);
  const feedbackMessageKey = feedback ? FEEDBACK_MESSAGE_KEYS[feedback] : undefined;
  const actionErrorKey = resolveActionErrorKey(
    feedback,
    firstParam(resolvedSearchParams?.[ACTION_ERROR_PARAM])
  );
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
            take: INVITE_TOKENS_TO_INSPECT,
            select: {
              createdAt: true,
              expiresAt: true,
              usedAt: true,
            },
          },
        },
      },
      properties: true,
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
  // Los modales de la ficha son client components: solo reciben lo que muestran.
  const technicians = await prisma.technician.findMany({
    select: { id: true, user: { select: { fullName: true } } },
    orderBy: { user: { fullName: "asc" } },
  });
  const serviceTiers = await getServiceTiers();
  const activeServiceTiers = serviceTiers.filter((tier) => tier.isActive);
  const tierOptions: ServiceTierOption[] = (
    activeServiceTiers.length > 0 ? activeServiceTiers : serviceTiers
  ).map((tier) => ({ id: tier.id, name: tier.name }));
  const recurringPlanTierOptions = [...tierOptions].sort((left, right) => {
    const leftIsStandard = isStandardTier(left);
    const rightIsStandard = isStandardTier(right);

    if (leftIsStandard === rightIsStandard) {
      return 0;
    }

    return leftIsStandard ? -1 : 1;
  });
  const recurringPlanDefaultTierId =
    recurringPlanTierOptions.find(isStandardTier)?.id ??
    recurringPlanTierOptions[0]?.id;
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
  }));
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
  const propertyOptions = customer.properties.map((property) => ({
    id: property.id,
    name: property.name,
    address: property.address,
  }));
  const customerEmailLabel = customer.email || t("common.labels.notAvailable");
  const hasCustomerEmail = Boolean(customer.email?.trim());

  return (
    <AppShell
      title={t("admin.customers.detail.title", { name: customerName })}
      subtitle={t("admin.customers.detail.subtitle")}
      role="ADMIN"
      wide
    >
      {feedbackMessageKey ? (
        <ActionFeedbackToast
          message={t(feedbackMessageKey)}
          dismissLabel={t("common.actions.close")}
        />
      ) : null}
      {actionErrorKey ? (
        <ActionErrorToast
          message={t(actionErrorKey)}
          dismissLabel={t("common.actions.close")}
        />
      ) : null}
      <CustomerDetailModalsProvider>
        <section className="customers-scope customers-detail space-y-5 sm:space-y-6">
          <CustomerHeroSection
            t={t}
            customer={customer}
            customerName={customerName}
            customerEmailLabel={customerEmailLabel}
            portalStatusLabel={portalStatusLabel}
            counts={{
              properties: customer.properties.length,
              jobs: customer.jobs.length,
              plans: customer.servicePlans.length,
              invoices: customer.invoices.length,
            }}
          />

          <div className="customers-detail-grid grid gap-5 sm:gap-6 2xl:grid-cols-2">
            <CustomerProfileSection
              t={t}
              customer={customer}
              customerName={customerName}
              customerEmailLabel={customerEmailLabel}
              hasCustomerEmail={hasCustomerEmail}
              portalStatusLabel={portalStatusLabel}
              portalStatusClass={portalStatusClass}
              inviteAction={inviteCustomer}
            />

            <div className="min-w-0">
              <AdminCustomerProperties
                customerId={customer.id}
                rows={propertyRows}
                addPropertyTargetId="new-property"
                onUpdateProperty={updatePropertyFormAction}
                onDeleteProperty={deletePropertyFormAction}
              />
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
              onToggle={toggleServicePlanFormAction}
              onDelete={deleteServicePlanFormAction}
              actionTargetId="new-plan"
            />

            <div className="flex justify-end">
              <DeleteCustomerButton
                customerId={customer.id}
                deleteCustomerAction={deleteCustomerFormAction}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
              />
            </div>
          </div>
        </section>

        <EditCustomerModal
          customer={pickEditCustomerFields(customer)}
          customerName={customerName}
          action={updateCustomer}
        />
        <NewPropertyModal customerId={customer.id} action={createProperty} />
        <NewJobModal
          customerId={customer.id}
          properties={propertyOptions}
          technicians={technicians}
          tierOptions={tierOptions}
          action={createJob}
        />
        <NewPlanModal
          customerId={customer.id}
          properties={propertyOptions}
          technicians={technicians}
          tierOptions={recurringPlanTierOptions}
          defaultTierId={recurringPlanDefaultTierId}
          action={createServicePlan}
        />
      </CustomerDetailModalsProvider>
    </AppShell>
  );
}
