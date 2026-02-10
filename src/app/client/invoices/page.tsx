import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getAssetUrl } from "@/lib/assets";
import { getRequestLocale, getTranslations } from "@/i18n/server";

export default async function ClientInvoicesPage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: { invoices: { orderBy: { createdAt: "desc" } } },
  });

  if (!customer) {
    return (
      <AppShell
        title={t("client.invoices.title")}
        subtitle={t("client.invoices.subtitle")}
        role="CUSTOMER"
      >
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">
            {t("client.invoices.emptyProfile")}
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("client.invoices.title")}
      subtitle={t("client.invoices.subtitle")}
      role="CUSTOMER"
    >
      <section className="app-card p-6 shadow-contrast">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("client.invoices.list.title")}
          </h2>
          <span className="text-xs text-slate-400">
            {t("client.invoices.list.total", {
              count: customer.invoices.length,
            })}
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {customer.invoices.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("client.invoices.list.empty")}
            </p>
          ) : (
            customer.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="app-callout flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{invoice.number}</p>
                  <p className="text-xs text-slate-500">
                    {invoice.createdAt.toLocaleDateString(locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    ${invoice.total.toFixed(2)}
                  </p>
                  <span
                    className="app-chip mt-1 inline-flex px-2.5 py-0.5 text-[11px] font-semibold"
                    data-tone={
                      invoice.status === "PAID"
                        ? "success"
                        : invoice.status === "OVERDUE"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {invoice.status}
                  </span>
                </div>
                {invoice.pdfUrl ? (
                  <a
                    href={getAssetUrl(invoice.pdfUrl)}
                    className="text-xs text-slate-600 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("client.invoices.list.viewPdf")}
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </AppShell>
  );
}
