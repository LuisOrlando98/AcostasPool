/** Lectura defensiva de los payloads JSON de Notification / TechDigestItem. */
export type JsonRecord = Readonly<Record<string, unknown>>;

export function asRecord(value: unknown): JsonRecord {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

export function readString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function readDate(record: JsonRecord, key: string): Date | null {
  const raw = readString(record, key);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
