import { revalidatePath } from "next/cache";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ActionFeedbackToast from "@/components/ui/ActionFeedbackToast";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { getAssetUrl } from "@/lib/assets";
import PdfPreviewLink from "@/components/ui/PdfPreviewLink";
import { getRequestLocale, getTranslations } from "@/i18n/server";
import { formatInBusinessTimeZone } from "@/lib/timezone";
import { cancelMembership } from "@/lib/payments/cancel";
import { revalidateAttentionPaths } from "@/lib/reports/revalidate";

async function cancelMembershipAction(formData: FormData) {
  "use server";
  const session = await requireRole("CUSTOMER");
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) {
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { customer: { select: { userId: true } } },
  });
  if (!membership || membership.customer.userId !== session.sub) {
    return;
  }

  await cancelMembership(membershipId, "period_end");
  revalidatePath("/client/invoices");
  revalidateAttentionPaths();
}

type ClientInvoicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientInvoicesPage({
  searchParams,
}: ClientInvoicesPageProps) {
  const session = await requireRole("CUSTOMER");
  const t = await getTranslations();
  const locale = await getRequestLocale();
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const paymentFeedback = resolvedSearchParams?.payment;
  const membershipFeedback = resolvedSearchParams?.membership;

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: {
      invoices: { orderBy: { createdAt: "desc" } },
      properties: {
        select: { id: true, name: true, address: true, servicePrice: true },
      },
      memberships: {
        where: { status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
        orderBy: { createdAt: "desc" },
      },
    },
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
      {paymentFeedback === "success" ? (
        <ActionFeedbackToast
          message={t("client.invoices.feedback.paymentSuccess")}
          dismissLabel={t("common.actions.close")}
        />
      ) : paymentFeedback === "error" ? (
        <ActionFeedbackToast
          tone="error"
          message={t("client.invoices.feedback.paymentError")}
          dismissLabel={t("common.actions.close")}
        />
      ) : null}
      {membershipFeedback === "success" ? (
        <ActionFeedbackToast
          message={t("client.invoices.feedback.membershipSuccess")}
          dismissLabel={t("common.actions.close")}
        />
      ) : membershipFeedback === "already-active" ? (
        <ActionFeedbackToast
          tone="error"
          message={t("client.invoices.feedback.membershipAlreadyActive")}
          dismissLabel={t("common.actions.close")}
        />
      ) : membershipFeedback === "error" ? (
        <ActionFeedbackToast
          tone="error"
          message={t("client.invoices.feedback.membershipError")}
          dismissLabel={t("common.actions.close")}
        />
      ) : null}

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
                    {formatInBusinessTimeZone(invoice.createdAt, locale, {
                      dateStyle: "short",
                    })}
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
                <div className="flex items-center gap-3">
                  {invoice.pdfUrl ? (
                    <PdfPreviewLink
                      href={`${getAssetUrl(invoice.pdfUrl)}?v=${invoice.updatedAt.getTime()}`}
                      label={t("client.invoices.list.viewPdf")}
                      title={invoice.number}
                      closeLabel={t("common.actions.close")}
                      className="text-xs text-slate-600 underline"
                    />
                  ) : null}
                  {invoice.status !== "PAID" ? (
                    <a
                      href={`/api/client/invoices/${invoice.id}/checkout`}
                      className="app-button-primary px-3 py-1.5 text-xs font-semibold"
                    >
                      {t("client.invoices.list.payNow")}
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="app-card mt-6 p-6 shadow-contrast">
        <h2 className="text-lg font-semibold">
          {t("client.invoices.membership.title")}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t("client.invoices.membership.subtitle")}
        </p>

        <div className="mt-4 space-y-3">
          {customer.properties
            .filter((property) => property.servicePrice !== null)
            .map((property) => {
              const membership = customer.memberships.find(
                (item) => item.propertyId === property.id
              );
              return (
                <div
                  key={property.id}
                  className="app-callout flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {property.name ?? property.address}
                    </p>
                    <p className="text-xs text-slate-500">
                      ${Number(property.servicePrice).toFixed(2)}/
                      {t("client.invoices.membership.perMonth")}
                    </p>
                  </div>
                  {membership ? (
                    <div className="flex items-center gap-3">
                      <span
                        className="app-chip px-2.5 py-0.5 text-[11px] font-semibold"
                        data-tone={
                          membership.status === "ACTIVE" ? "success" : "warning"
                        }
                      >
                        {membership.cancelAtPeriodEnd
                          ? t("client.invoices.membership.statusCanceling")
                          : membership.status}
                      </span>
                      {!membership.cancelAtPeriodEnd ? (
                        <form action={cancelMembershipAction}>
                          <input
                            type="hidden"
                            name="membershipId"
                            value={membership.id}
                          />
                          <button
                            type="submit"
                            className="text-xs font-semibold text-rose-600 underline"
                          >
                            {t("client.invoices.membership.cancel")}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    <Link
                      href={`/client/membership/activate?propertyId=${property.id}`}
                      className="app-button-secondary px-3 py-1.5 text-xs font-semibold"
                    >
                      {t("client.invoices.membership.activate")}
                    </Link>
                  )}
                </div>
              );
            })}
          {customer.properties.filter((property) => property.servicePrice !== null)
            .length === 0 ? (
            <p className="text-sm text-slate-500">
              {t("client.invoices.membership.empty")}
            </p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
