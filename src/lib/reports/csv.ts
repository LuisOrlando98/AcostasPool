/**
 * CSV serialization for the admin report exports.
 *
 * Besides the usual quoting, every cell is neutralized against formula
 * injection: a spreadsheet treats a cell starting with `=`, `+`, `-`, `@`, a
 * tab or a carriage return as a formula, so a customer name such as
 * `=HYPERLINK("http://evil","click")` would execute when an admin opens the
 * downloaded file. Prefixing those cells with an apostrophe makes the
 * spreadsheet read them as text, and the value itself is preserved.
 */

/** Leading characters a spreadsheet interprets as the start of a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"] as const;
/** Apostrophe: the spreadsheet convention for "treat this cell as text". */
const FORMULA_GUARD = "'";
const CSV_FIELD_SEPARATOR = ",";
const CSV_ROW_SEPARATOR = "\n";
/**
 * A plain number (optionally signed, with a decimal point or comma) cannot be a
 * formula, so it keeps its sign and stays a number in the spreadsheet: amounts
 * such as -12.50 must not be exported as text.
 */
const PLAIN_NUMBER_PATTERN = /^[+-]?\d+([.,]\d+)?$/;

function startsWithFormulaPrefix(value: string): boolean {
  return FORMULA_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function needsFormulaGuard(value: string): boolean {
  return startsWithFormulaPrefix(value) && !PLAIN_NUMBER_PATTERN.test(value.trim());
}

/** Quotes one cell and neutralizes it when it would be read as a formula. */
export function escapeCsvCell(value: unknown): string {
  const raw = String(value ?? "");
  const guarded = needsFormulaGuard(raw) ? `${FORMULA_GUARD}${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Joins header and data rows into a CSV document with every cell escaped. */
export function buildCsv(rows: readonly (readonly unknown[])[]): string {
  return rows
    .map((row) => row.map(escapeCsvCell).join(CSV_FIELD_SEPARATOR))
    .join(CSV_ROW_SEPARATOR);
}
