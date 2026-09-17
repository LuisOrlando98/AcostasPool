"use client";

import { useId, useMemo, useRef, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import { useI18n } from "@/i18n/client";

type RouteStopPreview = {
  id: string;
  customerName: string;
  address: string;
};

type TechRoutePlannerButtonProps = {
  stops: RouteStopPreview[];
};

type MapProvider = "GOOGLE" | "APPLE";

const MODAL_LAYER_CLASS = "overflow-y-auto p-3 sm:p-6";
const MODAL_BACKDROP_CLASS = "app-modal-backdrop bg-slate-900/55";
const MODAL_CARD_CLASS =
  "max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";

const isAppleDevice = () => {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod|Macintosh/i.test(ua);
};

const encodeWaypointList = (values: string[]) =>
  values.map((value) => encodeURIComponent(value)).join("%7C");

const buildGoogleRouteUrl = (addresses: string[]) => {
  if (addresses.length === 0) {
    return "";
  }
  if (addresses.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addresses[0])}`;
  }
  const destination = encodeURIComponent(addresses[addresses.length - 1]);
  const waypoints = encodeWaypointList(addresses.slice(0, -1));
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    "Current Location"
  )}&destination=${destination}&travelmode=driving&waypoints=${waypoints}`;
};

const buildAppleRouteUrl = (addresses: string[]) => {
  if (addresses.length === 0) {
    return "";
  }
  const fullRoute = addresses.join(" to:");
  return `http://maps.apple.com/?saddr=${encodeURIComponent(
    "Current Location"
  )}&daddr=${encodeURIComponent(fullRoute)}&dirflg=d`;
};

function RouteIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M5 20V10m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14 10v-6m0 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 10h9a5 5 0 0 1 5 5v1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TechRoutePlannerButton({
  stops,
}: TechRoutePlannerButtonProps) {
  const { t } = useI18n();
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [preferredProvider] = useState<MapProvider>(() =>
    isAppleDevice() ? "APPLE" : "GOOGLE"
  );

  const addresses = useMemo(
    () =>
      stops
        .map((stop) => stop.address.trim())
        .filter((address) => address.length > 0),
    [stops]
  );

  const links = useMemo(
    () => ({
      google: buildGoogleRouteUrl(addresses),
      apple: buildAppleRouteUrl(addresses),
    }),
    [addresses]
  );

  const closeModal = () => setIsOpen(false);

  const openProvider = (provider: MapProvider) => {
    const url = provider === "APPLE" ? links.apple : links.google;
    if (!url) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    closeModal();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="app-button-secondary inline-flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-semibold"
      >
        <RouteIcon />
        {t("tech.home.route.quickPlan")}
      </button>

      <AppModal
        open={isOpen}
        onClose={closeModal}
        titleId={titleId}
        describedBy={descriptionId}
        layerClassName={MODAL_LAYER_CLASS}
        backdropClassName={MODAL_BACKDROP_CLASS}
        cardClassName={MODAL_CARD_CLASS}
        returnFocusRef={triggerRef}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("tech.home.route.quickPlanKicker")}
          </p>
          <h3 id={titleId} className="mt-1 text-lg font-semibold text-slate-900">
            {t("tech.home.route.quickPlanTitle")}
          </h3>
          <p id={descriptionId} className="mt-1 text-sm text-slate-600">
            {t("tech.home.route.quickPlanQuestion")}
          </p>
        </div>

        <div className="app-modal-scroll modal-scroll max-h-[56vh] overflow-y-auto px-5 py-4">
          {stops.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {t("tech.home.route.empty")}
            </p>
          ) : (
            <ol className="space-y-2">
              {stops.map((stop, index) => (
                <li
                  key={stop.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {t("tech.home.route.stop", { count: index + 1 })}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {stop.customerName}
                  </p>
                  <p className="text-xs text-slate-600">{stop.address}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-800">
            {preferredProvider === "APPLE"
              ? t("tech.home.route.recommendedApple")
              : t("tech.home.route.recommendedGoogle")}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openProvider("GOOGLE")}
              disabled={!links.google}
              className="app-button-primary inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {t("tech.home.route.openInGoogle")}
            </button>
            <button
              type="button"
              onClick={() => openProvider("APPLE")}
              disabled={!links.apple}
              className="app-button-secondary inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
            >
              {t("tech.home.route.openInApple")}
            </button>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            {t("common.actions.close")}
          </button>
        </div>
      </AppModal>
    </>
  );
}
