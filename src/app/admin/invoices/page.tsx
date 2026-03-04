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
    theme,
    template: invoiceTemplate,
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl },
  });

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
  const requestedPage = Number(pageParam);
  const pageSize = 20;

  const totalInvoices = await prisma.invoice.count();
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));
  const currentPage = Number.isFinite(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1;
  const skip = (currentPage - 1) * pageSize;

  const invoices = await prisma.invoice.findMany({
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

  const customers = await prisma.customer.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, apellidos: true, email: true },
  });

  const jobs = await prisma.job.findMany({
    orderBy: { scheduledDate: "desc" },
    select: {
      id: true,
      customerId: true,
      scheduledDate: true,
      status: true,
      serviceType: true,
    },
  });

  const themeLabels: Record<string, string> = {
    STANDARD: t("admin.invoices.theme.standard"),
    SPECIAL: t("admin.invoices.theme.special"),
    ESTIMATE: t("admin.invoices.theme.estimate"),
  };

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
      <section className="space-y-6">
        <div className="app-card p-6 shadow-contrast">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {t("admin.invoices.list.title")}
              </h2>
              <p className="text-sm text-slate-500">
                {t("admin.invoices.list.count", { count: totalInvoices })}
              </p>
              <p className="text-xs text-slate-400">
                {t("admin.invoices.list.showing", {
                  count: invoices.length,
                  total: totalInvoices,
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                {t("admin.invoices.list.total", { count: totalInvoices })}
              </span>
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
                }))}
                createInvoiceAction={createInvoice}
                triggerLabel={t("admin.invoices.actions.new")}
                kicker={t("admin.invoices.new.kicker")}
                title={t("admin.invoices.new.title")}
                closeLabel={t("common.actions.close")}
              />
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm">
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t("admin.invoices.list.empty")}
              </p>
            ) : (
              invoices.map((invoice) => {
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
    </AppShell>
  );
}
