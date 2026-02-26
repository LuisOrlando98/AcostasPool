"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallAppActionProps = {
  variant: "sidebar" | "menu";
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

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

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {
        window.alert(t("userMenu.installError"));
      } finally {
        setInstalling(false);
        setDeferredPrompt(null);
      }
      return;
    }

    if (isIos) {
      window.alert(t("userMenu.iosInstallHint"));
      return;
    }

    window.alert(t("userMenu.androidInstallHint"));
  }, [deferredPrompt, isIos, t]);

  if (isStandalone || !isMobile) {
    return null;
  }

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="w-full border-t border-[var(--border)] px-4 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
      >
        {installing ? t("userMenu.installingApp") : t("userMenu.installApp")}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
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
}
