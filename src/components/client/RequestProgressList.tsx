import { getJobStatusLabel } from "@/lib/constants";
import { formatInBusinessTimeZone } from "@/lib/timezone";

export type RequestProgressItem = {
  id: string;
  status: string;
  priority: string;
  requestCategory: string | null;
  requestIssue: string | null;
  requestedAt: string | null;
  createdAt: string;
  technicianName: string | null;
};

type RequestProgressListProps = {
  requests: RequestProgressItem[];
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const STEP_KEYS = ["received", "assigned", "onTheWay", "completed"] as const;

function stepIndexFor(request: RequestProgressItem): number {
  if (request.status === "COMPLETED") {
    return 3;
  }
  if (["ON_THE_WAY", "IN_PROGRESS"].includes(request.status)) {
    return 2;
  }
  if (request.technicianName || request.status !== "PENDING") {
    return 1;
  }
  return 0;
}

export default function RequestProgressList({ requests, locale, t }: RequestProgressListProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t("client.request.progress.title")}</h2>
        <p className="text-sm text-slate-500">{t("client.request.progress.subtitle")}</p>
      </div>

      {requests.map((request) => {
        const currentStep = stepIndexFor(request);
        const categoryLabel = request.requestCategory
          ? t(`client.request.categories.${request.requestCategory}`)
          : null;
        const issueLabel = request.requestIssue
          ? t(`client.request.issues.${request.requestIssue}`)
          : null;

        return (
          <div key={request.id} className="app-card p-5 shadow-contrast sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {categoryLabel ? (
                    <span className="app-chip px-3 py-1 text-sm font-semibold" data-tone="info">
                      {categoryLabel}
                    </span>
                  ) : null}
                  {request.priority === "URGENT" ? (
                    <span className="app-chip px-3 py-1 text-sm font-semibold" data-tone="danger">
                      {t("client.request.urgentBadge")}
                    </span>
                  ) : null}
                </div>
                {issueLabel ? (
                  <p className="mt-1.5 text-base font-semibold text-slate-900">{issueLabel}</p>
                ) : null}
                <p className="mt-1 text-sm text-slate-500">
                  {t("client.request.progress.submittedOn", {
                    date: formatInBusinessTimeZone(request.requestedAt ?? request.createdAt, locale, {
                      dateStyle: "long",
                    }),
                  })}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-500">
                {getJobStatusLabel(request.status, t)}
              </span>
            </div>

            <div className="mt-5 flex items-center">
              {STEP_KEYS.map((stepKey, index) => {
                const isDone = index <= currentStep;
                const isLast = index === STEP_KEYS.length - 1;
                return (
                  <div key={stepKey} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold sm:h-11 sm:w-11 ${
                          isDone
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-200 bg-white text-slate-300"
                        }`}
                      >
                        {isDone ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 sm:h-5 sm:w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      <span
                        className={`w-16 text-center text-[11px] font-semibold leading-tight sm:w-20 sm:text-xs ${
                          isDone ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {t(`client.request.progress.steps.${stepKey}`)}
                      </span>
                    </div>
                    {!isLast ? (
                      <div
                        className={`mx-1 h-1 flex-1 rounded-full sm:mx-2 ${
                          index < currentStep ? "bg-emerald-500" : "bg-slate-200"
                        }`}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {request.technicianName ? (
              <p className="mt-4 text-sm text-slate-600">
                {t("client.request.progress.technician", { name: request.technicianName })}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
