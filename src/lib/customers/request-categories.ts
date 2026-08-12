export const REQUEST_CATEGORY_VALUES = ["HYDRAULIC", "ELECTRICAL", "STRUCTURE", "OTHER"] as const;
export type RequestCategory = (typeof REQUEST_CATEGORY_VALUES)[number];

export const REQUEST_ISSUE_OPTIONS: Record<Exclude<RequestCategory, "OTHER">, string[]> = {
  HYDRAULIC: ["pump", "filter", "piping", "other"],
  ELECTRICAL: ["timer", "panel", "other"],
  STRUCTURE: ["leak", "skimmer", "tile", "other"],
};

export function normalizeRequestCategory(value: string): RequestCategory | null {
  const normalized = value.trim().toUpperCase();
  return (REQUEST_CATEGORY_VALUES as readonly string[]).includes(normalized)
    ? (normalized as RequestCategory)
    : null;
}

export function normalizeRequestIssue(category: RequestCategory, value: string): string | null {
  if (category === "OTHER") {
    return null;
  }
  const options = REQUEST_ISSUE_OPTIONS[category];
  return options.includes(value) ? value : null;
}
