"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/client";

type TabKey = "dashboard" | "invoices" | "servicePayment";

const tabs: Array<{
  href: string;
  key: TabKey;
  match: (pathname: string, view: string | null) => boolean;
}> = [
  {
    href: "/admin/accounting",
    key: "dashboard",
    match: (pathname) => pathname === "/admin/accounting",
  },
  {
    href: "/admin/invoices",
    key: "invoices",
    match: (pathname, view) => pathname === "/admin/invoices" && view !== "service-payment",
  },
  {
    href: "/admin/invoices?view=service-payment",
    key: "servicePayment",
    match: (pathname, view) => pathname === "/admin/invoices" && view === "service-payment",
  },
];

export default function AccountingSectionTabs() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const { t } = useI18n();

  return (
    <div className="w-auto min-w-0">
      <div className="inline-grid w-auto min-w-[24rem] grid-cols-3 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm sm:min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.match(pathname, view);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex min-w-0 items-center justify-center rounded-full px-2 py-1 text-center text-[8px] font-semibold uppercase leading-tight tracking-[0.06em] transition sm:px-3 sm:py-1.5 sm:text-[10px] sm:tracking-[0.1em] ${
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
