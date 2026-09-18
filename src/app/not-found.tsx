import Link from "next/link";
import { getTranslations } from "@/i18n/server";

export default async function NotFoundPage() {
  const t = await getTranslations();

  return (
    <main
      id="main-content"
      className="mx-auto min-h-screen w-full max-w-xl px-6 py-20 text-center"
    >
      <div className="app-card p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
          {t("globalShell.notFound.kicker")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          {t("globalShell.notFound.title")}
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          {t("globalShell.notFound.subtitle")}
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="app-button-primary inline-flex h-11 items-center px-5 text-sm font-semibold"
          >
            {t("globalShell.notFound.backHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
