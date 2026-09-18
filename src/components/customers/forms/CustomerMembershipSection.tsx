import CollapsibleSection from "@/components/ui/CollapsibleSection";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import InlineActionButton from "@/components/customers/InlineActionButton";
import SendServiceStartModal from "@/components/customers/SendServiceStartModal";
import type { ServiceTierOption, Translator } from "./types";

export type MembershipFeeBreakdown = {
  baseCents: number;
  feeCents: number;
  totalCents: number;
};

export type MembershipSummary = {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  amountCents: number;
  baseAmountCents: number | null;
  feeAmountCents: number | null;
};

export type MembershipPropertySummary = {
  id: string;
  label: string;
  paymentDay: number | null;
  servicePrice: number | null;
};

/** Acción invocada desde el cliente: devuelve el mensaje ya traducido. */
type InlineAction = (formData: FormData) => Promise<{ error?: string } | undefined>;

type CustomerMembershipSectionProps = {
  t: Translator;
  customerId: string;
  customerName: string;
  property: MembershipPropertySummary | null;
  membership: MembershipSummary | null;
  draftContractId: string | null;
  currentPlanId: string | null;
  currentPlanName: string | null;
  planOptions: ServiceTierOption[];
  feeBreakdown: MembershipFeeBreakdown | null;
  formatCurrency: (value: number) => string;
  cancelAction: (formData: FormData) => Promise<void>;
  applyFeeAction: InlineAction;
  updatePlanAction: InlineAction;
  sendAction: InlineAction;
};

const CENTS_PER_UNIT = 100;

export default function CustomerMembershipSection({
  t,
  customerId,
  customerName,
  property,
  membership,
  draftContractId,
  currentPlanId,
  currentPlanName,
  planOptions,
  feeBreakdown,
  formatCurrency,
  cancelAction,
  applyFeeAction,
  updatePlanAction,
  sendAction,
}: CustomerMembershipSectionProps) {
  const hasBillableProperty = Boolean(property && property.servicePrice != null);

  return (
    <div className="min-w-0">
      <CollapsibleSection
        className="h-full"
        title={t("admin.customers.detail.sections.membershipTitle")}
        subtitle={t("admin.customers.detail.sections.membershipSubtitle")}
      >
        {!property || !hasBillableProperty ? (
          <p className="text-sm text-slate-500">
            {t("admin.customers.detail.membership.noServicePrice")}
          </p>
        ) : membership ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                className="app-chip px-2.5 py-0.5 text-[11px] font-semibold"
                data-tone={membership.status === "ACTIVE" ? "success" : "warning"}
              >
                {membership.cancelAtPeriodEnd
                  ? t("admin.customers.detail.membership.statusCanceling")
                  : membership.status}
              </span>
              <p className="text-sm font-semibold text-slate-900">
                {formatCurrency(membership.amountCents / CENTS_PER_UNIT)}
                /{t("client.invoices.membership.perMonth")}
              </p>
            </div>
            {membership.baseAmountCents != null && membership.feeAmountCents != null ? (
              <p className="mt-1.5 text-xs text-slate-500">
                {t("admin.customers.detail.membership.breakdown", {
                  service: formatCurrency(membership.baseAmountCents / CENTS_PER_UNIT),
                  fee: formatCurrency(membership.feeAmountCents / CENTS_PER_UNIT),
                })}
              </p>
            ) : (
              <div className="mt-3">
                <InlineActionButton
                  action={applyFeeAction}
                  fields={{ membershipId: membership.id, customerId }}
                  label={t("admin.customers.detail.membership.addFee")}
                  pendingLabel={t("common.feedback.saving")}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:border-amber-400"
                />
              </div>
            )}
            {!membership.cancelAtPeriodEnd ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={cancelAction}>
                  <input type="hidden" name="membershipId" value={membership.id} />
                  <input type="hidden" name="customerId" value={customerId} />
                  <input type="hidden" name="mode" value="period_end" />
                  <FormSubmitButton
                    idleLabel={t("admin.customers.detail.membership.cancelPeriodEnd")}
                    pendingLabel={t("common.feedback.saving")}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                  />
                </form>
                <form action={cancelAction}>
                  <input type="hidden" name="membershipId" value={membership.id} />
                  <input type="hidden" name="customerId" value={customerId} />
                  <input type="hidden" name="mode" value="immediate" />
                  <FormSubmitButton
                    idleLabel={t("admin.customers.detail.membership.cancelImmediate")}
                    pendingLabel={t("common.feedback.saving")}
                    className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300"
                  />
                </form>
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-600">
              {t("admin.customers.detail.membership.notActive")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SendServiceStartModal
                customerId={customerId}
                customerName={customerName}
                propertyId={property.id}
                propertyLabel={property.label}
                contractId={draftContractId}
                hasActiveMembership={false}
                currentPlanId={currentPlanId}
                currentPlanName={currentPlanName}
                planOptions={planOptions}
                feeBreakdown={feeBreakdown}
                paymentDay={property.paymentDay}
                triggerLabel={t("admin.customers.detail.membership.sendStartEmail")}
                triggerClassName="app-button-primary px-4 py-2 text-xs font-semibold"
                updatePlanAction={updatePlanAction}
                sendAction={sendAction}
              />
              <a
                href={`/api/admin/memberships/checkout?customerId=${customerId}&propertyId=${property.id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-slate-600 underline"
              >
                {t("admin.customers.detail.membership.sendSetupLink")}
              </a>
            </div>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
