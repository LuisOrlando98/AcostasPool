import { getTranslations } from "@/i18n/server";

/**
 * Esqueleto de las rutas /tech/**. No renderiza AppShell a propósito: cada
 * montaje del shell dispara las peticiones de notificaciones y la conexión
 * Pusher, y la página real vuelve a montarlo en cuanto llega. Replica el
 * contenedor de `main.app-content` para que el contenido no salte.
 */

const SKELETON_ROW_COUNT = 3;
const SKELETON_ROWS = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index);
const SKELETON_BLOCK_CLASS = "animate-pulse rounded-xl bg-slate-200/80 motion-reduce:animate-none";

export default async function TechLoading() {
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] lg:pl-[18rem]">
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="mx-auto flex w-full max-w-[120rem] flex-col gap-5 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8 lg:gap-8 lg:py-10"
      >
        <span className="sr-only">{t("tech.loading.title")}</span>
        <div aria-hidden="true" className="space-y-2">
          <div className={`h-3 w-24 ${SKELETON_BLOCK_CLASS}`} />
          <div className={`h-6 w-48 ${SKELETON_BLOCK_CLASS}`} />
          <div className={`h-4 w-64 max-w-full ${SKELETON_BLOCK_CLASS}`} />
        </div>

        <section aria-hidden="true" className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="app-card space-y-4 p-6 shadow-contrast">
            <div className={`h-3 w-28 ${SKELETON_BLOCK_CLASS}`} />
            <div className={`h-6 w-2/3 ${SKELETON_BLOCK_CLASS}`} />
            <div className={`h-4 w-1/2 ${SKELETON_BLOCK_CLASS}`} />
            <div className="flex flex-wrap gap-2">
              <div className={`h-6 w-20 ${SKELETON_BLOCK_CLASS}`} />
              <div className={`h-6 w-16 ${SKELETON_BLOCK_CLASS}`} />
              <div className={`h-6 w-14 ${SKELETON_BLOCK_CLASS}`} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`h-11 ${SKELETON_BLOCK_CLASS}`} />
              <div className={`h-11 ${SKELETON_BLOCK_CLASS}`} />
            </div>
            <div className={`h-11 ${SKELETON_BLOCK_CLASS}`} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 2xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <div className={`h-3 w-16 ${SKELETON_BLOCK_CLASS}`} />
                <div className={`mt-2 h-6 w-10 ${SKELETON_BLOCK_CLASS}`} />
                <div className={`mt-2 h-3 w-20 ${SKELETON_BLOCK_CLASS}`} />
              </div>
            ))}
          </div>
        </section>

        <section aria-hidden="true" className="app-card p-6 shadow-contrast">
          <div className="flex items-center justify-between gap-3">
            <div className={`h-6 w-40 ${SKELETON_BLOCK_CLASS}`} />
            <div className={`h-11 w-32 ${SKELETON_BLOCK_CLASS}`} />
          </div>
          <div className="mt-4 space-y-3">
            {SKELETON_ROWS.map((index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className={`h-4 w-24 ${SKELETON_BLOCK_CLASS}`} />
                <div className={`mt-2 h-4 w-1/2 ${SKELETON_BLOCK_CLASS}`} />
                <div className={`mt-2 h-3 w-2/3 ${SKELETON_BLOCK_CLASS}`} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className={`h-11 ${SKELETON_BLOCK_CLASS}`} />
                  <div className={`h-11 ${SKELETON_BLOCK_CLASS}`} />
                </div>
                <div className={`mt-2 h-11 ${SKELETON_BLOCK_CLASS}`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
