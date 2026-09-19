"use client";

/**
 * Corregir la ubicación de una parada sin salir del asistente: se edita la
 * dirección y el servidor intenta geocodificarla. Si no la encuentra, en vez
 * de dejar la parada colgada se ofrecen las coordenadas a mano (con el enlace
 * a Google Maps para copiarlas), que es lo que pidió el dueño: "si al final no
 * se puede geolocalizar, que se pueda arreglar desde aquí mismo".
 *
 * `AddressAutocompleteSingle` guarda su propio valor y no admite un uso
 * controlado, así que aquí la dirección es un `app-input` normal.
 */

import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import AppModal from "@/components/ui/AppModal";
import type { AssistantStop } from "@/lib/routing/assistant-types";
import { requestPropertyLocation } from "./api";
import { describeAssistantError } from "./errors";
import {
  buildMapsSearchUrl,
  isValidAddress,
  parseCoordinatePair,
  parseCoordinates,
} from "./location-input";

type LocationFixModalProps = {
  readonly open: boolean;
  readonly stop: AssistantStop | null;
  readonly onClose: () => void;
  readonly onFixed: (stop: AssistantStop) => void;
};

/** Estado del formulario, atado al trabajo: al abrirlo con otra parada se reinicia solo. */
type FixState = {
  readonly jobId: string;
  readonly address: string;
  readonly lat: string;
  readonly lng: string;
  /** El servidor guardó la dirección pero no pudo situarla en el mapa. */
  readonly needsCoordinates: boolean;
  readonly error: string | null;
};

const CARD_CLASS =
  "max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";
const FIELD_LABEL_CLASS =
  "block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500";
const FIELD_CLASS = "app-input mt-2 w-full px-3 py-2.5 text-sm";
const BUTTON_CLASS = "min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]";

const initialState = (stop: AssistantStop): FixState => ({
  jobId: stop.jobId,
  address: stop.address,
  lat: "",
  lng: "",
  needsCoordinates: false,
  error: null,
});

type ManualCoordinatesProps = {
  readonly latId: string;
  readonly lngId: string;
  readonly address: string;
  readonly lat: string;
  readonly lng: string;
  readonly disabled: boolean;
  readonly onLatChange: (value: string) => void;
  readonly onLngChange: (value: string) => void;
};

/** Coordenadas a mano cuando el geocodificador no encuentra la dirección. */
function ManualCoordinates({
  latId,
  lngId,
  address,
  lat,
  lng,
  disabled,
  onLatChange,
  onLngChange,
}: ManualCoordinatesProps) {
  const { t } = useI18n();

  return (
    <div className="mt-4 space-y-3">
      <p className="app-callout px-4 py-3 text-sm" data-tone="warning" role="status">
        {t("admin.routes.assistant.location.notGeocoded")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={latId} className={FIELD_LABEL_CLASS}>
            {t("admin.routes.assistant.location.latLabel")}
          </label>
          <input
            id={latId}
            type="text"
            inputMode="decimal"
            value={lat}
            disabled={disabled}
            onChange={(event) => onLatChange(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={lngId} className={FIELD_LABEL_CLASS}>
            {t("admin.routes.assistant.location.lngLabel")}
          </label>
          <input
            id={lngId}
            type="text"
            inputMode="decimal"
            value={lng}
            disabled={disabled}
            onChange={(event) => onLngChange(event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        {t("admin.routes.assistant.location.mapsHint")}
      </p>
      <a
        href={buildMapsSearchUrl(address)}
        target="_blank"
        rel="noreferrer"
        className="app-button-ghost inline-flex min-h-11 items-center px-3 py-2 text-xs font-semibold text-sky-700"
      >
        {t("admin.routes.assistant.location.mapsLink")}
      </a>
    </div>
  );
}

export default function LocationFixModal({
  open,
  stop,
  onClose,
  onFixed,
}: LocationFixModalProps) {
  const { t } = useI18n();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const addressId = `${baseId}-address`;
  const latId = `${baseId}-lat`;
  const lngId = `${baseId}-lng`;
  const addressRef = useRef<HTMLInputElement>(null);
  const [fix, setFix] = useState<FixState | null>(null);
  const [saving, setSaving] = useState(false);

  const state = stop
    ? (fix && fix.jobId === stop.jobId ? fix : initialState(stop))
    : null;

  const patch = (target: AssistantStop, changes: Partial<FixState>) =>
    setFix((previous) => ({
      ...(previous && previous.jobId === target.jobId
        ? previous
        : initialState(target)),
      ...changes,
    }));

  const failureText = t("admin.routes.assistant.location.failed");

  const saveAddress = async (target: AssistantStop, address: string) => {
    if (!isValidAddress(address)) {
      patch(target, { error: t("admin.routes.assistant.location.invalidAddress") });
      return;
    }
    setSaving(true);
    try {
      const result = await requestPropertyLocation(
        target.propertyId,
        { address: address.trim() },
        failureText
      );
      if (result.geocoded) {
        onFixed(target);
        return;
      }
      patch(target, { needsCoordinates: true, error: null });
    } catch (caught) {
      patch(target, { error: describeAssistantError(caught, t, failureText) });
    } finally {
      setSaving(false);
    }
  };

  const saveCoordinates = async (target: AssistantStop, lat: string, lng: string) => {
    const coordinates = parseCoordinates(lat, lng);
    if (!coordinates) {
      patch(target, {
        error: t("admin.routes.assistant.location.invalidCoordinates"),
      });
      return;
    }
    setSaving(true);
    try {
      await requestPropertyLocation(target.propertyId, coordinates, failureText);
      onFixed(target);
    } catch (caught) {
      patch(target, { error: describeAssistantError(caught, t, failureText) });
    } finally {
      setSaving(false);
    }
  };

  /** Pegar "25.7617, -80.1918" en latitud reparte el par en los dos campos. */
  const changeLatitude = (target: AssistantStop, value: string) => {
    const pair = parseCoordinatePair(value);
    if (pair) {
      patch(target, { lat: String(pair.lat), lng: String(pair.lng), error: null });
      return;
    }
    patch(target, { lat: value, error: null });
  };

  return (
    <AppModal
      open={open && stop !== null && state !== null}
      onClose={onClose}
      titleId={titleId}
      describedBy={descriptionId}
      cardClassName={CARD_CLASS}
      layerClassName="overflow-y-auto p-3 sm:p-6"
      initialFocusRef={addressRef}
    >
      {stop && state ? (
        <div className="p-5 sm:p-6" aria-busy={saving || undefined}>
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {t("admin.routes.assistant.location.title")}
          </h2>
          <p id={descriptionId} className="mt-2 text-sm text-slate-500">
            {t("admin.routes.assistant.location.description", {
              name: stop.customerName,
            })}
          </p>

          <div className="mt-4">
            <label htmlFor={addressId} className={FIELD_LABEL_CLASS}>
              {t("admin.routes.assistant.location.addressLabel")}
            </label>
            <input
              id={addressId}
              ref={addressRef}
              type="text"
              value={state.address}
              disabled={saving}
              onChange={(event) =>
                patch(stop, { address: event.target.value, error: null })
              }
              className={FIELD_CLASS}
            />
          </div>

          {state.needsCoordinates ? (
            <ManualCoordinates
              latId={latId}
              lngId={lngId}
              address={state.address}
              lat={state.lat}
              lng={state.lng}
              disabled={saving}
              onLatChange={(value) => changeLatitude(stop, value)}
              onLngChange={(value) => patch(stop, { lng: value, error: null })}
            />
          ) : null}

          {state.error ? (
            <p
              role="alert"
              className="app-callout mt-4 px-4 py-3 text-sm"
              data-tone="danger"
            >
              {state.error}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`app-button-secondary ${BUTTON_CLASS}`}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void (state.needsCoordinates
                  ? saveCoordinates(stop, state.lat, state.lng)
                  : saveAddress(stop, state.address))
              }
              className={`app-button-primary ${BUTTON_CLASS}`}
            >
              {saving
                ? t("admin.routes.assistant.location.saving")
                : t(
                    state.needsCoordinates
                      ? "admin.routes.assistant.location.saveCoordinates"
                      : "admin.routes.assistant.location.save"
                  )}
            </button>
          </div>
        </div>
      ) : null}
    </AppModal>
  );
}
