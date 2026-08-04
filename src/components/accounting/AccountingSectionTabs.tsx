"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

const tabs = [
  { href: "/admin/accounting", key: "dashboard" as const },
  { href: "/admin/invoices", key: "invoices" as const },
];

export default function AccountingSectionTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="w-auto min-w-0">
      <div className="inline-grid w-auto min-w-[16rem] grid-cols-2 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm sm:min-w-0">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/admin/accounting"
              ? pathname === "/admin/accounting"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex min-w-0 items-center justify-center rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] transition sm:px-3.5 sm:py-1.5 sm:text-[11px] sm:tracking-[0.14em] ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {t(`admin.accounting.tabs.${tab.key}`)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
