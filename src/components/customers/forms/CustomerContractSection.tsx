import CollapsibleSection from "@/components/ui/CollapsibleSection";
import FormSubmitButton from "@/components/ui/FormSubmitButton";
import SendServiceStartModal from "@/components/customers/SendServiceStartModal";
import ContractViewerModal from "./ContractViewerModal";
import type {
  MembershipFeeBreakdown,
  MembershipPropertySummary,
} from "./CustomerMembershipSection";
import type { ServiceTierOption, Translator } from "./types";

export type ContractSummary = {
  id: string;
  status: string;
  /** Mes y año del periodo, ya formateados en la zona horaria del negocio. */
  periodLabel: string;
  pdfHref: string | null;
  pdfError: string | null;
  hasCompanySignature: boolean;
  /** Fecha y vía de firma ya compuestas, o null si aún no está firmado. */
  signedSummary: string | null;
};

type InlineAction = (formData: FormData) => Promise<{ error?: string } | undefined>;

type CustomerContractSectionProps = {
  t: Translator;
  customerId: string;
  customerName: string;
  latestContract: ContractSummary | null;
  history: ContractSummary[];
  property: MembershipPropertySummary | null;
  hasActiveMembership: boolean;
  currentPlanId: string | null;
  currentPlanName: string | null;
  planOptions: ServiceTierOption[];
  feeBreakdown: MembershipFeeBreakdown | null;
  generateAction: (formData: FormData) => Promise<void>;
  signAction: (formData: FormData) => Promise<void>;
  updatePlanAction: InlineAction;
  sendAction: InlineAction;
};

const SIGNED_STATUS = "SIGNED";
const DRAFT_STATUS = "DRAFT";

function statusBadgeClass(status: string) {
  if (status === SIGNED_STATUS) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "SENT") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export default function CustomerContractSection({
  t,
  customerId,
  customerName,
  latestContract,
  history,
  property,
  hasActiveMembership,
  currentPlanId,
  currentPlanName,
  planOptions,
  feeBreakdown,
  generateAction,
  signAction,
  updatePlanAction,
  sendAction,
}: CustomerContractSectionProps) {
  const isSigned = latestContract?.status === SIGNED_STATUS;

  return (
    <div className="min-w-0 2xl:col-span-2">
      <CollapsibleSection
        title={t("admin.customers.detail.sections.contractTitle")}
        subtitle={t("admin.customers.detail.sections.contractSubtitle")}
        headerExtra={
          latestContract ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t("admin.customers.detail.contract.period", {
                  month: latestContract.periodLabel,
                })}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${statusBadgeClass(
                  latestContract.status
                )}`}
              >
                {t(`admin.customers.detail.contract.status.${latestContract.status}`)}
              </span>
            </div>
          ) : null
        }
      >
        {!latestContract ? (
          <div>
            <p className="text-sm text-slate-500">
              {t("admin.customers.detail.contract.noContract")}
            </p>
            <form action={generateAction} className="mt-3">
              <input type="hidden" name="customerId" value={customerId} />
              <FormSubmitButton
                idleLabel={t("admin.customers.detail.contract.generate")}
                pendingLabel={t("admin.customers.detail.contract.generating")}
                className="px-4 py-2 text-xs"
              />
            </form>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {latestContract.pdfHref ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {t("admin.customers.detail.contract.documentPreview")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isSigned
                        ? latestContract.signedSummary
                        : t("admin.customers.detail.contract.previewHint")}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        latestContract.hasCompanySignature
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {latestContract.hasCompanySignature
                        ? t("admin.customers.detail.contract.companySignatureIncluded")
                        : t("admin.customers.detail.contract.companySignatureMissing")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={generateAction}>
                      <input type="hidden" name="customerId" value={customerId} />
                      <FormSubmitButton
                        idleLabel={
                          latestContract.status === DRAFT_STATUS
                            ? t("admin.customers.detail.contract.refreshDraft")
                            : t("admin.customers.detail.contract.generateNew")
                        }
                        pendingLabel={t("admin.customers.detail.contract.generating")}
                        className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                      />
                    </form>
                    {latestContract.status === DRAFT_STATUS && property ? (
                      <SendServiceStartModal
                        customerId={customerId}
                        customerName={customerName}
                        propertyId={property.id}
                        propertyLabel={property.label}
                        contractId={latestContract.id}
                        hasActiveMembership={hasActiveMembership}
                        currentPlanId={currentPlanId}
                        currentPlanName={currentPlanName}
                        planOptions={planOptions}
                        feeBreakdown={feeBreakdown}
                        paymentDay={property.paymentDay}
                        triggerLabel={t("admin.customers.detail.contract.send")}
                        triggerClassName="rounded-full bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                        updatePlanAction={updatePlanAction}
                        sendAction={sendAction}
                      />
                    ) : null}
                    <ContractViewerModal
                      contractId={latestContract.id}
                      customerId={customerId}
                      customerName={customerName}
                      periodLabel={t("admin.customers.detail.contract.period", {
                        month: latestContract.periodLabel,
                      })}
                      isSigned={isSigned}
                      signedSummary={latestContract.signedSummary}
                      pdfHref={latestContract.pdfHref}
                      triggerLabel={
                        isSigned
                          ? t("admin.customers.detail.contract.viewContract")
                          : t("admin.customers.detail.contract.viewAndSign")
                      }
                      signAction={signAction}
                    />
                  </div>
                </div>
              ) : (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-slate-500">
                    {t("admin.customers.detail.contract.pdfUnavailable")}
                  </p>
                  {latestContract.pdfError ? (
                    <p
                      role="alert"
                      className="mx-auto mt-3 max-w-xl rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left font-mono text-[11px] text-rose-700"
                    >
                      {latestContract.pdfError}
                    </p>
                  ) : null}
                  <form action={generateAction} className="mt-4">
                    <input type="hidden" name="customerId" value={customerId} />
                    <FormSubmitButton
                      idleLabel={t("admin.customers.detail.contract.retryGenerate")}
                      pendingLabel={t("admin.customers.detail.contract.generating")}
                      className="px-4 py-2 text-xs"
                    />
                  </form>
                </div>
              )}
            </div>

            {history.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t("admin.customers.detail.contract.history")}
                </p>
                <ul className="mt-2 space-y-2">
                  {history.map((historyContract) => (
                    <li
                      key={historyContract.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-medium text-slate-700">
                          {historyContract.periodLabel}
                        </span>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                            historyContract.status
                          )}`}
                        >
                          {t(
                            `admin.customers.detail.contract.status.${historyContract.status}`
                          )}
                        </span>
                      </div>
                      {historyContract.pdfHref ? (
                        <a
                          href={historyContract.pdfHref}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-sky-700 hover:underline"
                        >
                          {t("admin.customers.detail.contract.viewPdf")}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {t("common.labels.notAvailable")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
