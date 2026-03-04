import { createRequire } from "node:module";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { storePublicAsset } from "@/lib/storage/object-store";
import { buildInvoicePdfAssetPath } from "@/lib/storage/paths";
import {
  normalizeInvoiceTemplateConfig,
  renderInvoiceTemplateHtml,
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
  items: ReturnType<typeof normalizeItems>
) {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([612, 792]);
  let cursorY = 752;

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
      cursorY = 752;
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

  drawText("INVOICE", { size: 24, bold: true });
  drawText(`Invoice #: ${input.invoiceNumber}`, { bold: true });
  drawText(`Issue date: ${input.issueDate.toLocaleDateString("en-US")}`);
  cursorY -= 4;

  drawText("Bill To", { bold: true, size: 13 });
  drawText(input.customerName, { bold: true });
  if (input.customerAddress) drawText(input.customerAddress);
  if (input.customerEmail) drawText(input.customerEmail);
  if (input.customerPhone) drawText(input.customerPhone);
  cursorY -= 6;

  drawText("Description", { x: 48, bold: true, size: 12 });
  drawText("Qty", { x: 340, bold: true, size: 12 });
  drawText("Price", { x: 400, bold: true, size: 12 });
  drawText("Amount", { x: 490, bold: true, size: 12 });
  cursorY -= 2;

  for (const item of items) {
    drawText(item.label, { x: 48, size: 10 });
    drawText(String(item.quantity), { x: 340, size: 10 });
    drawText(`$${item.unitPrice.toFixed(2)}`, { x: 400, size: 10 });
    drawText(`$${item.amount.toFixed(2)}`, { x: 490, size: 10 });
  }

  cursorY -= 6;
  drawText(`Subtotal: $${input.subtotal.toFixed(2)}`, { x: 400, bold: true });
  drawText(`Tax: $${input.tax.toFixed(2)}`, { x: 400, bold: true });
  drawText(`Total: $${input.total.toFixed(2)}`, {
    x: 400,
    bold: true,
    size: 13,
  });

  if (input.notes) {
    cursorY -= 10;
    drawText("Notes", { bold: true, size: 12 });
    drawText(input.notes, { size: 10, color: [0.2, 0.25, 0.3] });
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
    return generateInvoicePdfWithPdfLib(input, items);
  }
}
