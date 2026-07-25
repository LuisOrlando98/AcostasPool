"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  calculateChlorineDose,
  type ChlorineProduct,
  type LevelStatus,
} from "@/lib/pool/chlorine-calculator";

const PRODUCT_OPTIONS: ChlorineProduct[] = [
  "LIQUID_10",
  "LIQUID_12_5",
  "CAL_HYPO_65",
  "CAL_HYPO_73",
  "CUSTOM",
];

function parseField(value: string) {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function statusBadgeClass(status: LevelStatus) {
  if (status === "ok") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ChlorineCalculatorForm() {
  const { t } = useI18n();

  const [volume, setVolume] = useState("");
  const [ph, setPh] = useState("");
  const [freeChlorine, setFreeChlorine] = useState("");
  const [totalAlkalinity, setTotalAlkalinity] = useState("");
  const [stabilizer, setStabilizer] = useState("");
  const [product, setProduct] = useState<ChlorineProduct>("LIQUID_12_5");
  const [customStrength, setCustomStrength] = useState("12.5");

  const parsedVolume = parseField(volume);
  const parsedPh = parseField(ph);
  const parsedFreeChlorine = parseField(freeChlorine);
  const parsedTotalAlkalinity = parseField(totalAlkalinity);
  const parsedStabilizer = parseField(stabilizer);
  const parsedCustomStrength = parseField(customStrength);

  const isComplete =
    parsedVolume != null &&
    parsedVolume > 0 &&
    parsedPh != null &&
    parsedFreeChlorine != null &&
    parsedTotalAlkalinity != null &&
    parsedStabilizer != null &&
    (product !== "CUSTOM" || (parsedCustomStrength != null && parsedCustomStrength > 0));

  const result = useMemo(() => {
    if (!isComplete) {
      return null;
    }
    return calculateChlorineDose({
      poolVolumeGallons: parsedVolume as number,
      ph: parsedPh as number,
      freeChlorinePpm: parsedFreeChlorine as number,
      totalAlkalinityPpm: parsedTotalAlkalinity as number,
      stabilizerPpm: parsedStabilizer as number,
      product,
      customStrengthPercent: parsedCustomStrength ?? undefined,
    });
  }, [
    isComplete,
    parsedVolume,
    parsedPh,
    parsedFreeChlorine,
    parsedTotalAlkalinity,
    parsedStabilizer,
    product,
    parsedCustomStrength,
  ]);

  const productLabel = t(`poolCalculator.products.${product}`);

  return (
    <section className="app-card p-4 shadow-contrast sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">{t("poolCalculator.title")}</h2>
      <p className="text-sm text-slate-500">{t("poolCalculator.subtitle")}</p>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("poolCalculator.fields.volume")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={volume}
            onChange={(event) => setVolume(event.target.value)}
            placeholder={t("poolCalculator.placeholders.volume")}
            className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("poolCalculator.fields.product")}
          </label>
          <select
            value={product}
            onChange={(event) => setProduct(event.target.value as ChlorineProduct)}
            className="app-input mt-2 w-full bg-white px-4 py-3 text-sm text-slate-700"
          >
            {PRODUCT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`poolCalculator.products.${option}`)}
              </option>
            ))}
          </select>
        </div>

        {product === "CUSTOM" ? (
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("poolCalculator.fields.customStrength")}
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={customStrength}
              onChange={(event) => setCustomStrength(event.target.value)}
              className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
            />
          </div>
        ) : null}

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("poolCalculator.fields.freeChlorine")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={freeChlorine}
            onChange={(event) => setFreeChlorine(event.target.value)}
            placeholder={t("poolCalculator.placeholders.freeChlorine")}
            className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("poolCalculator.fields.stabilizer")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={stabilizer}
            onChange={(event) => setStabilizer(event.target.value)}
            placeholder={t("poolCalculator.placeholders.stabilizer")}
            className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("poolCalculator.fields.ph")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={ph}
            onChange={(event) => setPh(event.target.value)}
            placeholder={t("poolCalculator.placeholders.ph")}
            className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("poolCalculator.fields.totalAlkalinity")}
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            value={totalAlkalinity}
            onChange={(event) => setTotalAlkalinity(event.target.value)}
            placeholder={t("poolCalculator.placeholders.totalAlkalinity")}
            className="app-input mt-2 w-full px-4 py-3 text-sm text-slate-700"
          />
        </div>
      </div>

      {!result ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {t("poolCalculator.incompleteHint")}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
              {t("poolCalculator.results.doseTitle")}
            </p>
            {result.ppmToAdd <= 0 ? (
              <p className="mt-2 text-sm font-semibold text-sky-900">
                {t("poolCalculator.results.doseNone")}
              </p>
            ) : (
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {t("poolCalculator.results.doseAmount", {
                  amount: String(result.doseAmount),
                  unit: t(`poolCalculator.units.${result.doseUnit}`),
                  product: productLabel,
                })}
              </p>
            )}
            <p className="mt-1 text-xs text-sky-800">
              {t("poolCalculator.results.currentToTarget", {
                current: String(freeChlorine),
                target: String(result.targetMidFC),
              })}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t("poolCalculator.results.targetRangeTitle")}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {t("poolCalculator.results.minimum")}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {result.targetMinFC}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {t("poolCalculator.results.target")}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {result.targetLowFC}-{result.targetHighFC}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {t("poolCalculator.results.shock")}
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-800">{result.shockFC}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("poolCalculator.results.phTitle")}
                </p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                    result.phStatus
                  )}`}
                >
                  {t(`poolCalculator.results.status.${result.phStatus}`)}
                </span>
              </div>
              {result.phStatus !== "ok" ? (
                <p className="mt-2 text-xs text-slate-600">
                  {t(
                    result.phStatus === "low"
                      ? "poolCalculator.results.phLowHint"
                      : "poolCalculator.results.phHighHint"
                  )}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {t("poolCalculator.results.alkalinityTitle")}
                </p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                    result.alkalinityStatus
                  )}`}
                >
                  {t(`poolCalculator.results.status.${result.alkalinityStatus}`)}
                </span>
              </div>
              {result.alkalinityStatus !== "ok" ? (
                <p className="mt-2 text-xs text-slate-600">
                  {t(
                    result.alkalinityStatus === "low"
                      ? "poolCalculator.results.alkalinityLowHint"
                      : "poolCalculator.results.alkalinityHighHint"
                  )}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <p className="mt-5 text-xs text-slate-400">{t("poolCalculator.disclaimer")}</p>
    </section>
  );
}
