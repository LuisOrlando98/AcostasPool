"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

const tabs = [
  { href: "/admin/routes", key: "calendar" as const },
  { href: "/admin/routes/assistant", key: "assistant" as const },
];

export default function RoutesSectionTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/admin/routes"
            ? pathname === "/admin/routes"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              isActive
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {t(`admin.routes.tabs.${tab.key}`)}
          </Link>
        );
      })}
    </div>
  );
}
