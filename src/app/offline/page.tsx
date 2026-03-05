import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OfflinePage() {
  const t = await getTranslations();

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-6 py-20 text-center">
      <div className="app-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">
          {t("offline.kicker")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          {t("offline.title")}
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          {t("offline.subtitle")}
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="app-button-secondary inline-flex h-11 items-center px-5 text-sm font-semibold"
          >
            {t("offline.backToLogin")}
          </Link>
        </div>
      </div>
    </main>
  );
}
