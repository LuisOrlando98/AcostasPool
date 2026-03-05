import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import SendInvoiceButton from "@/components/invoices/SendInvoiceButton";
import NewInvoiceModal from "@/components/invoices/NewInvoiceModal";
import DeleteInvoiceButton from "@/components/invoices/DeleteInvoiceButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import {
  normalizeInvoiceLineItems,
  roundCurrency,
} from "@/lib/invoices/line-items";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { getAssetUrl } from "@/lib/assets";
import { getInvoiceTemplateConfig } from "@/lib/site-settings";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { logAuditEvent } from "@/lib/audit/log";
import type { Prisma } from "@prisma/client";

async function createInvoice(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN");

  const customerId = String(formData.get("customerId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const lineItemsJsonRaw = String(formData.get("lineItemsJson") ?? "[]");
  const notes = String(formData.get("notes") ?? "");
  const typeRaw = String(formData.get("type") ?? "STANDARD");
  const taxExempt = String(formData.get("taxExempt") ?? "") === "on";
  const theme =
    typeRaw === "SPECIAL"
      ? "SPECIAL"
      : typeRaw === "ESTIMATE"
        ? "ESTIMATE"
        : "STANDARD";

  let parsedLineItems: unknown = null;
  try {
    parsedLineItems = JSON.parse(lineItemsJsonRaw);
  } catch {
    return;
  }
  const lineItems = normalizeInvoiceLineItems(parsedLineItems);
  const subtotal = roundCurrency(
    lineItems.reduce((sum, line) => sum + line.amount, 0)
  );
  if (!customerId || lineItems.length === 0 || subtotal <= 0) {
    return;
  }
  const tax = taxExempt ? 0 : roundCurrency(subtotal * 0.07);
  const total = roundCurrency(subtotal + tax);

  const number = `INV-${Date.now()}`;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return;
  }

  const customerName = formatCustomerName(customer);
  const linkedJobId = jobId || null;
  if (linkedJobId) {
    const linkedJob = await prisma.job.findUnique({
      where: { id: linkedJobId },
      select: { customerId: true },
    });
    if (!linkedJob || linkedJob.customerId !== customerId) {
      return;
    }
  }
  const invoiceTemplate = await getInvoiceTemplateConfig();

  const invoice = await prisma.invoice.create({
    data: {
      customerId,
      jobId: linkedJobId,
      number,
      status: "DRAFT",
      theme,
      subtotal,
      tax,
      total,
      notes: notes || null,
      lineItems: lineItems as unknown as object,
    },
  });

  try {
    const pdfUrl = await generateInvoicePdf({
      customerId: customer.id,
      invoiceNumber: invoice.number,
      issueDate: invoice.createdAt,
      customerName,
      customerEmail: customer.email,
      customerPhone: customer.telefono,
      customerAddress: formatCustomerAddress(customer),
      items: lineItems,
      subtotal,
      tax,
      total,
      notes: notes || null,
      locale: customer.idiomaPreferencia,
      theme,
      template: invoiceTemplate,
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { pdfUrl },
    });
  } catch (error) {
    await prisma.invoice.delete({
      where: { id: invoice.id },
    });
    console.error(`[invoices] Failed to generate PDF for ${invoice.number}`, error);
    return;
  }

  await logAuditEvent({
    userId: session.sub,
    action: "INVOICE_CREATED",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: {
      customerId,
      jobId: linkedJobId,
      subtotal,
      tax,
      total,
      theme,
      taxExempt,
      lineItemsCount: lineItems.length,
    },
  });

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/client/invoices");
}

async function deleteInvoice(formData: FormData) {
  "use server";
  const session = await requireRole("ADMIN");

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) {
    return;
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      customerId: true,
      status: true,
      theme: true,
      total: true,
      pdfUrl: true,
      jobId: true,
    },
  });

  if (!invoice) {
    return;
  }

  await prisma.invoice.delete({
    where: { id: invoiceId },
  });

  await logAuditEvent({
    userId: session.sub,
    action: "INVOICE_DELETED",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: {
      number: invoice.number,
      customerId: invoice.customerId,
      jobId: invoice.jobId,
      status: invoice.status,
      theme: invoice.theme,
      total: Number(invoice.total),
      hadPdf: Boolean(invoice.pdfUrl),
    },
  });

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath(`/admin/customers/${invoice.customerId}`);
  revalidatePath("/client/invoices");
}

type InvoicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const parseParam = (key: string) => {
    const value = resolvedSearchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const pageParam = parseParam("page");
  const query = (parseParam("q") ?? "").trim();
  const customerFilter = (parseParam("customerId") ?? "").trim();
  const exactDateParam = (parseParam("date") ?? "").trim();
  const fromDateParam = (parseParam("from") ?? "").trim();
  const toDateParam = (parseParam("to") ?? "").trim();
  const requestedPage = Number(pageParam);
  const pageSize = 10;

  const customers = await prisma.customer.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, apellidos: true, email: true },
  });
  const customerIds = new Set(customers.map((customer) => customer.id));

  const isValidDateInput = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

  const toDayStart = (value: string) => new Date(`${value}T00:00:00`);
  const toDayEnd = (value: string) => new Date(`${value}T23:59:59.999`);

  const normalizedExactDate = isValidDateInput(exactDateParam)
    ? exactDateParam
    : "";
  const normalizedFromDate = isValidDateInput(fromDateParam) ? fromDateParam : "";
  const normalizedToDate = isValidDateInput(toDateParam) ? toDateParam : "";

  let createdAtFilter: Prisma.DateTimeFilter | undefined;
  if (normalizedExactDate) {
    createdAtFilter = {
      gte: toDayStart(normalizedExactDate),
      lte: toDayEnd(normalizedExactDate),
    };
  } else if (normalizedFromDate || normalizedToDate) {
    const rangeStart = normalizedFromDate ? toDayStart(normalizedFromDate) : null;
    const rangeEnd = normalizedToDate ? toDayEnd(normalizedToDate) : null;
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      createdAtFilter = { gte: rangeEnd, lte: rangeStart };
    } else {
      createdAtFilter = {
        ...(rangeStart ? { gte: rangeStart } : {}),
        ...(rangeEnd ? { lte: rangeEnd } : {}),
      };
    }
  }

  const where: Prisma.InvoiceWhereInput = {
    ...(query
      ? {
          number: {
            contains: query,
            mode: "insensitive",
          },
        }
      : {}),
    ...(customerFilter && customerIds.has(customerFilter)
      ? { customerId: customerFilter }
      : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const totalInvoices = await prisma.invoice.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const skip = (currentPage - 1) * pageSize;

  const pagedInvoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: pageSize,
    select: {
      id: true,
      number: true,
      total: true,
      status: true,
      theme: true,
      createdAt: true,
      sentAt: true,
      pdfUrl: true,
      customer: { select: { nombre: true, apellidos: true, email: true } },
      job: {
        select: {
          scheduledDate: true,
          technician: { select: { user: { select: { fullName: true } } } },
        },
      },
    },
  });

  const jobs = await prisma.job.findMany({
    orderBy: { scheduledDate: "desc" },
    select: {
      id: true,
      customerId: true,
      scheduledDate: true,
      status: true,
      serviceType: true,
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { lineItems: true },
      },
    },
  });

  const themeLabels: Record<string, string> = {
    STANDARD: t("admin.invoices.theme.standard"),
    SPECIAL: t("admin.invoices.theme.special"),
    ESTIMATE: t("admin.invoices.theme.estimate"),
  };
  const activeFiltersCount = [
    query.length > 0,
    customerFilter.length > 0,
    normalizedExactDate.length > 0,
    normalizedFromDate.length > 0,
    normalizedToDate.length > 0,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFiltersCount > 0;
  const selectedCustomerLabel =
    customerFilter && customerIds.has(customerFilter)
      ? formatCustomerName(
          customers.find((customer) => customer.id === customerFilter) ?? {
            nombre: "",
            apellidos: "",
          }
        )
      : null;

  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (resolvedSearchParams) {
      Object.entries(resolvedSearchParams).forEach(([key, value]) => {
        if (!value || key === "page") {
          return;
        }
        const normalized = Array.isArray(value) ? value[0] : value;
        if (normalized) {
          params.set(key, normalized);
        }
      });
    }
    if (page > 1) {
      params.set("page", String(page));
    }
    const query = params.toString();
    return query ? `/admin/invoices?${query}` : "/admin/invoices";
  };

  return (
    <AppShell
      title={t("admin.invoices.title")}
      subtitle={t("admin.invoices.subtitle")}
      role="ADMIN"
    >
      <input id="invoice-filters" type="checkbox" className="peer/invoice-filters hidden" />
      <section className="space-y-6">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {t("admin.invoices.list.recentTitle")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("admin.invoices.list.count", { count: totalInvoices })}
              </p>
              <p className="text-xs text-slate-400">
                {t("admin.invoices.list.showing", {
                  count: pagedInvoices.length,
                  total: totalInvoices,
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                {t("admin.invoices.list.recentCount", { count: pageSize })}
              </span>
              {hasActiveFilters ? (
                <span className="app-chip px-3 py-1 text-xs" data-tone="warning">
                  {t("admin.invoices.filters.activeCount", {
                    count: activeFiltersCount,
                  })}
                </span>
              ) : null}
              <label
                htmlFor="invoice-filters"
                className="app-button-ghost inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-0"
                aria-label={t("admin.invoices.filters.open")}
                title={t("admin.invoices.filters.open")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                <span className="sr-only">{t("admin.invoices.filters.open")}</span>
              </label>
              {hasActiveFilters ? (
                <a
                  href="/admin/invoices"
                  className="app-button-ghost px-3 py-2 text-xs font-semibold"
                >
                  {t("admin.invoices.filters.reset")}
                </a>
              ) : null}
              <NewInvoiceModal
                customers={customers.map((customer) => ({
                  id: customer.id,
                  name: formatCustomerName(customer),
                }))}
                jobs={jobs.map((job) => ({
                  id: job.id,
                  customerId: job.customerId,
                  scheduledDate: job.scheduledDate.toISOString(),
                  status: job.status,
                  serviceType: job.serviceType,
                  suggestedUnitPrice:
                    normalizeInvoiceLineItems(job.invoices[0]?.lineItems ?? [])[0]?.unitPrice ??
                    null,
                }))}
                createInvoiceAction={createInvoice}
                triggerLabel={t("admin.invoices.actions.new")}
                kicker={t("admin.invoices.new.kicker")}
                title={t("admin.invoices.new.title")}
                closeLabel={t("common.actions.close")}
              />
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {query ? (
                  <span className="app-chip max-w-[260px] truncate px-3 py-1 text-xs" data-tone="info">
                    {`${t("admin.invoices.filters.invoiceNumber")}: ${query}`}
                  </span>
                ) : null}
                {selectedCustomerLabel ? (
                  <span className="app-chip max-w-[260px] truncate px-3 py-1 text-xs" data-tone="info">
                    {`${t("admin.invoices.filters.customer")}: ${selectedCustomerLabel}`}
                  </span>
                ) : null}
                {normalizedExactDate ? (
                  <span className="app-chip px-3 py-1 text-xs" data-tone="info">
                    {`${t("admin.invoices.filters.date")}: ${normalizedExactDate}`}
                  </span>
                ) : null}
                {!normalizedExactDate && (normalizedFromDate || normalizedToDate) ? (
                  <span className="app-chip px-3 py-1 text-xs" data-tone="info">
                    {`${t("admin.invoices.filters.from")}: ${normalizedFromDate || "--"} | ${t("admin.invoices.filters.to")}: ${normalizedToDate || "--"}`}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-3 text-sm">
            {pagedInvoices.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.invoices.list.empty")}
              </p>
            ) : (
              pagedInvoices.map((invoice) => {
                const job = invoice.job;
                const techName =
                  job?.technician?.user.fullName ?? t("admin.invoices.list.noTech");
                return (
                  <div
                    key={invoice.id}
                    className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-white to-slate-50 px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {invoice.number}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCustomerName(invoice.customer)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          ${invoice.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {invoice.createdAt.toLocaleDateString(locale)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge
                        label={invoice.status}
                        tone={
                          invoice.status === "PAID"
                            ? "success"
                            : invoice.status === "OVERDUE"
                              ? "warning"
                              : "neutral"
                        }
                      />
                      <Badge
                        label={`${t("admin.invoices.list.type")}: ${
                          themeLabels[invoice.theme] ?? invoice.theme
                        }`}
                        tone="info"
                      />
                      {job ? (
                        <>
                          <Badge
                            label={`${t("admin.invoices.list.job")}: ${job.scheduledDate.toLocaleDateString(locale)}`}
                            tone="info"
                          />
                          <Badge
                            label={`${t("admin.invoices.list.tech")}: ${techName}`}
                            tone="neutral"
                          />
                        </>
                      ) : (
                        <Badge
                          label={t("admin.invoices.list.noJob")}
                          tone="neutral"
                        />
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="text-xs font-semibold text-sky-700 underline"
                      >
                        {!invoice.sentAt
                          ? t("common.actions.edit")
                          : t("common.actions.view")}
                      </Link>
                      {invoice.pdfUrl ? (
                        <a
                          href={getAssetUrl(invoice.pdfUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-600 underline"
                        >
                          {t("admin.invoices.list.viewPdf")}
                        </a>
                      ) : null}
                      <SendInvoiceButton
                        invoiceId={invoice.id}
                        disabled={!invoice.pdfUrl}
                      />
                      <DeleteInvoiceButton
                        invoiceId={invoice.id}
                        deleteInvoiceAction={deleteInvoice}
                        className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {t("admin.invoices.list.page", {
                  page: currentPage,
                  total: totalPages,
                })}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={buildPageHref(Math.max(1, currentPage - 1))}
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    currentPage === 1
                      ? "pointer-events-none border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {t("admin.invoices.list.prev")}
                </a>
                <a
                  href={buildPageHref(Math.min(totalPages, currentPage + 1))}
                  className={`rounded-full border px-3 py-1 font-semibold ${
                    currentPage === totalPages
                      ? "pointer-events-none border-slate-100 text-slate-300"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {t("admin.invoices.list.next")}
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-0 z-[2200] hidden items-center justify-center overflow-y-auto p-3 sm:p-6 peer-checked/invoice-filters:flex">
        <label
          htmlFor="invoice-filters"
          className="absolute inset-0 bg-slate-900/60"
        />
        <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {t("admin.invoices.filters.open")}
                </p>
                <h2 className="text-lg font-semibold">
                  {t("admin.invoices.filters.modalTitle")}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("admin.invoices.filters.modalSubtitle")}
                </p>
              </div>
              <label
                htmlFor="invoice-filters"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300"
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

            <form action="/admin/invoices" method="get" className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.filters.invoiceNumber")}
                </label>
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  className="app-input mt-2 w-full px-4 py-3 text-sm"
                  placeholder={t("admin.invoices.filters.invoiceNumberPlaceholder")}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.filters.customer")}
                </label>
                <select
                  name="customerId"
                  defaultValue={customerFilter}
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                >
                  <option value="">{t("admin.invoices.filters.allCustomers")}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {formatCustomerName(customer)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.filters.date")}
                  </label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={normalizedExactDate}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.filters.from")}
                  </label>
                  <input
                    type="date"
                    name="from"
                    defaultValue={normalizedFromDate}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.filters.to")}
                  </label>
                  <input
                    type="date"
                    name="to"
                    defaultValue={normalizedToDate}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                {t("admin.invoices.filters.dateHint")}
              </p>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <a
                  href="/admin/invoices"
                  className="app-button-ghost w-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
                >
                  {t("admin.invoices.filters.reset")}
                </a>
                <button
                  type="submit"
                  className="app-button-primary w-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] sm:w-auto"
                >
                  {t("admin.invoices.filters.apply")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
