"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import {
  LANDING_PAGE_NAV_ITEMS,
  LANDING_SECTION_NAV_ITEMS,
  getLandingShellCopy,
  type LandingPageNavKey,
  type LandingSectionId,
} from "@/components/landing/landing-copy";
import { LanguageSwitch, ThemeSwitch } from "@/components/landing/LandingPreferenceSwitches";
import type { LandingLocale, LandingTheme } from "@/components/landing/preferences";

export type LandingSectionNavState = {
  activeId: LandingSectionId | null;
  pressedId: LandingSectionId | null;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, sectionId: LandingSectionId) => void;
};

type LandingHeaderProps = {
  language: LandingLocale;
  theme: LandingTheme;
  onLanguageChange: (nextLocale: LandingLocale) => void;
  onThemeChange: (nextTheme: LandingTheme) => void;
  /** Same WhatsApp link used by the hero CTA of the page. */
  whatsappLink: string;
  /** Page link highlighted in the navigation (about/contact). */
  activePage?: Exclude<LandingPageNavKey, "login">;
  /**
   * When provided (landing page only), section links become in-page anchors
   * driven by the scroll spy. Otherwise they link back to the landing sections.
   */
  sectionNav?: LandingSectionNavState;
};

/*
 * The header CTA and the mobile language switch are styled with Tailwind
 * utilities on purpose: globals.css hides `.lp-header-actions .lp-lang-switch`
 * below 760px and its unlayered rules would override any utility applied to
 * the standard classes. The `max-[761px]` / `min-[761px]` variants match the
 * `@media (max-width: 760px)` breakpoint used by the landing stylesheet.
 */
const HEADER_CTA_CLASS =
  "hidden min-[761px]:inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent " +
  "min-h-[2.75rem] px-4 text-[0.7rem] font-extrabold uppercase tracking-[0.08em] no-underline text-white " +
  "max-[1181px]:min-h-[2.45rem] max-[1181px]:px-[0.82rem] max-[1181px]:text-[0.62rem] " +
  "bg-[linear-gradient(145deg,var(--lp-brand),var(--lp-brand-2))] shadow-[0_10px_20px_rgba(16,153,219,0.26)] " +
  "transition-transform hover:-translate-y-px";

const ANNOUNCE_TOOLS_CLASS = "hidden max-[761px]:inline-flex shrink-0 items-center gap-1.5";

const COMPACT_LANGUAGE_SWITCH_CLASS =
  "lp-header-lang-compact inline-flex items-center gap-[0.14rem] rounded-full border border-[var(--lp-border)] " +
  "bg-[color-mix(in_srgb,var(--lp-surface-soft)_90%,transparent)] p-[0.18rem]";

const ANNOUNCE_CTA_CLASS =
  "inline-flex size-[2.05rem] shrink-0 items-center justify-center rounded-full text-white " +
  "bg-[linear-gradient(145deg,var(--lp-brand),var(--lp-brand-2))] shadow-[0_8px_16px_rgba(16,153,219,0.24)]";

export function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      width="16"
      height="16"
    >
      <path d="M12 21a9 9 0 1 0-4.5-1.2L4 21l1.3-3.3A9 9 0 0 0 12 21Z" />
      <path d="M9.3 8.8c.3-.3.5-.3.7.1l.6 1.3c.1.2.1.4-.1.6l-.5.5c-.2.2-.2.4 0 .6.3.6.8 1.1 1.4 1.4.2.1.4.1.6 0l.5-.5c.2-.2.4-.2.6-.1l1.3.6c.3.2.4.4.1.7l-.6.7c-.6.6-1.4.8-2.2.5-1.4-.5-2.7-1.7-3.7-3.1-.8-1.1-1.1-2.1-.7-2.9l.7-.8Z" />
    </svg>
  );
}

function BrandMark({
  className,
  dotClassName,
  textClassName,
  navKey,
}: {
  className: string;
  dotClassName: string;
  textClassName: string;
  navKey?: string;
}) {
  return (
    <Link href="/" className={className} data-nav-key={navKey}>
      <span className={dotClassName} aria-hidden="true" />
      <span className={textClassName}>
        <span>Acostas</span>
        <span>Pool</span>
      </span>
    </Link>
  );
}

export default function LandingHeader({
  language,
  theme,
  onLanguageChange,
  onThemeChange,
  whatsappLink,
  activePage,
  sectionNav,
}: LandingHeaderProps) {
  const copy = getLandingShellCopy(language);

  return (
    <header className="lp-header">
      <div className="lp-container lp-header-inner">
        <BrandMark
          className="lp-brand"
          dotClassName="lp-brand-dot"
          textClassName="lp-brand-name"
        />

        <nav className="lp-nav" aria-label={copy.primaryNavLabel}>
          <BrandMark
            className="lp-nav-link lp-nav-logo-link"
            dotClassName="lp-nav-logo-dot"
            textClassName="lp-nav-logo-text"
            navKey="brand"
          />

          {LANDING_SECTION_NAV_ITEMS.map((item) =>
            sectionNav ? (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="lp-nav-link"
                data-nav-key={item.id}
                data-active={sectionNav.activeId === item.id}
                data-pressed={sectionNav.pressedId === item.id}
                aria-current={sectionNav.activeId === item.id ? "location" : undefined}
                onClick={(event) => sectionNav.onNavigate(event, item.id)}
              >
                {copy.nav[item.id]}
              </a>
            ) : (
              <Link key={item.id} href={`/#${item.id}`} className="lp-nav-link" data-nav-key={item.id}>
                {copy.nav[item.id]}
              </Link>
            )
          )}

          {LANDING_PAGE_NAV_ITEMS.map((item) => {
            const isActive = activePage === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="lp-nav-link lp-nav-link-page"
                data-nav-key={item.key}
                data-active={activePage ? isActive : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                {copy.nav[item.key]}
              </Link>
            );
          })}
        </nav>

        <div className="lp-header-actions">
          <LanguageSwitch language={language} onChange={onLanguageChange} />
          <ThemeSwitch theme={theme} language={language} onChange={onThemeChange} />

          <a
            href={whatsappLink}
            className={HEADER_CTA_CLASS}
            aria-label={copy.whatsapp.description}
            title={copy.whatsapp.description}
          >
            <WhatsAppIcon />
            <span>{copy.whatsapp.label}</span>
          </a>

          <Link href="/login" className="lp-login-btn">
            {copy.nav.login}
          </Link>
        </div>
      </div>

      <div className="lp-announce">
        <div className="lp-container lp-announce-inner justify-between gap-3">
          <p>{copy.announce}</p>

          <div className={ANNOUNCE_TOOLS_CLASS}>
            <LanguageSwitch
              language={language}
              onChange={onLanguageChange}
              className={COMPACT_LANGUAGE_SWITCH_CLASS}
            />
            <a
              href={whatsappLink}
              className={ANNOUNCE_CTA_CLASS}
              aria-label={copy.whatsapp.description}
              title={copy.whatsapp.description}
            >
              <WhatsAppIcon />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
