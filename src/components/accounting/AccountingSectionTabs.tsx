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

function TabIcon({ tabKey }: { tabKey: TabKey }) {
  if (tabKey === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V10M10 19V5M16 19v-7M4 19h16" />
      </svg>
    );
  }
  if (tabKey === "invoices") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 13h6M9 17h3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h4" />
    </svg>
  );
}

export default function AccountingSectionTabs() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const { t } = useI18n();

  return (
    <nav className="accounting-tabs max-w-full overflow-x-auto" aria-label={t("admin.accounting.title")}>
      {tabs.map((tab) => {
        const isActive = tab.match(pathname, view);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            data-active={isActive ? "true" : undefined}
            className="accounting-tabs-item"
          >
            <span className="accounting-tabs-item-icon">
              <TabIcon tabKey={tab.key} />
            </span>
            {t(`admin.accounting.tabs.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
