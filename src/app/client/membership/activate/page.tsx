import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ClientContractSignForm from "@/components/contracts/ClientContractSignForm";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { computeMembershipFeeCents, MEMBERSHIP_TRANSACTION_FEE_PERCENT } from "@/lib/payments/fees";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MembershipActivatePage({ searchParams }: PageProps) {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const propertyIdParam = resolvedSearchParams?.propertyId;
  const propertyId = Array.isArray(propertyIdParam) ? propertyIdParam[0] : propertyIdParam;
  const feedback = resolvedSearchParams?.membership;

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });

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

  const property = propertyId
    ? await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, name: true, address: true, servicePrice: true, customerId: true },
      })
    : null;

  if (!customer || !property || property.customerId !== customer.id || property.servicePrice === null) {
    return (
      <AppShell title={t("client.membershipActivate.title")} subtitle="" role="CUSTOMER">
        <section className="app-card p-6 shadow-contrast">
          <p className="text-sm text-slate-500">{t("client.membershipActivate.invalidProperty")}</p>
        </section>
      </AppShell>
    );
  }

  const existingMembership = await prisma.membership.findFirst({
    where: {
      customerId: customer.id,
      propertyId: property.id,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
  });

  const pendingContract = customer.serviceContracts.find((contract) => contract.status === "SENT");

  const { baseCents, feeCents, totalCents } = computeMembershipFeeCents(
    Math.round(Number(property.servicePrice) * 100)
  );

  return (
    <AppShell title={t("client.membershipActivate.title")} subtitle={t("client.membershipActivate.subtitle")} role="CUSTOMER">
      {feedback === "cancelled" ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("client.membershipActivate.feedback.cancelled")}
        </div>
      ) : feedback === "error" ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {t("client.membershipActivate.feedback.error")}
        </div>
      ) : null}

      {existingMembership ? (
        <section className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">{t("client.membershipActivate.alreadyActive.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("client.membershipActivate.alreadyActive.subtitle")}
          </p>
          <Link
            href="/client/invoices"
            className="app-button-primary mt-4 inline-flex px-4 py-2 text-xs font-semibold"
          >
            {t("client.membershipActivate.alreadyActive.viewLink")}
          </Link>
        </section>
      ) : pendingContract ? (
        <section className="app-card p-6 shadow-contrast">
          <h2 className="text-lg font-semibold">{t("client.membershipActivate.contractStep.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("client.membershipActivate.contractStep.subtitle")}
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {pendingContract.pdfUrl ? (
              <iframe
                src={`/api/client/contract/${pendingContract.id}/pdf?v=${pendingContract.updatedAt.getTime()}`}
                title={t("client.contract.viewFullContract")}
                className="h-[55vh] max-h-[520px] w-full border-0 bg-white"
              />
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {t("admin.customers.detail.contract.pdfUnavailable")}
              </p>
            )}
          </div>

          {pendingContract.pdfUrl ? (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-800">{t("client.contract.signHere")}</h3>
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
          <h2 className="text-lg font-semibold">{t("client.membershipActivate.payStep.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("client.membershipActivate.payStep.subtitle", {
              address: property.name ?? property.address,
            })}
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{t("client.membershipActivate.payStep.service")}</span>
              <span>{currencyFormatter.format(baseCents / 100)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm text-slate-600">
              <span>
                {t("client.membershipActivate.payStep.fee", {
                  percent: String(MEMBERSHIP_TRANSACTION_FEE_PERCENT),
                })}
              </span>
              <span>{currencyFormatter.format(feeCents / 100)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
              <span>{t("client.membershipActivate.payStep.total")}</span>
              <span>
                {currencyFormatter.format(totalCents / 100)}/{t("client.invoices.membership.perMonth")}
              </span>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {t("client.membershipActivate.payStep.consent")}
          </div>

          <a
            href={`/api/client/memberships/checkout?propertyId=${property.id}`}
            className="app-button-primary mt-5 inline-flex px-5 py-2.5 text-sm font-semibold"
          >
            {t("client.membershipActivate.payStep.continue")}
          </a>
        </section>
      )}
    </AppShell>
  );
}
