"use client";

import { useEffect, useState } from "react";
import PwaUpdateNotice, {
  getPwaUpdateLabels,
  readDocumentLocale,
  type PwaUpdateLabels,
} from "@/components/pwa/PwaUpdateNotice";
import {
  scheduleServiceWorkerUpdateChecks,
  watchServiceWorkerUpdates,
} from "@/lib/ui/sw-update";

const SW_URL = "/sw.js";
const SW_SCOPE = "/";

export default function PwaRegister() {
  const [updateLabels, setUpdateLabels] = useState<PwaUpdateLabels | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const container = navigator.serviceWorker;
    let cancelled = false;
    let stopWatching: (() => void) | null = null;

    container
      .register(SW_URL, { scope: SW_SCOPE })
      .then((registration) => {
        if (cancelled) {
          return;
        }
        const stopUpdateWatcher = watchServiceWorkerUpdates({
          registration,
          container,
          onUpdateAvailable: () => {
            setUpdateLabels(getPwaUpdateLabels(readDocumentLocale()));
          },
        });
        const stopUpdateChecks = scheduleServiceWorkerUpdateChecks({ registration });
        stopWatching = () => {
          stopUpdateWatcher();
          stopUpdateChecks();
        };
      })
      .catch((error: unknown) => {
        console.error("[pwa] service worker registration failed", error);
      });

    return () => {
      cancelled = true;
      stopWatching?.();
    };
  }, []);

  if (!updateLabels || dismissed) {
    return null;
  }

  return (
    <PwaUpdateNotice
      labels={updateLabels}
      onReload={() => window.location.reload()}
      onDismiss={() => setDismissed(true)}
    />
  );
}
