import Link from "next/link";
import { getTranslations } from "@/i18n/server";

const RETRY_BUTTON_ID = "offline-retry";

/**
 * Script inline a propósito: esta página se sirve desde la caché del service
 * worker sin conexión, cuando los chunks de un componente cliente podrían no
 * estar cacheados y React no llegaría a hidratar. Así "Reintentar" y el
 * reintento automático al volver la conexión funcionan siempre.
 * Es una constante estática (sin datos de usuario ni de la petición), por lo
 * que `dangerouslySetInnerHTML` no expone superficie XSS.
 */
const RETRY_SCRIPT = `(function () {
  var reload = function () { window.location.reload(); };
  var button = document.getElementById(${JSON.stringify(RETRY_BUTTON_ID)});
  if (button) { button.addEventListener("click", reload); }
  window.addEventListener("online", reload);
})();`;

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
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            id={RETRY_BUTTON_ID}
            className="app-button-primary inline-flex min-h-11 w-full items-center justify-center px-5 text-sm font-semibold sm:w-auto"
          >
            {t("offline.retry")}
          </button>
          <Link
            href="/login"
            className="app-button-secondary inline-flex h-11 w-full items-center justify-center px-5 text-sm font-semibold sm:w-auto"
          >
            {t("offline.backToLogin")}
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">{t("offline.autoRetry")}</p>
        <script dangerouslySetInnerHTML={{ __html: RETRY_SCRIPT }} />
      </div>
    </main>
  );
}
