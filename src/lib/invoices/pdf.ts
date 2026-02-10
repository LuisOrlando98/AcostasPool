import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type InvoiceLineItem = {
  label: string;
  amount: number;
};

type InvoicePdfInput = {
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
};

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  const theme = input.theme ?? "STANDARD";
  const themeStyles = {
    STANDARD: {
      brand: rgb(0.05, 0.2, 0.3),
      accent: rgb(0.05, 0.48, 0.65),
      light: rgb(0.95, 0.97, 0.99),
      label: "INVOICE",
    },
    SPECIAL: {
      brand: rgb(0.16, 0.12, 0.08),
      accent: rgb(0.86, 0.7, 0.2),
      light: rgb(0.98, 0.96, 0.92),
      label: "SPECIAL INVOICE",
    },
    ESTIMATE: {
      brand: rgb(0.3, 0.35, 0.4),
      accent: rgb(0.45, 0.52, 0.6),
      light: rgb(0.96, 0.97, 0.98),
      label: "ESTIMATE",
    },
  } as const;
  const { brand, accent, light, label } = themeStyles[theme];

  page.drawRectangle({
    x: 0,
    y: height - 120,
    width: 612,
    height: 120,
    color: light,
  });
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width: 8,
    height: 120,
    color: accent,
  });

  page.drawText("ACOSTASPOOL", {
    x: 50,
    y: height - 60,
    size: 18,
    font: fontBold,
    color: brand,
  });

  page.drawText("Service Administration System", {
    x: 50,
    y: height - 78,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText(label, {
    x: 420,
    y: height - 55,
    size: theme === "SPECIAL" ? 12 : 14,
    font: fontBold,
    color: brand,
  });

  page.drawText(input.invoiceNumber, {
    x: 420,
    y: height - 72,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawText(`Date: ${input.issueDate.toLocaleDateString()}`, {
    x: 420,
    y: height - 88,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  if (theme === "ESTIMATE") {
    page.drawText("ESTIMATE", {
      x: 140,
      y: height / 2,
      size: 64,
      font: fontBold,
      color: rgb(0.9, 0.9, 0.9),
      rotate: degrees(-12),
    });
  }

  let cursorY = height - 150;

  page.drawText("Bill To", {
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

  page.drawText("Description", {
    x: 60,
    y: cursorY + 7,
    size: 10,
    font: fontBold,
    color: brand,
  });
  page.drawText("Amount", {
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

  page.drawText(`Subtotal: $${input.subtotal.toFixed(2)}`, {
    x: 400,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 16;
  page.drawText(`Tax: $${input.tax.toFixed(2)}`, {
    x: 400,
    y: cursorY,
    size: 10,
    font,
  });
  cursorY -= 20;
  page.drawText(`Total: $${input.total.toFixed(2)}`, {
    x: 400,
    y: cursorY,
    size: 12,
    font: fontBold,
  });

  if (input.notes) {
    cursorY -= 40;
    page.drawText("Notes:", {
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

  const pdfBytes = await pdfDoc.save();
  const fileName = `${input.invoiceNumber}.pdf`.replace(/[^a-zA-Z0-9-_\.]/g, "");
  const invoicesDir = path.join(process.cwd(), "public", "invoices");
  await mkdir(invoicesDir, { recursive: true });
  const outputPath = path.join(invoicesDir, fileName);
  await writeFile(outputPath, pdfBytes);

  return `/invoices/${fileName}`;
}
