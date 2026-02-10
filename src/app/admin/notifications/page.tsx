import AdminPlaceholder from "@/components/layout/AdminPlaceholder";
import { getTranslations } from "@/i18n/server";

export default async function NotificationsPage() {
  const t = await getTranslations();
  return (
    <AdminPlaceholder
      title={t("admin.notifications.title")}
      subtitle={t("admin.notifications.subtitle")}
    />
  );
}
