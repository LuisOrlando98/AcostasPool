"use client";

import { useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { useI18n } from "@/i18n/client";

type TechErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function TechError({ error, reset }: TechErrorProps) {
  const { t } = useI18n();

  useEffect(() => {
    // Client-side trace for support; the server already logs the digest.
    console.error("[tech] route error", error);
  }, [error]);

  return (
    <AppShell title={t("tech.error.title")} subtitle={t("tech.error.kicker")} role="TECH">
      <section role="alert" className="app-card p-6 shadow-contrast">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">
          {t("tech.error.kicker")}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">{t("tech.error.title")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("tech.error.description")}</p>
        {error.digest ? (
          <p className="mt-2 font-mono text-[11px] text-slate-400">
            {t("tech.error.reference", { digest: error.digest })}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="app-button-primary inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-semibold"
          >
            {t("tech.error.retry")}
          </button>
          <Link
            href="/tech"
            className="app-button-secondary inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-semibold"
          >
            {t("tech.error.backHome")}
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
