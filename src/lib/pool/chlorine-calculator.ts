// Chlorine dosing based on the free-chlorine/cyanuric-acid relationship
// (minimum FC ~= CYA x 7.5%, target FC ~= CYA x 10-15%, shock FC ~= CYA x 40%),
// the methodology used industry-wide for stabilized pools (e.g. Trouble Free
// Pool's chlorine/CYA chart). Dosing constants below are anchored to the
// commonly published industry figures for a 10,000 gallon pool: ~10.6 fl oz
// (~0.083 gal) of 12.5% liquid chlorine, or ~2.0 oz of 65% cal-hypo, raise
// FC by 1 ppm. Liquid is reported in gallons (how techs buy/pour it),
// granular stays in ounces (how it's scooped/weighed).

export type ChlorineProduct =
  | "LIQUID_10"
  | "LIQUID_12_5"
  | "CAL_HYPO_65"
  | "CAL_HYPO_73"
  | "CUSTOM";

export type ChlorineCalculatorInput = {
  poolVolumeGallons: number;
  ph: number;
  freeChlorinePpm: number;
  totalAlkalinityPpm: number;
  stabilizerPpm: number;
  product: ChlorineProduct;
  customStrengthPercent?: number;
};

export type LevelStatus = "low" | "ok" | "high";

export type ChlorineCalculatorResult = {
  targetMinFC: number;
  targetLowFC: number;
  targetHighFC: number;
  targetMidFC: number;
  shockFC: number;
  ppmToAdd: number;
  doseAmount: number;
  doseUnit: "gal" | "oz";
  phStatus: LevelStatus;
  alkalinityStatus: LevelStatus;
};

const PH_MIN = 7.2;
const PH_MAX = 7.8;
const TA_MIN = 80;
const TA_MAX = 120;

// gallons (or oz) x strength% needed per 10,000 gallons per 1 ppm FC increase.
const LIQUID_DOSE_CONSTANT = 132.5 / 128; // fl oz constant converted to gallons
const GRANULAR_DOSE_CONSTANT = 130;

function round(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function resolveProductStrength(
  product: ChlorineProduct,
  customStrengthPercent?: number
): { strength: number; form: "liquid" | "granular" } {
  switch (product) {
    case "LIQUID_10":
      return { strength: 10, form: "liquid" };
    case "LIQUID_12_5":
      return { strength: 12.5, form: "liquid" };
    case "CAL_HYPO_65":
      return { strength: 65, form: "granular" };
    case "CAL_HYPO_73":
      return { strength: 73, form: "granular" };
    case "CUSTOM":
      return { strength: customStrengthPercent && customStrengthPercent > 0 ? customStrengthPercent : 12.5, form: "liquid" };
  }
}

export function calculateChlorineDose(
  input: ChlorineCalculatorInput
): ChlorineCalculatorResult {
  const cya = Math.max(0, input.stabilizerPpm);

  const targetMinFC = round(Math.max(2, cya * 0.075), 1);
  const targetLowFC = round(Math.max(3, cya * 0.1), 1);
  const targetHighFC = round(Math.max(4, cya * 0.15), 1);
  const shockFC = round(Math.max(targetHighFC, cya * 0.4), 1);
  const targetMidFC = round((targetLowFC + targetHighFC) / 2, 1);

  const ppmToAdd = Math.max(0, round(targetMidFC - input.freeChlorinePpm, 1));

  const { strength, form } = resolveProductStrength(
    input.product,
    input.customStrengthPercent
  );
  const constant = form === "liquid" ? LIQUID_DOSE_CONSTANT : GRANULAR_DOSE_CONSTANT;
  const doseAmount = round(
    (Math.max(0, input.poolVolumeGallons) / 10000) * ppmToAdd * (constant / strength),
    2
  );

  const phStatus: LevelStatus =
    input.ph < PH_MIN ? "low" : input.ph > PH_MAX ? "high" : "ok";
  const alkalinityStatus: LevelStatus =
    input.totalAlkalinityPpm < TA_MIN
      ? "low"
      : input.totalAlkalinityPpm > TA_MAX
        ? "high"
        : "ok";

  return {
    targetMinFC,
    targetLowFC,
    targetHighFC,
    targetMidFC,
    shockFC,
    ppmToAdd,
    doseAmount,
    doseUnit: form === "liquid" ? "gal" : "oz",
    phStatus,
    alkalinityStatus,
  };
}
