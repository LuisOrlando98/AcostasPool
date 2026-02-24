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

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
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
  const bottomBaseY = 30;

  page.drawRectangle({
    x: 0,
    y: height - 140,
    width: 612,
    height: 140,
    color: light,
  });
  page.drawRectangle({
    x: 0,
    y: height - 140,
    width: 8,
    height: 140,
    color: accent,
  });

  page.drawText(template.companyName, {
    x: 50,
    y: height - 60,
    size: 18,
    font: fontBold,
    color: brand,
  });

  page.drawText(template.headerSubtitle, {
    x: 50,
    y: height - 78,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  page.drawText(`${template.companyPhone}  |  ${template.companyEmail}`, {
    x: 50,
    y: height - 95,
    size: 9,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  page.drawText(
    `${template.companyAddressLine1}${
      template.companyAddressLine2 ? ` | ${template.companyAddressLine2}` : ""
    }`,
    {
      x: 50,
      y: height - 108,
      size: 8.5,
      font,
      color: rgb(0.45, 0.5, 0.56),
    }
  );
  if (template.companyWebsite) {
    page.drawText(template.companyWebsite, {
      x: 50,
      y: height - 121,
      size: 8.5,
      font,
      color: rgb(0.45, 0.5, 0.56),
    });
  }

  page.drawText(label, {
    x: 420,
    y: height - 55,
    size: theme === "SPECIAL" ? 12 : 14,
    font: fontBold,
    color: brand,
  });

  page.drawText(`${template.invoiceNumberLabel}: ${input.invoiceNumber}`, {
    x: 360,
    y: height - 74,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });
  page.drawText(
    `${template.issueDateLabel}: ${input.issueDate.toLocaleDateString()}`,
    {
      x: 360,
      y: height - 89,
      size: 10,
      font,
      color: rgb(0.4, 0.45, 0.5),
    }
  );
  if (template.companyTaxId) {
    page.drawText(template.companyTaxId, {
      x: 360,
      y: height - 104,
      size: 8.5,
      font,
      color: rgb(0.45, 0.5, 0.56),
    });
  }

  if (theme === "ESTIMATE" && template.showEstimateWatermark) {
    const watermark = themeConfig.watermarkText?.trim() || "ESTIMATE";
    page.drawText(watermark, {
      x: 140,
      y: height / 2,
      size: 64,
      font: fontBold,
      color: rgb(0.9, 0.9, 0.9),
      rotate: degrees(-12),
    });
  }

  let cursorY = height - 170;

  page.drawText(template.billToLabel, {
    x: 50,
    y: cursorY,
    size: 11,
    font: fontBold,
  });

  page.drawText(input.customerName, {
    x: 50,
    y: cursorY - 18,
    size: 11,
    font,
  });

  if (input.customerEmail) {
    page.drawText(input.customerEmail, {
      x: 50,
      y: cursorY - 34,
      size: 10,
      font,
      color: rgb(0.4, 0.45, 0.5),
    });
  }

  cursorY -= 60;

  page.drawRectangle({
    x: 50,
    y: cursorY,
    width: 512,
    height: 24,
    color: light,
  });

  page.drawText(template.tableDescriptionLabel, {
    x: 60,
    y: cursorY + 7,
    size: 10,
    font: fontBold,
    color: brand,
  });
  page.drawText(template.tableAmountLabel, {
    x: 470,
    y: cursorY + 7,
    size: 10,
    font: fontBold,
    color: brand,
  });

  cursorY -= 10;

  input.items.forEach((item) => {
    page.drawText(item.label, {
      x: 60,
      y: cursorY,
      size: 10,
      font,
    });
    page.drawText(`$${item.amount.toFixed(2)}`, {
      x: 470,
      y: cursorY,
      size: 10,
      font,
    });
    cursorY -= 18;
  });

  cursorY -= 10;

  page.drawText(`${template.subtotalLabel}: $${input.subtotal.toFixed(2)}`, {
    x: 400,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 16;
  page.drawText(`${template.taxLabel}: $${input.tax.toFixed(2)}`, {
    x: 400,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 20;
  page.drawText(`${template.totalLabel}: $${input.total.toFixed(2)}`, {
    x: 400,
    y: cursorY,
    size: 12,
    font: fontBold,
  });

  if (input.notes) {
    cursorY -= 40;
    page.drawText(`${template.notesLabel}:`, {
      x: 50,
      y: cursorY,
      size: 10,
      font: fontBold,
    });
    page.drawText(input.notes, {
      x: 50,
      y: cursorY - 16,
      size: 10,
      font,
      color: rgb(0.4, 0.45, 0.5),
      maxWidth: 500,
      lineHeight: 12,
    });
  }

  page.drawText(template.footerNote, {
    x: 50,
    y: bottomBaseY + 22,
    size: 8.5,
    font,
    color: rgb(0.45, 0.5, 0.56),
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
