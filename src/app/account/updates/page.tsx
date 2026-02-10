import AppShell from "@/components/layout/AppShell";
import { updates } from "@/content/updates";
import { requireAuth } from "@/lib/auth/guards";
import { getTranslations } from "@/i18n/server";

export default async function UpdatesPage() {
  const session = await requireAuth();
  const t = await getTranslations();

  return (
    <AppShell
      title={t("updates.title")}
      subtitle={t("updates.subtitle")}
      role={session.role}
    >
      <section className="space-y-6">
        {updates.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-sm text-slate-600 shadow-sm">
            {t("updates.empty")}
          </div>
        ) : (
          updates.map((entry) => (
            <div
              key={`${entry.date}-${entry.title}`}
              className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {new Date(entry.date).toLocaleDateString()}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">{entry.title}</h2>
                </div>
                {entry.tag ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {entry.tag}
                  </span>
                ) : null}
              </div>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </AppShell>
  );
}
