import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildInvoicePdfAssetPath } from "@/lib/storage/paths";
import {
  normalizeInvoiceTemplateConfig,
  toPdfRgbTuple,
  type InvoiceTemplateConfig,
} from "@/lib/invoice-template";

export type InvoiceLineItem = {
  label: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
};

type InvoicePdfInput = {
  customerId: string;
  invoiceNumber: string;
  issueDate: Date;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  theme?: "STANDARD" | "SPECIAL" | "ESTIMATE";
  template?: InvoiceTemplateConfig;
};

async function loadHorizontalLogo(pdfDoc: PDFDocument) {
  try {
    const logoPath = join(process.cwd(), "public", "h-logo.png");
    const logoBytes = await readFile(logoPath);
    return pdfDoc.embedPng(logoBytes);
  } catch {
    return null;
  }
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  if (font.widthOfTextAtSize(cleaned, size) <= maxWidth) {
    return cleaned;
  }

  const ellipsis = "...";
  let result = cleaned;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}${ellipsis}`, size) > maxWidth) {
    result = result.slice(0, -1).trimEnd();
  }
  return result ? `${result}${ellipsis}` : ellipsis;
}

function drawRightText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: rightX - width,
    y,
    size,
    font,
    color,
  });
}

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadHorizontalLogo(pdfDoc);

  const { width, height } = page.getSize();
  const margin = 44;
  const contentWidth = width - margin * 2;

  const theme = input.theme ?? "STANDARD";
  const template = normalizeInvoiceTemplateConfig(input.template);
  const themeConfig = template.themes[theme];

  const [brandR, brandG, brandB] = toPdfRgbTuple(themeConfig.brandHex);
  const [accentR, accentG, accentB] = toPdfRgbTuple(themeConfig.accentHex);
  const [lightR, lightG, lightB] = toPdfRgbTuple(themeConfig.lightHex);

  const brand = rgb(brandR, brandG, brandB);
  const accent = rgb(accentR, accentG, accentB);
  const light = rgb(lightR, lightG, lightB);
  const ink = rgb(0.06, 0.11, 0.18);
  const muted = rgb(0.35, 0.42, 0.5);

  const headerHeight = 118;
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: headerHeight,
    color: brand,
  });
  page.drawRectangle({
    x: 0,
    y: height - headerHeight,
    width,
    height: 6,
    color: accent,
  });

  if (logo) {
    const maxLogoWidth = 180;
    const logoScale = Math.min(maxLogoWidth / logo.width, 0.35);
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    page.drawImage(logo, {
      x: margin,
      y: height - 28 - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
  } else {
    page.drawText(template.companyName, {
      x: margin,
      y: height - 54,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  }

  const label = themeConfig.label;
  const rightEdge = width - margin;
  drawRightText(page, label, rightEdge, height - 44, 24, fontBold, rgb(1, 1, 1));
  drawRightText(
    page,
    `${template.invoiceNumberLabel}: ${input.invoiceNumber}`,
    rightEdge,
    height - 66,
    10.5,
    font,
    rgb(0.9, 0.95, 1)
  );
  drawRightText(
    page,
    `${template.issueDateLabel}: ${input.issueDate.toLocaleDateString("en-US")}`,
    rightEdge,
    height - 80,
    10.5,
    font,
    rgb(0.9, 0.95, 1)
  );

  if (theme === "ESTIMATE" && template.showEstimateWatermark) {
    const watermark = themeConfig.watermarkText?.trim() || "ESTIMATE";
    page.drawText(watermark, {
      x: 120,
      y: height / 2 + 42,
      size: 62,
      font: fontBold,
      color: rgb(0.86, 0.89, 0.93),
      rotate: degrees(-12),
    });
  }

  const infoTopY = height - headerHeight - 18;
  const infoHeight = 102;
  const infoGap = 14;
  const infoWidth = (contentWidth - infoGap) / 2;

  const billCardX = margin;
  const issuerCardX = margin + infoWidth + infoGap;
  const infoY = infoTopY - infoHeight;

  page.drawRectangle({
    x: billCardX,
    y: infoY,
    width: infoWidth,
    height: infoHeight,
    color: rgb(0.99, 0.995, 1),
    borderColor: rgb(0.87, 0.91, 0.96),
    borderWidth: 1,
  });
  page.drawRectangle({
    x: issuerCardX,
    y: infoY,
    width: infoWidth,
    height: infoHeight,
    color: rgb(0.99, 0.995, 1),
    borderColor: rgb(0.87, 0.91, 0.96),
    borderWidth: 1,
  });

  page.drawText(template.billToLabel.toUpperCase(), {
    x: billCardX + 12,
    y: infoTopY - 18,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("ISSUED BY", {
    x: issuerCardX + 12,
    y: infoTopY - 18,
    size: 9,
    font: fontBold,
    color: muted,
  });

  const customerLines = [
    input.customerName,
    input.customerAddress ?? "",
    input.customerEmail ?? "",
    input.customerPhone ?? "",
  ].filter((line) => line.trim().length > 0);

  const issuerLines = [
    template.companyName,
    [template.companyAddressLine1, template.companyAddressLine2]
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", "),
    template.companyEmail,
    template.companyPhone,
  ].filter((line) => line.trim().length > 0);

  customerLines.slice(0, 4).forEach((line, index) => {
    const size = index === 0 ? 11.2 : 9.4;
    const lineFont = index === 0 ? fontBold : font;
    page.drawText(truncateToWidth(line, lineFont, size, infoWidth - 24), {
      x: billCardX + 12,
      y: infoTopY - 35 - index * 14,
      size,
      font: lineFont,
      color: index === 0 ? ink : muted,
    });
  });

  issuerLines.slice(0, 4).forEach((line, index) => {
    const size = index === 0 ? 11.2 : 9.4;
    const lineFont = index === 0 ? fontBold : font;
    page.drawText(truncateToWidth(line, lineFont, size, infoWidth - 24), {
      x: issuerCardX + 12,
      y: infoTopY - 35 - index * 14,
      size,
      font: lineFont,
      color: index === 0 ? ink : muted,
    });
  });

  const tableTop = infoY - 18;
  const tableHeaderHeight = 24;
  const rowHeight = 22;
  const maxRows = 9;

  const colNo = 30;
  const colDesc = 250;
  const colQty = 48;
  const colUnit = 94;
  const colAmount = contentWidth - colNo - colDesc - colQty - colUnit;

  const xNo = margin;
  const xDesc = xNo + colNo;
  const xQty = xDesc + colDesc;
  const xUnit = xQty + colQty;
  const xAmount = xUnit + colUnit;

  page.drawRectangle({
    x: margin,
    y: tableTop - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: light,
    borderColor: rgb(0.84, 0.89, 0.95),
    borderWidth: 1,
  });

  page.drawText("#", {
    x: xNo + 10,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: brand,
  });
  page.drawText(template.tableDescriptionLabel, {
    x: xDesc + 6,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: brand,
  });
  page.drawText("Qty", {
    x: xQty + 8,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: brand,
  });
  page.drawText("Unit Price", {
    x: xUnit + 8,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: brand,
  });
  page.drawText(template.tableAmountLabel, {
    x: xAmount + 8,
    y: tableTop - 16,
    size: 9,
    font: fontBold,
    color: brand,
  });

  const rows = input.items.slice(0, maxRows);
  rows.forEach((item, index) => {
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const unitPrice =
      typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
        ? item.unitPrice
        : quantity > 0
          ? item.amount / quantity
          : item.amount;

    const rowTop = tableTop - tableHeaderHeight - index * rowHeight;
    const textY = rowTop - 15;

    page.drawLine({
      start: { x: margin, y: rowTop },
      end: { x: margin + contentWidth, y: rowTop },
      thickness: 0.8,
      color: rgb(0.9, 0.93, 0.97),
    });

    page.drawText(String(index + 1), {
      x: xNo + 10,
      y: textY,
      size: 9,
      font,
      color: ink,
    });

    page.drawText(truncateToWidth(item.label, font, 9.2, colDesc - 12), {
      x: xDesc + 6,
      y: textY,
      size: 9.2,
      font,
      color: ink,
    });

    page.drawText(String(quantity), {
      x: xQty + 8,
      y: textY,
      size: 9,
      font,
      color: ink,
    });

    drawRightText(page, money(unitPrice), xAmount - 8, textY, 9, font, ink);
    drawRightText(page, money(item.amount), width - margin - 8, textY, 9, fontBold, ink);
  });

  if (input.items.length > maxRows) {
    const noteY = tableTop - tableHeaderHeight - rows.length * rowHeight - 14;
    page.drawText("Additional line items not shown in this summary.", {
      x: margin + 6,
      y: noteY,
      size: 8.2,
      font,
      color: muted,
    });
  }

  const tableBottomY = tableTop - tableHeaderHeight - rows.length * rowHeight - 8;

  let totalsY = tableBottomY - 12;
  const totalsRightX = width - margin;
  const totalsLabelX = totalsRightX - 160;

  page.drawText(`${template.subtotalLabel}:`, {
    x: totalsLabelX,
    y: totalsY,
    size: 10,
    font,
    color: muted,
  });
  drawRightText(page, money(input.subtotal), totalsRightX, totalsY, 10, font, ink);

  totalsY -= 16;
  page.drawText(`${template.taxLabel} (7%):`, {
    x: totalsLabelX,
    y: totalsY,
    size: 10,
    font,
    color: muted,
  });
  drawRightText(page, money(input.tax), totalsRightX, totalsY, 10, font, ink);

  totalsY -= 22;
  page.drawText(`${template.totalLabel}:`, {
    x: totalsLabelX,
    y: totalsY,
    size: 13,
    font: fontBold,
    color: brand,
  });
  drawRightText(page, money(input.total), totalsRightX, totalsY, 13, fontBold, brand);

  let detailSectionY = totalsY - 32;
  if (detailSectionY < 170) {
    detailSectionY = 170;
  }

  const halfGap = 14;
  const panelWidth = (contentWidth - halfGap) / 2;

  page.drawRectangle({
    x: margin,
    y: detailSectionY - 64,
    width: panelWidth,
    height: 64,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.86, 0.9, 0.96),
    borderWidth: 1,
  });

  page.drawText("PAYMENT METHOD", {
    x: margin + 10,
    y: detailSectionY - 14,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Credit | Debit | ACH | Check", {
    x: margin + 10,
    y: detailSectionY - 30,
    size: 10,
    font,
    color: ink,
  });
  page.drawText("We accept: Visa, MasterCard, Zelle and Cash", {
    x: margin + 10,
    y: detailSectionY - 44,
    size: 8.7,
    font,
    color: muted,
  });

  page.drawRectangle({
    x: margin + panelWidth + halfGap,
    y: detailSectionY - 64,
    width: panelWidth,
    height: 64,
    color: rgb(0.98, 0.99, 1),
    borderColor: rgb(0.86, 0.9, 0.96),
    borderWidth: 1,
  });

  page.drawText(template.notesLabel.toUpperCase(), {
    x: margin + panelWidth + halfGap + 10,
    y: detailSectionY - 14,
    size: 9,
    font: fontBold,
    color: muted,
  });

  const notesText = (input.notes?.trim() || template.footerNote).replace(/\s+/g, " ");
  page.drawText(truncateToWidth(notesText, font, 9.4, panelWidth - 20), {
    x: margin + panelWidth + halfGap + 10,
    y: detailSectionY - 32,
    size: 9.4,
    font,
    color: ink,
  });

  const footerTop = 92;
  page.drawLine({
    start: { x: margin, y: footerTop + 28 },
    end: { x: width - margin, y: footerTop + 28 },
    thickness: 1,
    color: rgb(0.87, 0.91, 0.96),
  });

  page.drawText(template.clausesTitle.toUpperCase(), {
    x: margin,
    y: footerTop + 14,
    size: 8,
    font: fontBold,
    color: muted,
  });

  template.legalClauses.slice(0, 4).forEach((clause, index) => {
    page.drawText(truncateToWidth(clause, font, 7.8, contentWidth), {
      x: margin,
      y: footerTop + 2 - index * 10,
      size: 7.8,
      font,
      color: muted,
    });
  });

  const pdfBytes = await pdfDoc.save();
  return storePublicAsset({
    relativePath: buildInvoicePdfAssetPath(
      input.customerId,
      input.invoiceNumber,
      input.issueDate
    ),
    buffer: Buffer.from(pdfBytes),
    contentType: "application/pdf",
    cacheControl: "public, max-age=31536000, immutable",
  });
}
