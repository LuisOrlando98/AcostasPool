import Link from "next/link";
import { revalidatePath } from "next/cache";
import AppShell from "@/components/layout/AppShell";
import Badge from "@/components/ui/Badge";
import InvoiceEditForm from "@/components/invoices/InvoiceEditForm";
import InvoicePaymentsPanel from "@/components/invoices/InvoicePaymentsPanel";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { resolveParams } from "@/lib/utils/params";
import { formatCustomerAddress, formatCustomerName } from "@/lib/customers/format";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { normalizeInvoiceLineItems, roundCurrency } from "@/lib/invoices/line-items";
import {
  recordPayment,
  markInvoicePaid,
  toCents,
  STRIPE_MINIMUM_CHARGE_USD,
} from "@/lib/payments/service";
import {
  normalizePaymentMethod,
  PAYMENT_METHOD_VALUES,
} from "@/lib/customers/financial-info";
import {
  getInvoiceTemplateLocaleCopy,
  localizeInvoiceTemplate,
  normalizeInvoiceTemplateConfig,
  renderInvoiceTemplateHtml,
  resolveInvoiceTemplateLocale,
} from "@/lib/invoice-template";
import {
  getInvoiceTemplateConfig,
  type SiteInvoiceTemplateConfig,
} from "@/lib/site-settings";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { formatInBusinessTimeZone } from "@/lib/timezone";

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

function money(cents: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const STATUS_TONE: Record<InvoiceStatus, "neutral" | "info" | "success" | "danger"> = {
  DRAFT: "neutral",
  SENT: "info",
  PAID: "success",
  OVERDUE: "danger",
};

function parseEditorMode(value: string | undefined) {
  if (value === "editor" || value === "code" || value === "web") {
    return value === "code" ? "editor" : value;
  }
  if (value === "split") {
    return value;
  }
  return "split";
}

async function updateInvoice(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  "use server";
  await requireRole("ADMIN");
  const t = await getTranslations();

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
    return { error: t("admin.invoices.editor.errors.numberRequired") };
  }

  const currentInvoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
    },
  });
  if (!currentInvoice) {
    return { error: t("admin.invoices.new.errors.customerNotFound") };
  }

  const isLocked = Boolean(currentInvoice.sentAt);
  if (isLocked) {
    return { error: t("admin.invoices.editor.errors.locked") };
  }

  let parsedLineItems: unknown = null;
  try {
    parsedLineItems = JSON.parse(lineItemsRaw);
  } catch {
    return { error: t("admin.invoices.new.errors.invalidLineItems") };
  }
  const lineItems = normalizeInvoiceLineItems(parsedLineItems);
  if (lineItems.length === 0) {
    return { error: t("admin.invoices.new.errors.lineItemsRequired") };
  }

  const subtotal = roundCurrency(lineItems.reduce((sum, item) => sum + item.amount, 0));
  const total = roundCurrency(subtotal + tax);
  if (total < STRIPE_MINIMUM_CHARGE_USD) {
    return {
      error: t("admin.invoices.new.errors.belowMinimum", {
        amount: STRIPE_MINIMUM_CHARGE_USD.toFixed(2),
      }),
    };
  }

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
  let pdfUrl: string;
  try {
    pdfUrl = await generateInvoicePdf({
      customerId: currentInvoice.customerId,
      invoiceNumber: number,
      issueDate: currentInvoice.createdAt,
      customerName: formatCustomerName(currentInvoice.customer),
      customerEmail: currentInvoice.customer.email,
      customerPhone: currentInvoice.customer.telefono,
      customerAddress: formatCustomerAddress(currentInvoice.customer),
      items: lineItems,
      subtotal,
      tax,
      total,
      notes: notesRaw || null,
      locale: currentInvoice.customer.idiomaPreferencia,
      theme,
      template,
    });
  } catch (error) {
    console.error(`[invoices] Failed to regenerate PDF for ${invoiceId}`, error);
    return { error: t("admin.invoices.new.errors.pdfFailed") };
  }

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

async function recordManualPaymentAction(
  formData: FormData
): Promise<{ error?: string } | undefined> {
  "use server";
  const session = await requireRole("ADMIN");
  const t = await getTranslations();

  const invoiceId = String(formData.get("invoiceId") ?? "");
  const amountRaw = Number(String(formData.get("amount") ?? "0"));
  const methodRaw = String(formData.get("method") ?? "").trim();
  const method = normalizePaymentMethod(methodRaw);

  if (!invoiceId || !Number.isFinite(amountRaw) || amountRaw <= 0) {
    return { error: t("admin.invoices.payments.errors.invalidAmount") };
  }
  if (!method) {
    return { error: t("admin.invoices.payments.errors.invalidMethod") };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { select: { amountCents: true } } },
  });
  if (!invoice) {
    return { error: t("admin.invoices.new.errors.customerNotFound") };
  }

  const paidAt = new Date();
  const newAmountCents = toCents(amountRaw);
  await recordPayment({
    customerId: invoice.customerId,
    invoiceId: invoice.id,
    amountCents: newAmountCents,
    status: "SUCCEEDED",
    method,
    recordedByUserId: session.sub,
    paidAt,
  });

  const paidSoFarCents =
    invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0) + newAmountCents;
  if (paidSoFarCents >= toCents(Number(invoice.total))) {
    await markInvoicePaid(invoice.id, paidAt);
  }

  revalidatePath(`/admin/invoices/${invoiceId}`);
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/customers/${invoice.customerId}`);
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
      <AppShell
        title={t("admin.invoices.editor.notFoundTitle")}
        subtitle={t("admin.invoices.editor.notFoundSubtitle")}
        role="ADMIN"
      >
        <Link href="/admin/invoices" className="text-sm text-slate-600 underline">
          {t("admin.invoices.editor.back")}
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
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) {
    return (
      <AppShell
        title={t("admin.invoices.editor.notFoundTitle")}
        subtitle={t("admin.invoices.editor.notFoundSubtitle")}
        role="ADMIN"
      >
        <Link href="/admin/invoices" className="text-sm text-slate-600 underline">
          {t("admin.invoices.editor.back")}
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

  const normalizedLineItems = normalizeInvoiceLineItems(invoice.lineItems);
  const template = await getInvoiceTemplateConfig();
  const invoiceLocale = resolveInvoiceTemplateLocale(invoice.customer.idiomaPreferencia);
  const localeCopy = getInvoiceTemplateLocaleCopy(invoiceLocale);
  const localizedTemplate = localizeInvoiceTemplate(
    normalizeInvoiceTemplateConfig(template as SiteInvoiceTemplateConfig),
    invoiceLocale
  );
  const previewHtml = renderInvoiceTemplateHtml({
    template: localizedTemplate,
    theme: invoice.theme,
    locale: invoiceLocale,
    invoiceNumber: invoice.number,
    issueDateLabel: formatInBusinessTimeZone(
      invoice.createdAt,
      localeCopy.intlLocale,
      { dateStyle: "short" }
    ),
    customerName: formatCustomerName(invoice.customer),
    customerAddress: formatCustomerAddress(invoice.customer),
    customerEmail: invoice.customer.email,
    customerPhone: invoice.customer.telefono,
    items: normalizedLineItems,
    subtotal: Number(invoice.subtotal),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    notes: invoice.notes,
  });
  const lineItemsSeed =
    normalizedLineItems.length > 0
      ? normalizedLineItems
      : [{
          label: t("admin.invoices.editor.defaults.service"),
          quantity: 1,
          unitPrice: Number(invoice.subtotal),
          amount: Number(invoice.subtotal),
        }];

  const modeHref = (nextMode: "editor" | "web" | "split") =>
    `/admin/invoices/${invoice.id}?mode=${nextMode}`;
  const isLocked = Boolean(invoice.sentAt);
  const lockedTitle = t("admin.invoices.editor.locked.title");
  const lockedDescription = t("admin.invoices.editor.locked.description");
  const lockedSentAtLabel = t("admin.invoices.editor.locked.sentOn");
  const previewPdfUrl = invoice.pdfUrl?.trim()
    ? `${invoice.pdfUrl}?v=${invoice.updatedAt.getTime()}`
    : null;

  const editorLabel = t("admin.invoices.editor.modes.editor");
  const previewLabel = t("admin.invoices.editor.modes.preview");
  const splitLabel = t("admin.invoices.editor.modes.split");

  const statusLabels: Record<InvoiceStatus, string> = {
    DRAFT: t("admin.invoices.status.draft"),
    SENT: t("admin.invoices.status.sent"),
    PAID: t("admin.invoices.status.paid"),
    OVERDUE: t("admin.invoices.status.overdue"),
  };
  const totalCentsValue = toCents(Number(invoice.total));
  const paidSoFarCents = invoice.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const balanceCents = Math.max(0, totalCentsValue - paidSoFarCents);
  const isFullyPaid = invoice.status === "PAID" || balanceCents === 0;

  return (
    <AppShell
      title={t("admin.invoices.editor.title", { number: invoice.number })}
      subtitle={t("admin.invoices.subtitle")}
      role="ADMIN"
    >
      <section className="space-y-6">
        <div className="app-card p-5 shadow-contrast">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                {t("admin.invoices.editor.kicker")}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">{invoice.number}</h2>
              <p className="text-xs text-slate-500">
                {formatCustomerName(invoice.customer)} -{" "}
                {formatInBusinessTimeZone(invoice.createdAt, locale, {
                  dateStyle: "short",
                })}
              </p>
            </div>
            <div className="ui-segment">
              <Link
                href={modeHref("editor")}
                className={`ui-segment-item ${mode === "editor" ? "is-active" : ""}`}
              >
                {editorLabel}
              </Link>
              <Link
                href={modeHref("web")}
                className={`ui-segment-item ${mode === "web" ? "is-active" : ""}`}
              >
                {previewLabel}
              </Link>
              <Link
                href={modeHref("split")}
                className={`ui-segment-item ${mode === "split" ? "is-active" : ""}`}
              >
                {splitLabel}
              </Link>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("admin.invoices.editor.hero.status")}
              </p>
              <div className="mt-1.5">
                <Badge label={statusLabels[invoice.status]} tone={STATUS_TONE[invoice.status]} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("admin.invoices.editor.hero.total")}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {money(totalCentsValue, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("admin.invoices.editor.hero.paid")}
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-600">
                {money(paidSoFarCents, locale)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {t("admin.invoices.editor.hero.balance")}
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  isFullyPaid ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isFullyPaid ? t("admin.invoices.editor.hero.fullyPaid") : money(balanceCents, locale)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {mode !== "web" ? (
            <div className="app-card p-6 shadow-contrast">
              {isLocked ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">{lockedTitle}</p>
                  <p className="mt-1">{lockedDescription}</p>
                  {invoice.sentAt ? (
                    <p className="mt-1 text-xs text-amber-800">
                      {lockedSentAtLabel}:{" "}
                      {formatInBusinessTimeZone(invoice.sentAt, locale, {
                        dateStyle: "short",
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <InvoiceEditForm
                invoiceId={invoice.id}
                defaultNumber={invoice.number}
                defaultStatus={invoice.status}
                defaultTheme={invoice.theme}
                defaultJobId={invoice.jobId}
                defaultNotes={invoice.notes}
                defaultTax={Number(invoice.tax)}
                jobs={jobs.map((job) => ({
                  id: job.id,
                  scheduledDate: job.scheduledDate.toISOString(),
                  technicianName:
                    job.technician?.user.fullName ??
                    t("admin.invoices.list.noTech"),
                }))}
                initialLineItems={lineItemsSeed}
                locked={isLocked}
                updateInvoiceAction={updateInvoice}
              />
            </div>
          ) : null}

          {mode !== "editor" ? (
            <div className="app-card p-6 shadow-contrast">
              <h3 className="text-base font-semibold text-slate-900">
                {t("admin.invoices.editor.preview.title")}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {t("admin.invoices.editor.preview.subtitle", {
                  theme:
                    invoice.theme === "SPECIAL"
                      ? t("admin.invoices.theme.special")
                      : invoice.theme === "ESTIMATE"
                        ? t("admin.invoices.theme.estimate")
                        : t("admin.invoices.theme.standard"),
                })}
              </p>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mx-auto w-full max-w-[860px]">
                  <div className="relative aspect-[210/297] w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                    <iframe
                      title={`invoice-preview-${invoice.id}`}
                      sandbox={previewPdfUrl ? undefined : ""}
                      className="absolute inset-0 h-full w-full border-0 bg-white"
                      src={previewPdfUrl ?? undefined}
                      srcDoc={previewPdfUrl ? undefined : previewHtml}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <InvoicePaymentsPanel
          invoiceId={invoice.id}
          isPaid={invoice.status === "PAID"}
          totalCents={toCents(Number(invoice.total))}
          payments={invoice.payments.map((payment) => ({
            id: payment.id,
            amountCents: payment.amountCents,
            status: payment.status,
            method: payment.method,
            paidAt: payment.paidAt.toISOString(),
            stripePaymentIntentId: payment.stripePaymentIntentId,
            recordedByUserId: payment.recordedByUserId,
          }))}
          paymentMethods={PAYMENT_METHOD_VALUES}
          sendPaymentLinkHref={`/api/admin/invoices/${invoice.id}/checkout`}
          recordManualPaymentAction={recordManualPaymentAction}
        />
      </section>
    </AppShell>
  );
}
