import { createRequire } from "node:module";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildInvoicePdfAssetPath } from "@/lib/storage/paths";
import {
  normalizeInvoiceTemplateConfig,
  renderInvoiceTemplateHtml,
  toPdfRgbTuple,
  type InvoiceTemplateConfig,
  type InvoiceTemplateTheme,
} from "@/lib/invoice-template";

const require = createRequire(import.meta.url);

type ChromiumLauncher = {
  launch: (options?: {
    headless?: boolean;
    args?: string[];
  }) => Promise<{
    newPage: (options?: {
      viewport?: { width: number; height: number };
    }) => Promise<{
      setContent: (
        html: string,
        options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit" }
      ) => Promise<void>;
      emulateMedia: (options: { media: "screen" | "print" | null }) => Promise<void>;
      pdf: (options: {
        format: "Letter";
        printBackground: boolean;
        preferCSSPageSize: boolean;
        margin: { top: string; right: string; bottom: string; left: string };
      }) => Promise<Uint8Array>;
    }>;
    close: () => Promise<void>;
  }>;
};

function loadChromium(): ChromiumLauncher {
  try {
    const moduleName = `play${"wright"}`;
    const mod = require(moduleName) as { chromium?: ChromiumLauncher };
    if (!mod?.chromium) {
      throw new Error("Chromium launcher not available.");
    }
    return mod.chromium;
  } catch (error) {
    throw new Error(
      `Playwright is not available. Install it with "npm install playwright" and run "npx playwright install chromium". ${String(
        error
      )}`
    );
  }
}

async function storeInvoicePdfBuffer(input: InvoicePdfInput, bytes: Uint8Array | Buffer) {
  return storePublicAsset({
    relativePath: buildInvoicePdfAssetPath(
      input.customerId,
      input.invoiceNumber,
      input.issueDate
    ),
    buffer: Buffer.from(bytes),
    contentType: "application/pdf",
    cacheControl: "public, max-age=31536000, immutable",
  });
}

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
  theme?: InvoiceTemplateTheme;
  template?: InvoiceTemplateConfig;
};

function normalizeItems(items: InvoiceLineItem[]) {
  return items
    .map((item) => {
      const label = item.label?.trim() || "Service";
      const quantity =
        typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
          ? item.quantity
          : 1;
      const unitPrice =
        typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : item.amount / quantity;

      return {
        label,
        quantity,
        unitPrice,
        amount: item.amount,
      };
    })
    .filter((item) => item.label.length > 0);
}

async function generateInvoicePdfWithPdfLib(
  input: InvoicePdfInput,
  items: ReturnType<typeof normalizeItems>,
  template: InvoiceTemplateConfig,
  theme: InvoiceTemplateTheme
) {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const resolvedTheme = template.themes[theme];
  const [brandR, brandG, brandB] = toPdfRgbTuple(resolvedTheme.brandHex);
  const [lightR, lightG, lightB] = toPdfRgbTuple(resolvedTheme.lightHex);
  const brandColor = rgb(brandR, brandG, brandB);
  const lightColor = rgb(lightR, lightG, lightB);
  const whiteColor = rgb(1, 1, 1);

  let page = pdfDoc.addPage([612, 792]);
  const drawHeader = () => {
    const { width, height } = page.getSize();
    const headerHeight = 164;
    const headerBottom = height - headerHeight;

    page.drawRectangle({
      x: 0,
      y: headerBottom,
      width,
      height: headerHeight,
      color: brandColor,
    });

    page.drawText("ACOSTA'S", {
      x: 42,
      y: height - 76,
      size: 50,
      font: boldFont,
      color: whiteColor,
    });
    page.drawText("POOL", {
      x: 164,
      y: height - 128,
      size: 50,
      font: boldFont,
      color: whiteColor,
    });
    page.drawLine({
      start: { x: 42, y: height - 138 },
      end: { x: 340, y: height - 138 },
      thickness: 2.2,
      color: whiteColor,
    });
    page.drawText("REPAIR AND MAINTENANCE", {
      x: 42,
      y: height - 160,
      size: 15,
      font: regularFont,
      color: whiteColor,
    });

    page.drawText(resolvedTheme.label, {
      x: 390,
      y: height - 72,
      size: 29,
      font: boldFont,
      color: whiteColor,
    });
    page.drawText(`Invoice #: ${input.invoiceNumber}`, {
      x: 390,
      y: height - 96,
      size: 11,
      font: boldFont,
      color: whiteColor,
    });
    page.drawText(`Issue date: ${input.issueDate.toLocaleDateString("en-US")}`, {
      x: 390,
      y: height - 114,
      size: 11,
      font: boldFont,
      color: whiteColor,
    });

    page.drawRectangle({
      x: 0,
      y: headerBottom - 5,
      width,
      height: 5,
      color: whiteColor,
    });
  };

  drawHeader();
  let cursorY = 598;

  const wrapText = (value: string, maxChars: number) => {
    const clean = value.trim();
    if (!clean) return [];
    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) {
      lines.push(current);
    }
    return lines;
  };

  const drawText = (
    value: string,
    opts?: {
      x?: number;
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      lineGap?: number;
    }
  ) => {
    const text = value.trim();
    if (!text) return;
    const x = opts?.x ?? 48;
    const size = opts?.size ?? 11;
    const font = opts?.bold ? boldFont : regularFont;
    const [r, g, b] = opts?.color ?? [0.06, 0.09, 0.16];
    const needed = (opts?.lineGap ?? 6) + size;

    if (cursorY < 60) {
      page = pdfDoc.addPage([612, 792]);
      drawHeader();
      cursorY = 598;
    }

    page.drawText(text, {
      x,
      y: cursorY,
      size,
      font,
      color: rgb(r, g, b),
    });
    cursorY -= needed;
  };

  const drawInfoCard = (x: number, title: string, primary: string, secondary: string[]) => {
    const cardTop = cursorY;
    const cardHeight = 92;
    const cardBottom = cardTop - cardHeight;
    const cardWidth = 248;

    page.drawRectangle({
      x,
      y: cardBottom,
      width: cardWidth,
      height: cardHeight,
      color: rgb(0.98, 0.99, 1),
      borderColor: rgb(0.79, 0.85, 0.92),
      borderWidth: 1,
    });

    page.drawText(title, {
      x: x + 10,
      y: cardTop - 14,
      size: 9,
      font: boldFont,
      color: rgb(brandR, brandG, brandB),
    });

    page.drawText(primary, {
      x: x + 10,
      y: cardTop - 32,
      size: 11,
      font: boldFont,
      color: rgb(0.07, 0.13, 0.22),
    });

    let lineY = cardTop - 46;
    for (const line of secondary) {
      if (lineY < cardBottom + 8) {
        break;
      }
      for (const wrapped of wrapText(line, 38)) {
        if (lineY < cardBottom + 8) {
          break;
        }
        page.drawText(wrapped, {
          x: x + 10,
          y: lineY,
          size: 9,
          font: regularFont,
          color: rgb(0.3, 0.4, 0.52),
        });
        lineY -= 11;
      }
    }
  };

  const billPrimary = input.customerName.trim() || "Customer";
  const billSecondary = [
    input.customerAddress ?? "",
    input.customerEmail ?? "",
    input.customerPhone ?? "",
  ].filter(Boolean);

  const issuerAddress = [template.companyAddressLine1, template.companyAddressLine2]
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");
  const issuerPrimary = template.companyName.trim() || "Issuer";
  const issuerSecondary = [
    issuerAddress,
    template.companyEmail,
    template.companyPhone,
    template.companyWebsite,
    template.companyTaxId,
  ]
    .map((line) => line.trim())
    .filter(Boolean);

  drawInfoCard(48, "Bill To", billPrimary, billSecondary);
  drawInfoCard(316, "Issued By", issuerPrimary, issuerSecondary);
  cursorY -= 114;

  page.drawRectangle({
    x: 48,
    y: cursorY - 2,
    width: 516,
    height: 20,
    color: lightColor,
  });
  drawText("Description", { x: 56, bold: true, size: 11, color: [brandR, brandG, brandB] });
  drawText("Qty", { x: 350, bold: true, size: 11, color: [brandR, brandG, brandB] });
  drawText("Price", { x: 410, bold: true, size: 11, color: [brandR, brandG, brandB] });
  drawText("Amount", { x: 500, bold: true, size: 11, color: [brandR, brandG, brandB] });
  cursorY -= 2;

  for (const item of items) {
    drawText(item.label, { x: 48, size: 10 });
    drawText(String(item.quantity), { x: 340, size: 10 });
    drawText(`$${item.unitPrice.toFixed(2)}`, { x: 400, size: 10 });
    drawText(`$${item.amount.toFixed(2)}`, { x: 490, size: 10 });
  }

  cursorY -= 6;
  drawText(`Subtotal: $${input.subtotal.toFixed(2)}`, {
    x: 400,
    bold: true,
    color: [brandR, brandG, brandB],
  });
  drawText(`Tax: $${input.tax.toFixed(2)}`, {
    x: 400,
    bold: true,
    color: [brandR, brandG, brandB],
  });
  drawText(`Total: $${input.total.toFixed(2)}`, {
    x: 400,
    bold: true,
    size: 13,
    color: [brandR, brandG, brandB],
  });

  const detailTop = cursorY - 8;
  const detailHeight = 58;
  const drawDetailCard = (x: number, title: string, main: string, sub?: string) => {
    const width = 248;
    const bottom = detailTop - detailHeight;
    page.drawRectangle({
      x,
      y: bottom,
      width,
      height: detailHeight,
      color: rgb(0.98, 0.99, 1),
      borderColor: rgb(0.79, 0.85, 0.92),
      borderWidth: 1,
    });
    page.drawText(title, {
      x: x + 10,
      y: detailTop - 13,
      size: 9,
      font: boldFont,
      color: rgb(brandR, brandG, brandB),
    });
    const mainLines = wrapText(main, 44).slice(0, 2);
    let mainY = detailTop - 27;
    for (const line of mainLines) {
      page.drawText(line, {
        x: x + 10,
        y: mainY,
        size: 9,
        font: regularFont,
        color: rgb(0.11, 0.19, 0.31),
      });
      mainY -= 11;
    }
    if (sub) {
      page.drawText(sub, {
        x: x + 10,
        y: detailTop - 49,
        size: 8,
        font: regularFont,
        color: rgb(0.38, 0.47, 0.58),
      });
    }
  };

  drawDetailCard(
    48,
    "Payment Method",
    "Credit | Debit | ACH | Check",
    "We accept: Visa, MasterCard, Zelle and Cash"
  );
  drawDetailCard(
    316,
    "Notes",
    (input.notes ?? template.footerNote).trim() || "Thank you for trusting AcostasPool.",
    ""
  );
  cursorY = detailTop - detailHeight - 12;

  drawText(template.clausesTitle, {
    bold: true,
    size: 10,
    color: [brandR, brandG, brandB],
  });
  for (const clause of template.legalClauses.slice(0, 4)) {
    for (const line of wrapText(clause, 100)) {
      drawText(`- ${line}`, {
        size: 8,
        color: [0.37, 0.45, 0.56],
        lineGap: 3,
      });
    }
  }

  const bytes = await pdfDoc.save();
  return storeInvoicePdfBuffer(input, bytes);
}

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const template = normalizeInvoiceTemplateConfig(input.template);
  const theme = input.theme ?? "STANDARD";
  const items = normalizeItems(input.items);

  const html = renderInvoiceTemplateHtml({
    template,
    theme,
    invoiceNumber: input.invoiceNumber,
    issueDateLabel: input.issueDate.toLocaleDateString("en-US"),
    customerName: input.customerName,
    customerAddress: input.customerAddress,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    notes: input.notes,
  });

  try {
    const chromium = loadChromium();
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 816, height: 1056 },
      });

      await page.setContent(html, { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "screen" });

      const pdfBytes = await page.pdf({
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: "0in",
          right: "0in",
          bottom: "0in",
          left: "0in",
        },
      });

      return storeInvoicePdfBuffer(input, pdfBytes);
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error(
      `[invoices] Playwright PDF generation failed, using pdf-lib fallback for ${input.invoiceNumber}.`,
      error
    );
    return generateInvoicePdfWithPdfLib(input, items, template, theme);
  }
}
