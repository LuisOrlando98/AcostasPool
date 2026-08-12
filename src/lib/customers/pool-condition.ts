export const POOL_CONDITION_STATUS_VALUES = ["BROKEN", "BAD", "GOOD"] as const;

export type PoolConditionStatus = (typeof POOL_CONDITION_STATUS_VALUES)[number];

export const POOL_CONDITION_ITEM_KEYS = [
  "pump",
  "filter",
  "heater",
  "timer",
  "saltSystem",
  "lighting",
  "tileLiner",
  "deckCover",
  "blower",
  "smartSystem",
  "hydraulicSystem",
  "electricalSystem",
] as const;

export type PoolConditionItemKey = (typeof POOL_CONDITION_ITEM_KEYS)[number];

export type PoolConditionEntry = {
  key: PoolConditionItemKey;
  status: PoolConditionStatus | null;
};

export function normalizePoolConditionStatus(
  value: string
): PoolConditionStatus | null {
  const normalized = value.trim().toUpperCase();
  return (POOL_CONDITION_STATUS_VALUES as readonly string[]).includes(normalized)
    ? (normalized as PoolConditionStatus)
    : null;
}

export function parsePoolConditionInput(
  getValue: (key: string) => string | null
): PoolConditionEntry[] {
  return POOL_CONDITION_ITEM_KEYS.map((key) => ({
    key,
    status: normalizePoolConditionStatus(getValue(`condition_${key}`) ?? ""),
  }));
}

export function readPoolCondition(value: unknown): PoolConditionEntry[] {
  if (!Array.isArray(value)) {
    return POOL_CONDITION_ITEM_KEYS.map((key) => ({ key, status: null }));
  }
  const byKey = new Map<string, PoolConditionStatus | null>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const key = String((entry as Record<string, unknown>).key ?? "");
    const status = normalizePoolConditionStatus(
      String((entry as Record<string, unknown>).status ?? "")
    );
    byKey.set(key, status);
  }
  return POOL_CONDITION_ITEM_KEYS.map((key) => ({
    key,
    status: byKey.get(key) ?? null,
  }));
}
