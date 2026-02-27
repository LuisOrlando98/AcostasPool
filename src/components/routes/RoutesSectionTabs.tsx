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
    <div className="flex w-full justify-start md:justify-end">
      <div className="inline-grid w-full max-w-[20rem] grid-cols-2 rounded-full border border-slate-200 bg-white p-1 shadow-sm md:w-auto md:max-w-none">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/admin/routes"
              ? pathname === "/admin/routes"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex min-w-0 items-center justify-center rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition sm:px-4 ${
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
    </div>
  );
}
