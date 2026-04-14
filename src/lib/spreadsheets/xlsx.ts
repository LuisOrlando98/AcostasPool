import { inflateRawSync } from "zlib";

type WorksheetMatrix = {
  headers: string[];
  rows: string[][];
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date) {
  const safeYear = Math.max(date.getFullYear(), 1980);
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    (((safeYear - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);

  return {
    dosDate,
    dosTime,
  };
}

function buildZip(entries: Array<{ name: string; data: Buffer }>) {
  const now = new Date();
  const { dosDate, dosTime } = toDosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const fileData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const checksum = crc32(fileData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(fileData.length, 18);
    localHeader.writeUInt32LE(fileData.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, fileData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(fileData.length, 20);
    centralHeader.writeUInt32LE(fileData.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileName);

    offset += localHeader.length + fileName.length + fileData.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnNameFromIndex(index: number) {
  let current = index + 1;
  let label = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

function columnIndexFromName(label: string) {
  let value = 0;
  for (const char of label) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value - 1;
}

function buildWorksheetXml(headers: string[], rows: string[][]) {
  const allRows = [headers, ...rows];
  const maxColumnCount = Math.max(headers.length, ...rows.map((row) => row.length));
  const lastCellRef = `${columnNameFromIndex(Math.max(0, maxColumnCount - 1))}${Math.max(
    1,
    allRows.length
  )}`;
  const widthXml = headers
    .map((header, index) => {
      const widestValue = Math.max(
        header.length,
        ...rows.map((row) => (row[index] ?? "").length)
      );
      const width = Math.min(48, Math.max(12, widestValue + 2));
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join("");

  const rowXml = allRows
    .map((row, rowIndex) => {
      const cells = headers
        .map((_, columnIndex) => {
          const value = row[columnIndex] ?? "";
          const reference = `${columnNameFromIndex(columnIndex)}${rowIndex + 1}`;
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(
            value
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCellRef}"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${widthXml}</cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="A1:${columnNameFromIndex(Math.max(0, headers.length - 1))}1"/>
</worksheet>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <name val="Aptos"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <name val="Aptos"/>
    </font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

export function createWorkbookXlsx(options: {
  sheetName: string;
  headers: string[];
  rows: string[][];
}) {
  const safeSheetName =
    options.sheetName.replace(/[\\/*?:\[\]]/g, " ").trim().slice(0, 31) || "Sheet1";
  const worksheetXml = buildWorksheetXml(options.headers, options.rows);
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${xmlEscape(safeSheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return buildZip([
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rootRelsXml, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml, "utf8") },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(workbookRelsXml, "utf8"),
    },
    { name: "xl/styles.xml", data: Buffer.from(buildStylesXml(), "utf8") },
    { name: "xl/worksheets/sheet1.xml", data: Buffer.from(worksheetXml, "utf8") },
  ]);
}

function unzipEntries(buffer: Buffer) {
  const maxCommentLength = 0xffff;
  const searchStart = Math.max(0, buffer.length - (22 + maxCommentLength));
  let endOfCentralDirectoryOffset = -1;

  for (let index = buffer.length - 22; index >= searchStart; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      endOfCentralDirectoryOffset = index;
      break;
    }
  }

  if (endOfCentralDirectoryOffset < 0) {
    throw new Error("El archivo XLSX no tiene una estructura ZIP valida.");
  }

  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);
  const files = new Map<string, Buffer>();
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("No se pudo leer el directorio central del XLSX.");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error("No se pudo leer un archivo interno del XLSX.");
    }

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      files.set(fileName, Buffer.from(compressedData));
    } else if (compressionMethod === 8) {
      files.set(fileName, inflateRawSync(compressedData));
    } else {
      throw new Error("El XLSX usa un metodo de compresion no soportado.");
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function extractWorkbookSheetPath(files: Map<string, Buffer>) {
  const workbookXml = files.get("xl/workbook.xml")?.toString("utf8");
  const workbookRelsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8");

  if (!workbookXml || !workbookRelsXml) {
    throw new Error("El XLSX no contiene la informacion del workbook.");
  }

  const sheetMatch = workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"/);
  if (!sheetMatch) {
    throw new Error("El XLSX no contiene hojas legibles.");
  }

  const relationshipId = sheetMatch[1];
  const relationshipRegex = new RegExp(
    `<Relationship\\b[^>]*Id="${relationshipId}"[^>]*Target="([^"]+)"`,
    "i"
  );
  const relationshipMatch = workbookRelsXml.match(relationshipRegex);

  if (!relationshipMatch) {
    throw new Error("No se pudo resolver la hoja principal del XLSX.");
  }

  const target = relationshipMatch[1].replace(/^\/+/, "");
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function parseSharedStrings(xml: string) {
  const items = Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g));

  return items.map((match) => {
    const raw = match[1];
    const textParts = Array.from(raw.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map(
      (item) => decodeXmlEntities(item[1])
    );

    return textParts.join("");
  });
}

function parseCellValue(
  attributes: string,
  body: string,
  sharedStrings: string[]
) {
  const typeMatch = attributes.match(/\bt="([^"]+)"/);
  const cellType = typeMatch?.[1] ?? "";

  if (cellType === "inlineStr") {
    const inlineText = Array.from(body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((item) => decodeXmlEntities(item[1]))
      .join("");
    return inlineText;
  }

  const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  const rawValue = valueMatch ? decodeXmlEntities(valueMatch[1]) : "";

  if (cellType === "s") {
    const index = Number(rawValue);
    return Number.isFinite(index) ? sharedStrings[index] ?? "" : "";
  }

  if (cellType === "b") {
    return rawValue === "1" ? "true" : "false";
  }

  return rawValue;
}

export function parseWorkbookXlsx(buffer: Buffer): WorksheetMatrix {
  const files = unzipEntries(buffer);
  const worksheetPath = extractWorkbookSheetPath(files);
  const worksheetXml = files.get(worksheetPath)?.toString("utf8");

  if (!worksheetXml) {
    throw new Error("No se encontro la hoja principal del XLSX.");
  }

  const sharedStringsXml = files.get("xl/sharedStrings.xml")?.toString("utf8");
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const rowsByNumber = new Map<number, string[]>();

  const rowMatches = worksheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g);
  for (const rowMatch of rowMatches) {
    const rowNumber = Number(rowMatch[1]);
    const rowCells = rowMatch[2];
    const values = rowsByNumber.get(rowNumber) ?? [];
    const cellMatches = rowCells.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);

    for (const cellMatch of cellMatches) {
      const attributes = cellMatch[1];
      const referenceMatch = attributes.match(/\br="([A-Z]+)\d+"/);
      if (!referenceMatch) {
        continue;
      }

      const columnIndex = columnIndexFromName(referenceMatch[1]);
      values[columnIndex] = parseCellValue(attributes, cellMatch[2], sharedStrings);
    }

    rowsByNumber.set(rowNumber, values);
  }

  const orderedRows = Array.from(rowsByNumber.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([, values]) => values);

  if (orderedRows.length === 0) {
    throw new Error("El XLSX no contiene filas para importar.");
  }

  const headers = orderedRows[0].map((value) => value ?? "");
  const dataRows = orderedRows
    .slice(1)
    .map((row) => headers.map((_, index) => row[index] ?? ""))
    .filter((row) => row.some((value) => value.trim() !== ""));

  return {
    headers,
    rows: dataRows,
  };
}
