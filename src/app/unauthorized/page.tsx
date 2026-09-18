import { getTranslations } from "@/i18n/server";

type UnauthorizedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Ruta absoluta del mismo origen: "//host" o "/\host" serían un open redirect. */
const SAFE_RETURN_PATH_PATTERN = /^\/(?![/\\])/;

const PRIMARY_LINK_CLASS =
  "app-button-primary mt-6 inline-flex px-5 py-2 text-sm font-semibold";
const SECONDARY_LINK_CLASS =
  "mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-sky-700 hover:text-sky-800";

function resolveReturnPath(value: string | string[] | undefined): string | null {
  return typeof value === "string" && SAFE_RETURN_PATH_PATTERN.test(value)
    ? value
    : null;
}

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const t = await getTranslations();
  const resolvedSearchParams = (await searchParams) ?? {};
  const returnPath = resolveReturnPath(resolvedSearchParams.next);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--ink)]">
      <div className="mx-auto max-w-xl rounded-3xl border border-[var(--border)] bg-white p-8 text-center shadow-contrast">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          {t("auth.unauthorized.kicker")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          {t("auth.unauthorized.title")}
        </h1>
        <p role="alert" className="mt-3 text-sm text-slate-600">
          {t("auth.unauthorized.subtitle")}
        </p>
        {returnPath ? (
          <a href={returnPath} className={PRIMARY_LINK_CLASS}>
            {t("auth.unauthorized.goBack")}
          </a>
        ) : null}
        <a
          href="/login"
          className={returnPath ? SECONDARY_LINK_CLASS : PRIMARY_LINK_CLASS}
        >
          {t("auth.unauthorized.backToLogin")}
        </a>
      </div>
    </div>
  );
}
