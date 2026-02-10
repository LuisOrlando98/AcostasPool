import AppShell from "@/components/layout/AppShell";
import { getTranslations } from "@/i18n/server";

type AdminPlaceholderProps = {
  title: string;
  subtitle?: string;
};

export default async function AdminPlaceholder({
  title,
  subtitle,
}: AdminPlaceholderProps) {
  const t = await getTranslations();
  return (
    <AppShell title={title} subtitle={subtitle} role="ADMIN">
      <section className="app-card p-6 shadow-contrast">
        <p className="text-sm text-slate-500">
          {t("admin.placeholder.kicker")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-slate-600">
          {t("admin.placeholder.body")}
        </p>
      </section>
    </AppShell>
  );
}
