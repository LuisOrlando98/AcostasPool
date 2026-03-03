import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
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

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadHorizontalLogo(pdfDoc);

  const { width, height } = page.getSize();
  const theme = input.theme ?? "STANDARD";
  const template = normalizeInvoiceTemplateConfig(input.template);
  const themeConfig = template.themes[theme];
  const label = themeConfig.label;
  const [brandR, brandG, brandB] = toPdfRgbTuple(themeConfig.brandHex);
  const [accentR, accentG, accentB] = toPdfRgbTuple(themeConfig.accentHex);
  const [lightR, lightG, lightB] = toPdfRgbTuple(themeConfig.lightHex);
  const brand = rgb(brandR, brandG, brandB);
  const accent = rgb(accentR, accentG, accentB);
  const light = rgb(lightR, lightG, lightB);
  const ink = rgb(0.1, 0.15, 0.21);
  const muted = rgb(0.45, 0.5, 0.56);
  const bottomBaseY = 30;

  page.drawRectangle({
    x: 0,
    y: height - 154,
    width,
    height: 154,
    color: brand,
  });
  page.drawRectangle({
    x: 0,
    y: height - 154,
    width: 8,
    height: 154,
    color: accent,
  });

  if (logo) {
    const logoScale = 0.32;
    const logoWidth = logo.width * logoScale;
    const logoHeight = logo.height * logoScale;
    page.drawImage(logo, {
      x: 44,
      y: height - 60 - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
  } else {
    page.drawText(template.companyName, {
      x: 46,
      y: height - 64,
      size: 18,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  }

  page.drawText(template.headerSubtitle, {
    x: 46,
    y: height - 98,
    size: 10,
    font,
    color: rgb(0.84, 0.89, 0.94),
  });
  page.drawText(`${template.companyPhone} | ${template.companyEmail}`, {
    x: 46,
    y: height - 114,
    size: 8.7,
    font,
    color: rgb(0.84, 0.89, 0.94),
  });

  page.drawText(label, {
    x: 404,
    y: height - 62,
    size: theme === "SPECIAL" ? 11.5 : 13.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`${template.invoiceNumberLabel}: ${input.invoiceNumber}`, {
    x: 356,
    y: height - 82,
    size: 9.5,
    font,
    color: rgb(0.84, 0.89, 0.94),
  });
  page.drawText(`${template.issueDateLabel}: ${input.issueDate.toLocaleDateString()}`, {
    x: 356,
    y: height - 96,
    size: 9.5,
    font,
    color: rgb(0.84, 0.89, 0.94),
  });
  if (template.companyTaxId) {
    page.drawText(template.companyTaxId, {
      x: 356,
      y: height - 110,
      size: 8.2,
      font,
      color: rgb(0.84, 0.89, 0.94),
    });
  }

  if (theme === "ESTIMATE" && template.showEstimateWatermark) {
    const watermark = themeConfig.watermarkText?.trim() || "ESTIMATE";
    page.drawText(watermark, {
      x: 138,
      y: height / 2 + 40,
      size: 64,
      font: fontBold,
      color: rgb(0.9, 0.9, 0.9),
      rotate: degrees(-12),
    });
  }

  let cursorY = height - 186;

  page.drawText(template.billToLabel, {
    x: 50,
    y: cursorY,
    size: 10.5,
    font: fontBold,
    color: muted,
  });
  page.drawText(input.customerName, {
    x: 50,
    y: cursorY - 18,
    size: 11.2,
    font,
    color: ink,
  });
  if (input.customerEmail) {
    page.drawText(input.customerEmail, {
      x: 50,
      y: cursorY - 34,
      size: 9.2,
      font,
      color: muted,
    });
  }

  cursorY -= 62;

  const headerY = cursorY;
  page.drawRectangle({
    x: 50,
    y: headerY,
    width: 512,
    height: 24,
    color: light,
  });

  const descriptionX = 60;
  const qtyX = 386;
  const priceX = 438;
  const amountX = 500;

  page.drawText(template.tableDescriptionLabel, {
    x: descriptionX,
    y: headerY + 7,
    size: 9.6,
    font: fontBold,
    color: brand,
  });
  page.drawText("Qty", {
    x: qtyX,
    y: headerY + 7,
    size: 9.2,
    font: fontBold,
    color: brand,
  });
  page.drawText("Price", {
    x: priceX,
    y: headerY + 7,
    size: 9.2,
    font: fontBold,
    color: brand,
  });
  page.drawText(template.tableAmountLabel, {
    x: amountX,
    y: headerY + 7,
    size: 9.2,
    font: fontBold,
    color: brand,
  });

  cursorY -= 12;

  input.items.forEach((item) => {
    if (cursorY < 170) {
      return;
    }
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const unitPrice =
      typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
        ? item.unitPrice
        : quantity > 0
          ? item.amount / quantity
          : item.amount;
    const amount = item.amount;

    page.drawText(item.label, {
      x: descriptionX,
      y: cursorY,
      size: 10,
      font,
      color: ink,
      maxWidth: 310,
    });
    page.drawText(String(quantity), {
      x: qtyX + 4,
      y: cursorY,
      size: 9.5,
      font,
      color: ink,
    });
    page.drawText(`$${unitPrice.toFixed(2)}`, {
      x: priceX,
      y: cursorY,
      size: 9.5,
      font,
      color: ink,
    });
    page.drawText(`$${amount.toFixed(2)}`, {
      x: amountX,
      y: cursorY,
      size: 9.5,
      font,
      color: ink,
    });

    cursorY -= 18;
  });

  cursorY -= 10;

  page.drawText(`${template.subtotalLabel}: $${input.subtotal.toFixed(2)}`, {
    x: 398,
    y: cursorY,
    size: 10,
    font,
    color: ink,
  });
  cursorY -= 16;
  page.drawText(`${template.taxLabel}: $${input.tax.toFixed(2)}`, {
    x: 398,
    y: cursorY,
    size: 10,
    font,
    color: ink,
  });
  cursorY -= 20;
  page.drawText(`${template.totalLabel}: $${input.total.toFixed(2)}`, {
    x: 398,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: brand,
  });

  if (input.notes) {
    cursorY -= 40;
    page.drawRectangle({
      x: 50,
      y: cursorY - 44,
      width: 512,
      height: 56,
      color: rgb(0.97, 0.98, 0.99),
    });
    page.drawText(`${template.notesLabel}:`, {
      x: 60,
      y: cursorY - 10,
      size: 9.5,
      font: fontBold,
      color: ink,
    });
    page.drawText(input.notes, {
      x: 60,
      y: cursorY - 24,
      size: 9,
      font,
      color: muted,
      maxWidth: 494,
      lineHeight: 11,
    });
  }

  page.drawText(template.footerNote, {
    x: 50,
    y: bottomBaseY + 22,
    size: 8.5,
    font,
    color: muted,
    maxWidth: 500,
    lineHeight: 11,
  });

  page.drawText(template.clausesTitle, {
    x: 50,
    y: bottomBaseY + 12,
    size: 7.5,
    font: fontBold,
    color: rgb(0.5, 0.56, 0.63),
  });

  template.legalClauses.slice(0, 4).forEach((clause, index) => {
    page.drawText(clause, {
      x: 50,
      y: bottomBaseY + 3 - index * 8,
      size: 6.4,
      font,
      color: rgb(0.56, 0.62, 0.69),
      maxWidth: 520,
      lineHeight: 7,
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
