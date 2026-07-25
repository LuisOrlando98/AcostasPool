import AppShell from "@/components/layout/AppShell";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { formatInBusinessTimeZone } from "@/lib/timezone";
import ClientContractSignForm from "@/components/contracts/ClientContractSignForm";

export default async function ClientContractPage() {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: {
      id: true,
      serviceContracts: {
        orderBy: [{ periodMonth: "desc" }, { createdAt: "desc" }],
        take: 12,
      },
    },
  });

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });

  if (!customer) {
    return (
      <AppShell title={t("client.contract.title")} subtitle={t("client.contract.subtitle")} role="CUSTOMER">
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("client.invoices.emptyProfile")}</p>
        </section>
      </AppShell>
    );
  }

  const pendingContract = customer.serviceContracts.find(
    (contract) => contract.status === "SENT"
  );
  const history = customer.serviceContracts.filter(
    (contract) => contract.id !== pendingContract?.id
  );

  return (
    <AppShell title={t("client.contract.title")} subtitle={t("client.contract.subtitle")} role="CUSTOMER">
      {pendingContract ? (
        <section className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">{t("client.contract.pending.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("client.contract.pending.subtitle")}</p>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.customers.detail.financials.fields.plan")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {pendingContract.planNameSnapshot ?? t("common.labels.notAvailable")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.invoices.servicePayment.fields.servicePrice")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {pendingContract.servicePriceSnapshot != null
                  ? currencyFormatter.format(Number(pendingContract.servicePriceSnapshot))
                  : t("common.labels.notAvailable")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.invoices.servicePayment.fields.paymentDay")}
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {pendingContract.paymentDaySnapshot
                  ? t("admin.invoices.servicePayment.dayOfMonth", {
                      day: String(pendingContract.paymentDaySnapshot),
                    })
                  : t("common.labels.notAvailable")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {t("admin.invoices.servicePayment.fields.paymentType")}
              </dt>
              <dd className="mt-1 text-sm text-slate-700">
                {pendingContract.paymentTypeSnapshot
                  ? t(
                      `admin.invoices.servicePayment.paymentTypes.${pendingContract.paymentTypeSnapshot}`
                    )
                  : t("common.labels.notAvailable")}
              </dd>
            </div>
          </dl>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {pendingContract.pdfUrl ? (
              <>
                <iframe
                  src={`/api/client/contract/${pendingContract.id}/pdf?v=${pendingContract.updatedAt.getTime()}`}
                  title={t("client.contract.viewFullContract")}
                  className="h-[60vh] max-h-[600px] w-full border-0 bg-white"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
                  <p className="text-xs text-slate-500">
                    {t("admin.customers.detail.contract.previewHint")}
                  </p>
                  <a
                    href={`/api/client/contract/${pendingContract.id}/pdf?v=${pendingContract.updatedAt.getTime()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    {t("admin.customers.detail.contract.openNewTab")}
                  </a>
                </div>
              </>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {t("admin.customers.detail.contract.pdfUnavailable")}
              </p>
            )}
          </div>

          {pendingContract.pdfUrl ? (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-800">
                {t("client.contract.signHere")}
              </h3>
              <ClientContractSignForm
                contractId={pendingContract.id}
                hint={t("client.contract.signHint")}
                clearLabel={t("admin.customers.detail.contract.clearSignature")}
                submitIdleLabel={t("client.contract.signAction")}
                submitPendingLabel={t("admin.customers.detail.contract.signing")}
                missingSignatureLabel={t("admin.customers.detail.contract.missingSignature")}
                errorLabel={t("client.contract.signError")}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("client.contract.noPending")}</p>
        </section>
      )}

      {history.length > 0 ? (
        <section className="app-card mt-6 p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">{t("client.contract.history")}</h2>
          <div className="mt-4 space-y-3 text-sm">
            {history.map((contract) => (
              <div
                key={contract.id}
                className="app-callout flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {formatInBusinessTimeZone(contract.periodMonth, locale, {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t(`admin.customers.detail.contract.status.${contract.status}`)}
                  </p>
                </div>
                {contract.pdfUrl ? (
                  <a
                    href={`/api/client/contract/${contract.id}/pdf?v=${contract.updatedAt.getTime()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-600 underline"
                  >
                    {t("client.invoices.list.viewPdf")}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
