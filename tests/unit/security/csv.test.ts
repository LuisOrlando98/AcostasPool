import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "@/lib/reports/csv";

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

describe("escapeCsvCell", () => {
  it("quotes every cell", () => {
    expect(escapeCsvCell("Ana")).toBe('"Ana"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("renders null and undefined as an empty cell", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it("keeps separators and newlines inside the quoted cell", () => {
    expect(escapeCsvCell("Miami, FL")).toBe('"Miami, FL"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralizes every character a spreadsheet reads as a formula", () => {
    for (const prefix of FORMULA_PREFIXES) {
      expect(escapeCsvCell(`${prefix}SUM(A1)`)).toBe(`"'${prefix}SUM(A1)"`);
    }
  });

  it("neutralizes a formula that also contains quotes", () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil","click")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""click"")"'
    );
  });

  it("leaves a value that only contains a formula character untouched", () => {
    expect(escapeCsvCell("2+2")).toBe('"2+2"');
    expect(escapeCsvCell("a@b.com")).toBe('"a@b.com"');
  });

  it("keeps a plain number a number, whatever its sign", () => {
    // A leading "-" or "+" is a formula prefix, but a bare number cannot be a
    // formula: guarding it would export every negative amount as text.
    expect(escapeCsvCell("-12.50")).toBe('"-12.50"');
    expect(escapeCsvCell("+5")).toBe('"+5"');
    expect(escapeCsvCell("-1234,56")).toBe('"-1234,56"');
    expect(escapeCsvCell(" -12.50 ")).toBe('" -12.50 "');
  });

  it("still guards an expression that only starts like a number", () => {
    expect(escapeCsvCell("-1+1")).toBe("\"'-1+1\"");
    expect(escapeCsvCell("+34 600 000 000")).toBe("\"'+34 600 000 000\"");
    expect(escapeCsvCell("-12.50.3")).toBe("\"'-12.50.3\"");
  });

  it("stringifies non-string values", () => {
    expect(escapeCsvCell(42)).toBe('"42"');
    expect(escapeCsvCell(false)).toBe('"false"');
  });
});

describe("buildCsv", () => {
  it("joins cells with commas and rows with newlines", () => {
    expect(
      buildCsv([
        ["Job ID", "Customer"],
        ["1", "Ana"],
      ])
    ).toBe('"Job ID","Customer"\n"1","Ana"');
  });

  it("escapes every cell of every row", () => {
    expect(buildCsv([["=cmd|"], ["ok"]])).toBe('"\'=cmd|"\n"ok"');
  });

  it("returns an empty document for no rows", () => {
    expect(buildCsv([])).toBe("");
  });
});
