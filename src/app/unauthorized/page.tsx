import { getTranslations } from "@/i18n/server";

export default async function UnauthorizedPage() {
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--ink)]">
      <div className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-contrast">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          {t("auth.unauthorized.kicker")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {t("auth.unauthorized.title")}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {t("auth.unauthorized.subtitle")}
        </p>
        <a
          href="/login"
          className="app-button-primary mt-6 inline-flex px-5 py-2 text-sm font-semibold"
        >
          {t("auth.unauthorized.backToLogin")}
        </a>
      </div>
    </div>
  );
}
