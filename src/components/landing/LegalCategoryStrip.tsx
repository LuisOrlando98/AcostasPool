"use client";

import Link from "next/link";
import type { ComplianceDocConfig } from "@/lib/compliance-config";
import type { LandingLocale } from "@/components/landing/preferences";

type LegalCategoryDoc = {
  slug: string;
  label: string;
  content: ComplianceDocConfig;
};

const STRIP_COPY = {
  en: {
    aria: "Legal categories",
    hub: "Legal",
  },
  es: {
    aria: "Categorias legales",
    hub: "Legal",
  },
} as const;

export default function LegalCategoryStrip({
  docs,
  language,
  currentSlug,
}: {
  docs: LegalCategoryDoc[];
  language: LandingLocale;
  currentSlug?: string;
}) {
  const copy = STRIP_COPY[language];
  const items = [
    { href: "/legal", slug: "", label: copy.hub },
    ...docs.map((doc) => ({
      href: `/legal/${doc.slug}`,
      slug: doc.slug,
      label: doc.content[language].title,
    })),
  ];

  return (
    <nav
      aria-label={copy.aria}
      className="rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,rgba(4,36,58,0.95),rgba(5,68,96,0.88))] px-3 py-2 shadow-contrast"
    >
      <ul className="flex flex-wrap items-center justify-center gap-y-1 text-center">
        {items.map((item, index) => {
          const isCurrent = item.slug ? item.slug === currentSlug : !currentSlug;
          return (
            <li key={item.href} className="inline-flex items-center">
              {isCurrent ? (
                <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-white sm:text-[11px]">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="px-2 text-[10px] font-medium text-sky-50/92 transition hover:text-white sm:text-[11px]"
                >
                  {item.label}
                </Link>
              )}
              {index < items.length - 1 ? (
                <span aria-hidden="true" className="px-1 text-[10px] text-sky-100/55">
                  •
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
