"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallAppActionProps = {
  variant: "sidebar" | "menu";
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };
type InstallGuideStep = {
  id: string;
  image?: string;
};

const IOS_INSTALL_STEPS: InstallGuideStep[] = [
  {
    id: "openShare",
    image: "/pwa/install/ios-step-share.svg",
  },
  {
    id: "tapAddHome",
    image: "/pwa/install/ios-step-add-home.svg",
  },
  {
    id: "confirmAdd",
    image: "/pwa/install/ios-step-confirm.svg",
  },
  {
    id: "openFromHome",
  },
];

const ANDROID_INSTALL_STEPS: InstallGuideStep[] = [
  { id: "openMenu" },
  { id: "tapInstall" },
  { id: "confirmInstall" },
];

function isIosDevice(userAgent: string) {
  const iosRegex = /iPad|iPhone|iPod/i;
  const iPadOs =
    /Macintosh/i.test(userAgent) &&
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 1;
  return iosRegex.test(userAgent) || iPadOs;
}

export default function InstallAppAction({ variant }: InstallAppActionProps) {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPortalReady, setIsPortalReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ua = window.navigator.userAgent;
    const ios = isIosDevice(ua);
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || ios;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as NavigatorWithStandalone).standalone === true;

    setIsIos(ios);
    setIsMobile(mobile);
    setIsStandalone(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setIsGuideOpen(false);
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      const inStandalone =
        event.matches ||
        (window.navigator as NavigatorWithStandalone).standalone === true;
      setIsStandalone(inStandalone);
    };

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt as EventListener
    );
    window.addEventListener("appinstalled", onAppInstalled);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onDisplayModeChange);
    } else {
      mediaQuery.addListener(onDisplayModeChange);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt as EventListener
      );
      window.removeEventListener("appinstalled", onAppInstalled);
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", onDisplayModeChange);
      } else {
        mediaQuery.removeListener(onDisplayModeChange);
      }
    };
  }, []);

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isGuideOpen || typeof window === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGuideOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isGuideOpen]);

  const handleInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setIsGuideOpen(false);
    } catch {
      window.alert(t("userMenu.installError"));
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, t]);

  const canUseInstallPrompt = !isIos && Boolean(deferredPrompt);
  const installSteps = isIos ? IOS_INSTALL_STEPS : ANDROID_INSTALL_STEPS;

  if (isStandalone || !isMobile) {
    return null;
  }

  const button =
    variant === "menu" ? (
      <button
        type="button"
        onClick={() => setIsGuideOpen(true)}
        disabled={installing}
        className="w-full border-t border-[var(--border)] px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
      >
        {installing ? t("userMenu.installingApp") : t("userMenu.installApp")}
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setIsGuideOpen(true)}
        disabled={installing}
        className="sidebar-account-link"
      >
        <span className="sidebar-account-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3.5v10m0 0l-3-3m3 3l3-3M4.5 15.5v2A2.5 2.5 0 007 20h10a2.5 2.5 0 002.5-2.5v-2"
            />
          </svg>
        </span>
        <span className="sidebar-account-label">
          {installing ? t("userMenu.installingApp") : t("userMenu.installApp")}
        </span>
      </button>
    );

  return (
    <>
      {button}
      {isGuideOpen && isPortalReady
        ? createPortal(
            <div
              className="fixed inset-0 z-[1200] overflow-y-auto p-4 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="install-guide-title"
            >
              <button
                type="button"
                aria-label={t("common.actions.close")}
                className="fixed inset-0 bg-slate-900/55"
                onClick={() => setIsGuideOpen(false)}
              />
              <div className="relative flex min-h-full items-center justify-center">
                <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-contrast">
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {isIos
                          ? t("userMenu.installGuide.platform.ios")
                          : t("userMenu.installGuide.platform.android")}
                      </p>
                      <h2
                        id="install-guide-title"
                        className="mt-1 text-lg font-semibold text-slate-900"
                      >
                        {t("userMenu.installGuide.title")}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {isIos
                          ? t("userMenu.installGuide.subtitleIos")
                          : t("userMenu.installGuide.subtitleAndroid")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGuideOpen(false)}
                      className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                      aria-label={t("common.actions.close")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 6l12 12M18 6L6 18"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                    {isIos ? (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                        <p className="font-semibold">
                          {t("userMenu.installGuide.iosNoteTitle")}
                        </p>
                        <p className="mt-1">{t("userMenu.installGuide.iosNoteBody")}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-semibold">
                          {t("userMenu.installGuide.androidNoteTitle")}
                        </p>
                        <p className="mt-1">
                          {canUseInstallPrompt
                            ? t("userMenu.installGuide.androidNoteBodyPrompt")
                            : t("userMenu.installGuide.androidNoteBodyManual")}
                        </p>
                      </div>
                    )}

                    <ol className="grid gap-3 md:grid-cols-2">
                      {installSteps.map((step, index) => (
                        <li
                          key={step.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {t(`userMenu.installGuide.steps.${step.id}.title`)}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {t(`userMenu.installGuide.steps.${step.id}.body`)}
                              </p>
                            </div>
                          </div>
                          {step.image ? (
                            <img
                              src={step.image}
                              alt={t(`userMenu.installGuide.steps.${step.id}.imageAlt`)}
                              className="mt-3 w-full rounded-xl border border-slate-200 bg-white"
                              loading="lazy"
                            />
                          ) : null}
                        </li>
                      ))}
                    </ol>

                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                      {canUseInstallPrompt ? (
                        <button
                          type="button"
                          onClick={handleInstallPrompt}
                          disabled={installing}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {installing
                            ? t("userMenu.installingApp")
                            : t("userMenu.installGuide.installNow")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setIsGuideOpen(false)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        {t("userMenu.installGuide.done")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
