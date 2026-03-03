import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { formatCustomerName } from "@/lib/customers/format";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { normalizeInvoiceLineItems, roundCurrency } from "@/lib/invoices/line-items";
import {
  getInvoiceTemplateConfig,
  type SiteInvoiceTemplateConfig,
} from "@/lib/site-settings";
import { renderInvoiceTemplatePreview } from "@/lib/invoice-template";
import { getRequestLocale, getTranslations } from "@/i18n/server";

type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";
type InvoiceTheme = "STANDARD" | "SPECIAL" | "ESTIMATE";

function parseStatus(value: string): InvoiceStatus {
  if (value === "SENT" || value === "PAID" || value === "OVERDUE") {
    return value;
  }
  return "DRAFT";
}

function parseTheme(value: string): InvoiceTheme {
  if (value === "SPECIAL" || value === "ESTIMATE") {
    return value;
  }
  return "STANDARD";
}

function parseEditorMode(value: string | undefined) {
  if (value === "code" || value === "web") {
    return value;
  }
  return "split";
}

async function updateInvoice(formData: FormData) {
  "use server";
  await requireRole("ADMIN");

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const number = String(formData.get("number") ?? "").trim();
  const status = parseStatus(String(formData.get("status") ?? "DRAFT"));
  const typeRaw = String(formData.get("type") ?? formData.get("theme") ?? "STANDARD");
  const theme = parseTheme(typeRaw);
  const jobIdRaw = String(formData.get("jobId") ?? "").trim();
  const taxRaw = Number(String(formData.get("tax") ?? "0"));
  const tax = Number.isFinite(taxRaw) && taxRaw >= 0 ? taxRaw : 0;
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const lineItemsRaw = String(formData.get("lineItemsJson") ?? "[]");

  if (!invoiceId || !number) {
    return;
  }

  const currentInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
    },
  });
  if (!currentInvoice) {
    return;
  }

  let parsedLineItems: unknown = null;
  try {
    parsedLineItems = JSON.parse(lineItemsRaw);
  } catch {
    return;
  }
  const lineItems = normalizeInvoiceLineItems(parsedLineItems);
  if (lineItems.length === 0) {
    return;
  }

  const subtotal = roundCurrency(lineItems.reduce((sum, item) => sum + item.amount, 0));
  const total = roundCurrency(subtotal + tax);

  let jobId: string | null = null;
  if (jobIdRaw) {
    const job = await prisma.job.findFirst({
      where: {
        id: jobIdRaw,
        customerId: currentInvoice.customerId,
      },
      select: { id: true },
    });
    if (job) {
      jobId = job.id;
    }
  }

  const template = await getInvoiceTemplateConfig();
  const pdfUrl = await generateInvoicePdf({
    customerId: currentInvoice.customerId,
    invoiceNumber: number,
    issueDate: currentInvoice.createdAt,
    customerName: formatCustomerName(currentInvoice.customer),
    customerEmail: currentInvoice.customer.email,
    items: lineItems,
    subtotal,
    tax,
    total,
    notes: notesRaw || null,
    theme,
    template,
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      number,
      status,
      theme,
      jobId,
      tax,
      notes: notesRaw || null,
      subtotal,
      total,
      lineItems: lineItems as unknown as object,
      pdfUrl,
    },
  });

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/customers/${currentInvoice.customerId}`);
}

type InvoiceEditorPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvoiceEditorPage({
  params,
  searchParams,
}: InvoiceEditorPageProps) {
  await requireRole("ADMIN");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedParams = await resolveParams(params);
  const invoiceId = resolvedParams?.id;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const modeRaw = resolvedSearchParams?.mode;
  const mode = parseEditorMode(Array.isArray(modeRaw) ? modeRaw[0] : modeRaw);

  if (!invoiceId) {
    return (
      <AppShell title="Invoice editor" subtitle="Invoice not found" role="ADMIN">
        <Link href="/admin/invoices" className="text-sm text-slate-600 underline">
          Back to invoices
        </Link>
      </AppShell>
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      job: {
        select: {
          id: true,
          scheduledDate: true,
          technician: { select: { user: { select: { fullName: true } } } },
        },
      },
    },
  });

  if (!invoice) {
    return (
      <AppShell title="Invoice editor" subtitle="Invoice not found" role="ADMIN">
        <Link href="/admin/invoices" className="text-sm text-slate-600 underline">
          Back to invoices
        </Link>
      </AppShell>
    );
  }

  const jobs = await prisma.job.findMany({
    where: { customerId: invoice.customerId },
    orderBy: { scheduledDate: "desc" },
    select: {
      id: true,
      scheduledDate: true,
      technician: { select: { user: { select: { fullName: true } } } },
    },
  });

  const template = await getInvoiceTemplateConfig();
  const previewHtml = renderInvoiceTemplatePreview(
    template as SiteInvoiceTemplateConfig,
    invoice.theme
  );
  const normalizedLineItems = normalizeInvoiceLineItems(invoice.lineItems);
  const lineItemsSeed =
    normalizedLineItems.length > 0
      ? normalizedLineItems
      : [{ label: "Service", quantity: 1, unitPrice: Number(invoice.subtotal), amount: Number(invoice.subtotal) }];
  const lineItemsJson = JSON.stringify(lineItemsSeed, null, 2);

  const modeHref = (nextMode: "code" | "web" | "split") =>
    `/admin/invoices/${invoice.id}?mode=${nextMode}`;

  return (
    <AppShell
      title={`Invoice ${invoice.number}`}
      subtitle={t("admin.invoices.subtitle")}
      role="ADMIN"
    >
      <section className="space-y-6">
        <div className="app-card p-5 shadow-contrast">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                Complete invoice editor
              </p>
              <h2 className="text-lg font-semibold text-slate-900">{invoice.number}</h2>
              <p className="text-xs text-slate-500">
                {formatCustomerName(invoice.customer)} - {invoice.createdAt.toLocaleDateString(locale)}
              </p>
            </div>
            <div className="ui-segment">
              <Link
                href={modeHref("code")}
                className={`ui-segment-item ${mode === "code" ? "is-active" : ""}`}
              >
                Code
              </Link>
              <Link
                href={modeHref("web")}
                className={`ui-segment-item ${mode === "web" ? "is-active" : ""}`}
              >
                Web
              </Link>
              <Link
                href={modeHref("split")}
                className={`ui-segment-item ${mode === "split" ? "is-active" : ""}`}
              >
                Split
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {mode !== "web" ? (
            <div className="app-card p-6 shadow-contrast">
              <form action={updateInvoice} className="space-y-4">
                <input type="hidden" name="invoiceId" value={invoice.id} />

                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Number
                    </span>
                    <input
                      name="number"
                      defaultValue={invoice.number}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                      required
                    />
                  </label>
                  <label>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Status
                    </span>
                    <select
                      name="status"
                      defaultValue={invoice.status}
                      className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="SENT">SENT</option>
                      <option value="PAID">PAID</option>
                      <option value="OVERDUE">OVERDUE</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Type
                    </span>
                    <select
                      name="type"
                      defaultValue={invoice.theme}
                      className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                    >
                      <option value="STANDARD">STANDARD</option>
                      <option value="SPECIAL">SPECIAL</option>
                      <option value="ESTIMATE">ESTIMATE</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Linked job
                    </span>
                    <select
                      name="jobId"
                      defaultValue={invoice.jobId ?? ""}
                      className="app-input mt-2 w-full bg-white px-4 py-3 text-sm"
                    >
                      <option value="">No job linked</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.scheduledDate.toLocaleDateString(locale)} -{" "}
                          {job.technician?.user.fullName ?? "No technician"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Tax
                    </span>
                    <input
                      name="tax"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={Number(invoice.tax).toFixed(2)}
                      className="app-input mt-2 w-full px-4 py-3 text-sm"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Line items JSON
                  </span>
                  <textarea
                    name="lineItemsJson"
                    rows={12}
                    defaultValue={lineItemsJson}
                    className="app-input mt-2 w-full px-4 py-3 font-mono text-xs"
                  />
                  <p className="mt-2 text-[11px] text-slate-500">
                    Format: {"[{\"label\":\"Service\",\"quantity\":1,\"unitPrice\":120,\"amount\":120}]"}
                  </p>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Notes
                  </span>
                  <textarea
                    name="notes"
                    rows={4}
                    defaultValue={invoice.notes ?? ""}
                    className="app-input mt-2 w-full px-4 py-3 text-sm"
                  />
                </label>

                <FormSubmitButton
                  idleLabel="Guardar cambios y regenerar PDF"
                  pendingLabel="Guardando..."
                  successLabel="Actualizado"
                  className="w-full px-4 py-3"
                />
              </form>
            </div>
          ) : null}

          {mode !== "code" ? (
            <div className="app-card p-6 shadow-contrast">
              <h3 className="text-base font-semibold text-slate-900">Web preview</h3>
              <p className="mt-1 text-sm text-slate-600">
                Preview de template para el tipo actual: {invoice.theme}
              </p>
              <iframe
                title={`invoice-preview-${invoice.id}`}
                sandbox=""
                className="mt-4 h-[640px] w-full rounded-2xl border border-slate-200 bg-white"
                srcDoc={previewHtml}
              />
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
