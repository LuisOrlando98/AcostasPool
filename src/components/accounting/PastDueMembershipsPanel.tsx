"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";

type PastDueMembership = {
  id: string;
  customerId: string;
  customerName: string;
  amountCents: number;
  currentPeriodEnd: string | null;
};

type Props = {
  memberships: PastDueMembership[];
  retryAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
  cancelAction: (formData: FormData) => Promise<{ error?: string } | undefined>;
};

export default function PastDueMembershipsPanel({ memberships, retryAction, cancelAction }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(cents / 100);

  const run = async (
    action: (formData: FormData) => Promise<{ error?: string } | undefined>,
    membershipId: string
  ) => {
    setPendingId(membershipId);
    setErrors((current) => ({ ...current, [membershipId]: "" }));
    const formData = new FormData();
    formData.set("membershipId", membershipId);
    const result = await action(formData);
    setPendingId(null);
    if (result?.error) {
      setErrors((current) => ({ ...current, [membershipId]: result.error! }));
      return;
    }
    router.refresh();
  };

  if (memberships.length === 0) {
    return (
      <p className="text-sm text-slate-500">{t("admin.accounting.pastDue.empty")}</p>
    );
  }

  return (
    <div className="space-y-2">
      {memberships.map((membership) => (
        <div
          key={membership.id}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{membership.customerName}</p>
              <p className="text-xs text-slate-500">{money(membership.amountCents)}/mo</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pendingId === membership.id}
                onClick={() => run(retryAction, membership.id)}
                className="rounded-full border border-sky-300 bg-white px-3 py-1 text-[11px] font-semibold text-sky-700 transition hover:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingId === membership.id
                  ? t("common.feedback.saving")
                  : t("admin.accounting.pastDue.retry")}
              </button>
              <button
                type="button"
                disabled={pendingId === membership.id}
                onClick={() => run(cancelAction, membership.id)}
                className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("admin.accounting.pastDue.cancel")}
              </button>
            </div>
          </div>
          {errors[membership.id] ? (
            <p className="mt-1.5 text-xs font-semibold text-rose-700">{errors[membership.id]}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
