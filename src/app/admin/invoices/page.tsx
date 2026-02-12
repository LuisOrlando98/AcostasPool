import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import SendInvoiceButton from "@/components/invoices/SendInvoiceButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { formatCustomerName } from "@/lib/customers/format";
import { getAssetUrl } from "@/lib/assets";
import { getRequestLocale, getTranslations } from "@/i18n/server";

async function createInvoice(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const customerId = String(formData.get("customerId"));
  const jobId = String(formData.get("jobId") ?? "");
  const description = String(formData.get("description") ?? "Service");
  const amountRaw = String(formData.get("amount") ?? "0");
  const taxRaw = String(formData.get("tax") ?? "0");
  const notes = String(formData.get("notes") ?? "");
  const themeRaw = String(formData.get("theme") ?? "STANDARD");

  const amount = Number(amountRaw) || 0;
  const tax = Number(taxRaw) || 0;
  const total = amount + tax;
  const theme =
    themeRaw === "SPECIAL"
      ? "SPECIAL"
      : themeRaw === "ESTIMATE"
        ? "ESTIMATE"
        : "STANDARD";

  if (!customerId || amount <= 0) {
    return;
  }

  const number = `INV-${Date.now()}`;
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return;
  }

  const customerName = formatCustomerName(customer);

  const invoice = await prisma.invoice.create({
    data: {
      customerId,
      jobId: jobId || null,
      number,
      status: "DRAFT",
      theme,
      subtotal: amount,
      tax,
      total,
      notes: notes || null,
      lineItems: [{ label: description, amount }],
    },
  });

  const pdfUrl = await generateInvoicePdf({
    customerId: customer.id,
    invoiceNumber: invoice.number,
    issueDate: invoice.createdAt,
    customerName,
    customerEmail: customer.email,
    items: [{ label: description, amount }],
    subtotal: amount,
    tax,
    total,
    notes: notes || null,
    theme,
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl },
  });

  revalidatePath("/admin/invoices");
}

type InvoicesPageProps = {
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
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
      scheduledDate: true,
      customer: { select: { nombre: true, apellidos: true, email: true } },
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
        <input
          id="new-invoice"
          type="checkbox"
          className="peer hidden"
        />

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
              <label
                htmlFor="new-invoice"
                className="app-button-primary cursor-pointer px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
              >
                {t("admin.invoices.actions.new")}
              </label>
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
                        label={`${t("admin.invoices.list.theme")}: ${
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

        <div className="fixed inset-0 z-[90] hidden items-center justify-center p-4 sm:p-6 peer-checked:flex">
          <label
            htmlFor="new-invoice"
            className="absolute inset-0 bg-slate-900/60"
          />
          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="modal-scroll max-h-[90vh] overflow-y-auto p-5 pr-4 sm:p-6 sm:pr-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {t("admin.invoices.new.kicker")}
                  </p>
                  <h2 className="text-lg font-semibold">
                    {t("admin.invoices.new.title")}
                  </h2>
                </div>
                <label
                  htmlFor="new-invoice"
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
              <form action={createInvoice} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.new.fields.customer")}
                </label>
                <select
                  name="customerId"
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  required
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {formatCustomerName(customer)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("admin.invoices.new.fields.job")}
                </label>
                <select
                  name="jobId"
                  className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                >
                  <option value="">{t("admin.invoices.new.fields.noJob")}</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {formatCustomerName(job.customer)} -{" "}
                      {job.scheduledDate.toLocaleDateString(locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.new.fields.theme")}
                  </label>
                  <select
                    name="theme"
                    className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                  >
                    <option value="STANDARD">{t("admin.invoices.theme.standard")}</option>
                    <option value="SPECIAL">{t("admin.invoices.theme.special")}</option>
                    <option value="ESTIMATE">{t("admin.invoices.theme.estimate")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.new.fields.description")}
                  </label>
                  <input
                    name="description"
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    placeholder={t("admin.invoices.new.placeholders.description")}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.new.fields.subtotal")}
                  </label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {t("admin.invoices.new.fields.tax")}
                  </label>
                  <input
                    name="tax"
                    type="number"
                    step="0.01"
                    defaultValue="0"
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t("common.labels.notes")}
                </label>
                <textarea
                  name="notes"
                  className="app-input mt-2 min-h-[90px] w-full px-4 py-3 text-sm"
                />
              </div>
              <button className="app-button-primary w-full px-4 py-3 text-sm font-semibold">
                {t("admin.invoices.new.actions.create")}
              </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
