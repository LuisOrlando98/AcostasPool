"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/client";

type TabKey = "operations" | "propertyHealth" | "contracts" | "needsAttention";

const tabs: Array<{ href: string; key: TabKey }> = [
  { href: "/admin/reports", key: "operations" },
  { href: "/admin/reports/needs-attention", key: "needsAttention" },
  { href: "/admin/reports/property-health", key: "propertyHealth" },
  { href: "/admin/reports/contracts", key: "contracts" },
];

function TabIcon({ tabKey }: { tabKey: TabKey }) {
  if (tabKey === "operations") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V10M10 19V5M16 19v-7M4 19h16" />
      </svg>
    );
  }
  if (tabKey === "propertyHealth") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.35-7-10.5A5 5 0 0 1 12 6a5 5 0 0 1 7 4.5C19 16.65 12 21 12 21z" />
      </svg>
    );
  }
  if (tabKey === "needsAttention") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 13h6M9 17h3" />
    </svg>
  );
}

export default function ReportsSectionTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav className="section-tabs max-w-full overflow-x-auto" aria-label={t("admin.reports.title")}>
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/admin/reports" ? pathname === "/admin/reports" : pathname === tab.href;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            data-active={isActive ? "true" : undefined}
            className="section-tabs-item"
          >
            <span className="section-tabs-item-icon">
              <TabIcon tabKey={tab.key} />
            </span>
            {t(`admin.reports.tabs.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
