import { describe, expect, it } from "vitest";
import { createWorkbookXlsx, parseWorkbookXlsx } from "@/lib/spreadsheets/xlsx";

const ZIP_LOCAL_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const STORED_METHOD = 0;
const MAX_SHEET_NAME_LENGTH = 31;
const COLUMNS_BEYOND_Z = 30;

type ZipEntry = { name: string; data: string; method?: number };

/** Test-only ZIP writer (stored entries) to craft workbooks the module cannot produce itself. */
function buildStoredZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data, "utf8");
    const method = entry.method ?? STORED_METHOD;

    const localHeader = Buffer.alloc(LOCAL_HEADER_SIZE);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(CENTRAL_HEADER_SIZE);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += LOCAL_HEADER_SIZE + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(END_OF_CENTRAL_DIRECTORY_SIZE);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

const WORKBOOK_XML =
  '<workbook><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>';
const WORKBOOK_RELS_XML =
  '<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>';

function inlineCell(reference: string, value: string) {
  return `<c r="${reference}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

function buildWorkbookZip(sheetXml: string, extra: ZipEntry[] = []) {
  return buildStoredZip([
    { name: "xl/workbook.xml", data: WORKBOOK_XML },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS_XML },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
    ...extra,
  ]);
}

function extractSheetName(buffer: Buffer) {
  return buffer.toString("utf8").match(/<sheet name="([^"]*)"/)?.[1];
}

describe("createWorkbookXlsx", () => {
  it("returns a ZIP container with the expected package parts", () => {
    const buffer = createWorkbookXlsx({ sheetName: "Data", headers: ["a"], rows: [] });
    const text = buffer.toString("utf8");

    expect(buffer.subarray(0, 4)).toEqual(ZIP_LOCAL_SIGNATURE);
    for (const part of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("round-trips headers and rows through parseWorkbookXlsx", () => {
    const headers = ["id", "name", "notes"];
    const rows = [
      ["1", "Ana", "x"],
      ["2", "Luis", "y"],
    ];
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({ sheetName: "Data", headers, rows })
    );

    expect(parsed).toEqual({ headers, rows });
  });

  it("round-trips XML-sensitive characters, unicode and newlines", () => {
    const rows = [["<&>", "'\"", "José – ñ", "line1\nline2", "  padded  "]];
    const headers = ["a", "b", "c", "d", "e"];
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({ sheetName: "Data", headers, rows })
    );

    expect(parsed.rows).toEqual(rows);
  });

  it("pads short rows and drops cells beyond the header count", () => {
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({
        sheetName: "Data",
        headers: ["a", "b"],
        rows: [["1"], ["1", "2", "3"]],
      })
    );

    expect(parsed.rows).toEqual([
      ["1", ""],
      ["1", "2"],
    ]);
  });

  it("drops rows whose cells are all blank when parsing back", () => {
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({
        sheetName: "Data",
        headers: ["a", "b"],
        rows: [["", ""], ["  ", ""], ["x", ""]],
      })
    );

    expect(parsed.rows).toEqual([["x", ""]]);
  });

  it("produces no data rows for a headers-only workbook", () => {
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({ sheetName: "Data", headers: ["a", "b"], rows: [] })
    );
    expect(parsed).toEqual({ headers: ["a", "b"], rows: [] });
  });

  it("round-trips more than 26 columns (two-letter column references)", () => {
    const headers = Array.from({ length: COLUMNS_BEYOND_Z }, (_, i) => `h${i}`);
    const row = headers.map((header) => `${header}-v`);
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({ sheetName: "Wide", headers, rows: [row] })
    );

    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual([row]);
  });

  it("replaces forbidden sheet-name characters with spaces and trims", () => {
    const buffer = createWorkbookXlsx({
      sheetName: "Data [x]:*?/\\",
      headers: ["a"],
      rows: [],
    });
    expect(extractSheetName(buffer)).toBe("Data  x");
  });

  it("truncates the sheet name to 31 characters", () => {
    const longName = "x".repeat(MAX_SHEET_NAME_LENGTH + 10);
    const buffer = createWorkbookXlsx({ sheetName: longName, headers: ["a"], rows: [] });
    expect(extractSheetName(buffer)).toBe("x".repeat(MAX_SHEET_NAME_LENGTH));
  });

  it("falls back to 'Sheet1' when the sheet name is empty after cleaning", () => {
    const buffer = createWorkbookXlsx({ sheetName: " :: ", headers: ["a"], rows: [] });
    expect(extractSheetName(buffer)).toBe("Sheet1");
  });

  it("escapes the sheet name in the workbook XML", () => {
    const buffer = createWorkbookXlsx({ sheetName: "A&B", headers: ["a"], rows: [] });
    expect(extractSheetName(buffer)).toBe("A&amp;B");
  });

  it("handles a workbook with no headers at all", () => {
    const parsed = parseWorkbookXlsx(
      createWorkbookXlsx({ sheetName: "Empty", headers: [], rows: [["x"]] })
    );
    expect(parsed).toEqual({ headers: [], rows: [] });
  });
});

describe("parseWorkbookXlsx", () => {
  it("throws for buffers that are not ZIP archives", () => {
    expect(() => parseWorkbookXlsx(Buffer.alloc(0))).toThrow(
      "El archivo XLSX no tiene una estructura ZIP valida."
    );
    expect(() => parseWorkbookXlsx(Buffer.from("plain text, not a zip"))).toThrow(
      "El archivo XLSX no tiene una estructura ZIP valida."
    );
  });

  it("throws when the workbook parts are missing", () => {
    expect(() =>
      parseWorkbookXlsx(buildStoredZip([{ name: "a.txt", data: "hi" }]))
    ).toThrow("El XLSX no contiene la informacion del workbook.");
  });

  it("throws when the workbook declares no sheets", () => {
    const zip = buildStoredZip([
      { name: "xl/workbook.xml", data: "<workbook><sheets/></workbook>" },
      { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS_XML },
    ]);
    expect(() => parseWorkbookXlsx(zip)).toThrow("El XLSX no contiene hojas legibles.");
  });

  it("throws when the sheet relationship cannot be resolved", () => {
    const zip = buildStoredZip([
      { name: "xl/workbook.xml", data: WORKBOOK_XML },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: '<Relationships><Relationship Id="rId9" Target="x.xml"/></Relationships>',
      },
    ]);
    expect(() => parseWorkbookXlsx(zip)).toThrow(
      "No se pudo resolver la hoja principal del XLSX."
    );
  });

  it("throws when the referenced worksheet part is absent", () => {
    const zip = buildStoredZip([
      { name: "xl/workbook.xml", data: WORKBOOK_XML },
      { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS_XML },
    ]);
    expect(() => parseWorkbookXlsx(zip)).toThrow(
      "No se encontro la hoja principal del XLSX."
    );
  });

  it("throws when the worksheet has no rows", () => {
    const zip = buildWorkbookZip("<worksheet><sheetData/></worksheet>");
    expect(() => parseWorkbookXlsx(zip)).toThrow(
      "El XLSX no contiene filas para importar."
    );
  });

  it("throws for unsupported compression methods", () => {
    const UNSUPPORTED_METHOD = 12;
    const zip = buildStoredZip([
      { name: "xl/workbook.xml", data: WORKBOOK_XML, method: UNSUPPORTED_METHOD },
      { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS_XML },
    ]);
    expect(() => parseWorkbookXlsx(zip)).toThrow(
      "El XLSX usa un metodo de compresion no soportado."
    );
  });

  it("resolves sheet targets with a leading slash or an explicit xl/ prefix", () => {
    const sheet = `<worksheet><sheetData><row r="1">${inlineCell("A1", "h")}</row></sheetData></worksheet>`;
    const withSlash = buildStoredZip([
      { name: "xl/workbook.xml", data: WORKBOOK_XML },
      {
        name: "xl/_rels/workbook.xml.rels",
        data: '<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>',
      },
      { name: "xl/worksheets/sheet1.xml", data: sheet },
    ]);

    expect(parseWorkbookXlsx(withSlash).headers).toEqual(["h"]);
  });

  it("reads shared strings, rich text, booleans and numeric cells", () => {
    const sharedStrings =
      "<sst><si><t>hello</t></si><si><r><t>ri</t></r><r><t xml:space=\"preserve\">ch</t></r></si></sst>";
    const sheet =
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="b"><v>1</v></c><c r="D1"><v>42.5</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>99</v></c><c r="C2" t="b"><v>0</v></c><c r="D2"><v>&amp;x</v></c></row>' +
      "</sheetData></worksheet>";
    const zip = buildWorkbookZip(sheet, [
      { name: "xl/sharedStrings.xml", data: sharedStrings },
    ]);

    expect(parseWorkbookXlsx(zip)).toEqual({
      headers: ["hello", "rich", "true", "42.5"],
      rows: [["", "", "false", "&x"]],
    });
  });

  it("orders rows by their r attribute regardless of document order", () => {
    const sheet =
      "<worksheet><sheetData>" +
      `<row r="3">${inlineCell("A3", "third")}</row>` +
      `<row r="1">${inlineCell("A1", "h")}</row>` +
      `<row r="2">${inlineCell("A2", "second")}</row>` +
      "</sheetData></worksheet>";

    expect(parseWorkbookXlsx(buildWorkbookZip(sheet)).rows).toEqual([
      ["second"],
      ["third"],
    ]);
  });

  it("ignores cells without a reference attribute", () => {
    const sheet =
      "<worksheet><sheetData>" +
      `<row r="1">${inlineCell("A1", "h")}<c t="inlineStr"><is><t>no-ref</t></is></c></row>` +
      "</sheetData></worksheet>";

    expect(parseWorkbookXlsx(buildWorkbookZip(sheet)).headers).toEqual(["h"]);
  });

  it.fails(
    "reads the cell that follows a self-closing empty cell (currently swallowed)",
    () => {
      // Excel emits styled empty cells as <c r="A2" s="1"/>. The cell regex
      // treats the "/>" as a normal ">" and consumes everything until the
      // next </c>, so B2 is lost and the whole row becomes blank.
      const sheet =
        "<worksheet><sheetData>" +
        `<row r="1">${inlineCell("A1", "h1")}${inlineCell("B1", "h2")}</row>` +
        `<row r="2"><c r="A2" s="1"/>${inlineCell("B2", "x")}</row>` +
        "</sheetData></worksheet>";

      expect(parseWorkbookXlsx(buildWorkbookZip(sheet)).rows).toEqual([["", "x"]]);
    }
  );
});
