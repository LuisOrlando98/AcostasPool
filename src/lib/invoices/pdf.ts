import { createRequire } from "node:module";
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

export async function generateInvoicePdf(input: InvoicePdfInput) {
  const chromium = loadChromium();
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
  } finally {
    await browser.close();
  }
}
