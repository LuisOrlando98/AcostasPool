"use client";

/**
 * Revisión automática diaria y punto de partida. Es una preferencia global,
 * no un filtro: por eso vive en un modal detrás de un enlace discreto y no
 * dentro del formulario de la propuesta, donde competía con la acción
 * principal de la pantalla.
 */

import { useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import AppModal from "@/components/ui/AppModal";
import { requestSettingsUpdate } from "./api";
import { describeAssistantError } from "./errors";
import type { RouteAssistantSettings } from "./types";

type AutomationModalProps = {
  readonly open: boolean;
  readonly settings: RouteAssistantSettings;
  readonly onClose: () => void;
  readonly onSaved: (settings: RouteAssistantSettings) => void;
};

const ORIGIN_MIN_LENGTH = 5;
const ORIGIN_MAX_LENGTH = 160;
const CARD_CLASS =
  "max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl";

export default function AutomationModal({
  open,
  settings,
  onClose,
  onSaved,
}: AutomationModalProps) {
  const { t } = useI18n();
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const toggleId = `${baseId}-toggle`;
  const originId = `${baseId}-origin`;
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [enabled, setEnabled] = useState(settings.dailyAutoOptimizeEnabled);
  const [originAddress, setOriginAddress] = useState(settings.originAddress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    const fallback = t("admin.routes.assistant.messages.preferencesFailed");
    try {
      const response = await requestSettingsUpdate(
        { dailyAutoOptimizeEnabled: enabled, originAddress: originAddress.trim() },
        fallback
      );
      onSaved(response.config);
    } catch (caught) {
      setError(describeAssistantError(caught, t, fallback));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      titleId={titleId}
      cardClassName={CARD_CLASS}
      layerClassName="overflow-y-auto p-3 sm:p-6"
      initialFocusRef={cancelRef}
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
    >
      <form
        className="p-5 sm:p-6"
        aria-busy={saving || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {t("admin.routes.assistant.automation.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          {t("admin.routes.assistant.automation.description")}
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
          <input
            id={toggleId}
            type="checkbox"
            className="app-toggle shrink-0"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <label htmlFor={toggleId} className="text-sm text-slate-700">
            {t("admin.routes.assistant.automation.toggleLabel")}
          </label>
        </div>

        <div className="mt-4">
          <label
            htmlFor={originId}
            className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500"
          >
            {t("admin.routes.assistant.fields.origin")}
          </label>
          <input
            id={originId}
            name="originAddress"
            type="text"
            required
            minLength={ORIGIN_MIN_LENGTH}
            maxLength={ORIGIN_MAX_LENGTH}
            value={originAddress}
            onChange={(event) => setOriginAddress(event.target.value)}
            className="app-input mt-2 w-full px-3 py-2.5 text-sm"
          />
          <p className="mt-1.5 text-xs text-slate-500">
            {t("admin.routes.assistant.automation.originHint")}
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="app-button-secondary min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {t("common.actions.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="app-button-primary min-h-11 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em]"
          >
            {saving
              ? t("admin.routes.assistant.actions.savingPreferences")
              : t("admin.routes.assistant.actions.savePreferences")}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
