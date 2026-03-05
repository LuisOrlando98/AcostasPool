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
  const lineColor = rgb(0.84, 0.89, 0.94);
  const lineStrongColor = rgb(0.71, 0.78, 0.86);
  const textColor = rgb(0.09, 0.14, 0.22);
  const textSoftColor = rgb(0.18, 0.28, 0.4);
  const mutedColor = rgb(0.37, 0.45, 0.56);
  const backgroundColor = rgb(0.95, 0.97, 1);
  const whiteColor = rgb(1, 1, 1);
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 46;
  const contentWidth = pageWidth - marginX * 2;
  const tableColumns = {
    index: marginX + 6,
    description: marginX + 36,
    qty: marginX + 304,
    unitPrice: marginX + 370,
    amount: marginX + 456,
    right: marginX + contentWidth,
  };
  const notesBody = (input.notes ?? "").trim();
  const thankYouNote = template.footerNote.trim() || "Thank you for trusting AcostasPool.";
  const notesDisplay = notesBody || "No additional notes.";
  const paymentTerms = template.legalClauses[0]
    ? `Payment terms: ${template.legalClauses[0]}`
    : "Payment terms: Due upon receipt.";
  const logoLineOne = "ACOSTA'S";
  const logoLineTwo = "POOL";

  const wrapText = (
    value: string,
    maxWidth: number,
    size: number,
    font: typeof regularFont | typeof boldFont = regularFont
  ) => {
    const clean = value.trim();
    if (!clean) return [];

    const words = clean.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
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

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = 0;

  const drawRightText = (
    text: string,
    xRight: number,
    y: number,
    size: number,
    font: typeof regularFont | typeof boldFont,
    color = textColor
  ) => {
    page.drawText(text, {
      x: xRight - font.widthOfTextAtSize(text, size),
      y,
      size,
      font,
      color,
    });
  };

  const drawDivider = (y: number, thickness = 1, color = lineColor) => {
    page.drawLine({
      start: { x: marginX, y },
      end: { x: marginX + contentWidth, y },
      thickness,
      color,
    });
  };

  const drawHeader = () => {
    const headerHeight = 158;
    const headerBottom = pageHeight - headerHeight;
    const logoAreaX = marginX;
    const logoAreaW = 300;
    const logoSize = 36;

    page.drawRectangle({
      x: 0,
      y: headerBottom,
      width: pageWidth,
      height: headerHeight,
      color: brandColor,
    });

    const logoLineOneX = logoAreaX + 8;
    const logoLineTwoX = logoAreaX + 52;
    page.drawText(logoLineOne, {
      x: logoLineOneX,
      y: pageHeight - 74,
      size: logoSize,
      font: boldFont,
      color: whiteColor,
    });
    page.drawText(logoLineTwo, {
      x: logoLineTwoX,
      y: pageHeight - 109,
      size: logoSize,
      font: boldFont,
      color: whiteColor,
    });

    const subtitle = template.headerSubtitle.trim() || "REPAIR AND MAINTENANCE";
    page.drawLine({
      start: { x: logoAreaX + 4, y: pageHeight - 140 },
      end: { x: logoAreaX + logoAreaW - 4, y: pageHeight - 140 },
      thickness: 2,
      color: whiteColor,
    });
    const subtitleText = subtitle.toUpperCase();
    const subtitleSize = 9.5;
    const subtitleX = logoAreaX + 6;
    page.drawText(subtitleText, {
      x: subtitleX,
      y: pageHeight - 154,
      size: subtitleSize,
      font: regularFont,
      color: whiteColor,
    });

    const labelSize = resolvedTheme.label.length > 12 ? 20 : 28;
    drawRightText(
      resolvedTheme.label,
      marginX + contentWidth,
      pageHeight - 70,
      labelSize,
      boldFont,
      whiteColor
    );
    drawRightText(
      `${template.invoiceNumberLabel}: ${input.invoiceNumber}`,
      marginX + contentWidth,
      pageHeight - 97,
      11,
      boldFont,
      whiteColor
    );
    drawRightText(
      `${template.issueDateLabel}: ${input.issueDate.toLocaleDateString("en-US")}`,
      marginX + contentWidth,
      pageHeight - 114,
      11,
      boldFont,
      whiteColor
    );

    page.drawLine({
      start: { x: marginX, y: headerBottom },
      end: { x: marginX + contentWidth, y: headerBottom },
      thickness: 2,
      color: whiteColor,
    });

    cursorY = headerBottom - 34;
  };

  const startNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    drawHeader();
  };

  const ensureSpace = (required: number) => {
    if (cursorY - required < 54) {
      startNewPage();
    }
  };

  const drawTableHeader = () => {
    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: marginX + contentWidth, y: cursorY },
      thickness: 1.8,
      color: brandColor,
    });
    cursorY -= 6;
    page.drawRectangle({
      x: marginX,
      y: cursorY - 16,
      width: contentWidth,
      height: 18,
      color: lightColor,
    });
    page.drawText("#", {
      x: tableColumns.index,
      y: cursorY - 11,
      size: 10,
      font: boldFont,
      color: brandColor,
    });
    page.drawText(template.tableDescriptionLabel, {
      x: tableColumns.description,
      y: cursorY - 11,
      size: 10,
      font: boldFont,
      color: brandColor,
    });
    page.drawText("Qty", {
      x: tableColumns.qty,
      y: cursorY - 11,
      size: 10,
      font: boldFont,
      color: brandColor,
    });
    page.drawText("Unit Price", {
      x: tableColumns.unitPrice,
      y: cursorY - 11,
      size: 10,
      font: boldFont,
      color: brandColor,
    });
    drawRightText(template.tableAmountLabel, tableColumns.right - 8, cursorY - 11, 10, boldFont, brandColor);
    cursorY -= 20;
  };

  drawHeader();

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

  const drawInfoBlock = (x: number, title: string, primary: string, secondary: string[]) => {
    const startY = cursorY;
    const blockWidth = 248;
    page.drawLine({
      start: { x, y: startY + 2 },
      end: { x, y: startY - 62 },
      thickness: 2,
      color: brandColor,
    });
    page.drawText(title.toUpperCase(), {
      x: x + 10,
      y: startY,
      size: 9,
      font: boldFont,
      color: mutedColor,
    });
    page.drawText(primary, {
      x: x + 10,
      y: startY - 19,
      size: 15,
      font: boldFont,
      color: textColor,
    });
    let lineY = startY - 33;
    for (const entry of secondary) {
      const wrapped = wrapText(entry, blockWidth - 16, 9.5);
      for (const line of wrapped) {
        if (lineY < startY - 66) {
          break;
        }
        page.drawText(line, {
          x: x + 10,
          y: lineY,
          size: 9.5,
          font: regularFont,
          color: textSoftColor,
        });
        lineY -= 11;
      }
    }
  };

  drawInfoBlock(marginX, template.billToLabel, billPrimary, billSecondary);
  drawInfoBlock(marginX + 272, "Issued By", issuerPrimary, issuerSecondary);
  cursorY -= 78;
  drawDivider(cursorY, 1, lineColor);
  cursorY -= 14;

  drawTableHeader();

  if (items.length === 0) {
    page.drawText("No line items", {
      x: tableColumns.description,
      y: cursorY - 10,
      size: 10,
      font: regularFont,
      color: mutedColor,
    });
    cursorY -= 20;
    drawDivider(cursorY, 1, lineColor);
  } else {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const labelLines = wrapText(
        item.label,
        tableColumns.qty - tableColumns.description - 8,
        10
      ).slice(0, 3);
      const rowHeight = Math.max(22, labelLines.length * 12 + 10);

      if (cursorY - rowHeight < 220) {
        startNewPage();
        drawTableHeader();
      }

      const rowTop = cursorY - 2;
      page.drawText(String(index + 1), {
        x: tableColumns.index,
        y: rowTop - 10,
        size: 10,
        font: regularFont,
        color: mutedColor,
      });
      let lineY = rowTop - 10;
      for (const line of labelLines) {
        page.drawText(line, {
          x: tableColumns.description,
          y: lineY,
          size: 10,
          font: regularFont,
          color: textColor,
        });
        lineY -= 12;
      }
      page.drawText(String(item.quantity), {
        x: tableColumns.qty,
        y: rowTop - 10,
        size: 10,
        font: regularFont,
        color: textSoftColor,
      });
      drawRightText(`$${item.unitPrice.toFixed(2)}`, tableColumns.amount - 8, rowTop - 10, 10, regularFont, textSoftColor);
      drawRightText(`$${item.amount.toFixed(2)}`, tableColumns.right - 8, rowTop - 10, 10, boldFont, textColor);

      cursorY -= rowHeight;
      drawDivider(cursorY, 1, lineColor);
      cursorY -= 2;
    }
  }

  cursorY -= 12;
  ensureSpace(100);
  const summaryTop = cursorY;
  const totalsX = marginX + 340;
  page.drawLine({
    start: { x: totalsX - 16, y: summaryTop + 4 },
    end: { x: totalsX - 16, y: summaryTop - 74 },
    thickness: 2,
    color: lineStrongColor,
  });
  page.drawText("INVOICE SUMMARY", {
    x: totalsX,
    y: summaryTop,
    size: 9,
    font: boldFont,
    color: mutedColor,
  });
  page.drawText(template.subtotalLabel, {
    x: totalsX,
    y: summaryTop - 17,
    size: 11,
    font: regularFont,
    color: mutedColor,
  });
  drawRightText(`$${input.subtotal.toFixed(2)}`, marginX + contentWidth, summaryTop - 17, 11, boldFont, textColor);
  page.drawText(`${template.taxLabel} (7%)`, {
    x: totalsX,
    y: summaryTop - 33,
    size: 11,
    font: regularFont,
    color: mutedColor,
  });
  drawRightText(`$${input.tax.toFixed(2)}`, marginX + contentWidth, summaryTop - 33, 11, boldFont, textColor);
  page.drawText(template.totalLabel, {
    x: totalsX,
    y: summaryTop - 56,
    size: 20,
    font: boldFont,
    color: brandColor,
  });
  drawRightText(`$${input.total.toFixed(2)}`, marginX + contentWidth, summaryTop - 56, 24, boldFont, brandColor);
  cursorY = summaryTop - 88;
  const bottomAnchorY = 238;
  if (cursorY > bottomAnchorY) {
    cursorY = bottomAnchorY;
  }

  ensureSpace(200);
  const servicesTop = cursorY;
  const servicesHeight = 86;
  const sectionGap = 12;
  const sectionWidth = (contentWidth - sectionGap) / 2;

  page.drawRectangle({
    x: marginX,
    y: servicesTop - servicesHeight,
    width: contentWidth,
    height: servicesHeight,
    color: backgroundColor,
  });
  drawDivider(servicesTop, 1, lineColor);
  drawDivider(servicesTop - servicesHeight, 1, lineColor);

  const drawServiceSection = (
    x: number,
    title: string,
    main: string,
    sub: string
  ) => {
    page.drawText(title, {
      x,
      y: servicesTop - 13,
      size: 8.5,
      font: boldFont,
      color: mutedColor,
    });
    let mainY = servicesTop - 27;
    for (const line of wrapText(main, sectionWidth - 4, 9.5)) {
      page.drawText(line, {
        x,
        y: mainY,
        size: 9.5,
        font: regularFont,
        color: textColor,
      });
      mainY -= 11;
      if (mainY < servicesTop - 53) {
        break;
      }
    }
    let subY = servicesTop - 58;
    for (const line of wrapText(sub, sectionWidth - 4, 8.5)) {
      page.drawText(line, {
        x,
        y: subY,
        size: 8.5,
        font: regularFont,
        color: mutedColor,
      });
      subY -= 10;
      if (subY < servicesTop - 78) {
        break;
      }
    }
  };

  drawServiceSection(
    marginX + 4,
    "PAYMENT METHODS",
    "Credit | Debit | ACH | Check | Zelle | Cash",
    paymentTerms
  );
  drawServiceSection(
    marginX + sectionWidth + sectionGap + 4,
    "NOTES",
    notesDisplay,
    thankYouNote
  );
  cursorY = servicesTop - servicesHeight - 14;

  const footerHeadY = cursorY - 12;
  page.drawText("Payment Method:", {
    x: marginX,
    y: footerHeadY,
    size: 12.5,
    font: boldFont,
    color: textColor,
  });
  page.drawText("Credit / Debit / ACH / Check", {
    x: marginX,
    y: footerHeadY - 15,
    size: 11,
    font: regularFont,
    color: textSoftColor,
  });
  page.drawText("We accept: Visa, MasterCard, Zelle, Cash", {
    x: marginX,
    y: footerHeadY - 29,
    size: 11,
    font: regularFont,
    color: textSoftColor,
  });

  drawRightText("Luis Acostas", marginX + contentWidth, footerHeadY - 1, 15, boldFont, textColor);
  drawRightText("President / Owner", marginX + contentWidth, footerHeadY - 17, 11.5, regularFont, textSoftColor);

  page.drawText("Regulation Disclaimer:", {
    x: marginX,
    y: footerHeadY - 50,
    size: 9,
    font: boldFont,
    color: mutedColor,
  });
  page.drawText("Authorization & Payment Terms:", {
    x: marginX,
    y: footerHeadY - 63,
    size: 9.5,
    font: boldFont,
    color: textColor,
  });

  let clauseY = footerHeadY - 76;
  for (const clause of template.legalClauses.slice(0, 4)) {
    const lines = wrapText(clause, contentWidth, 8.5);
    for (const line of lines) {
      if (clauseY < 66) {
        break;
      }
      page.drawText(line, {
        x: marginX,
        y: clauseY,
        size: 8.5,
        font: regularFont,
        color: mutedColor,
      });
      clauseY -= 10;
    }
    clauseY -= 2;
  }

  if (theme === "ESTIMATE" && template.showEstimateWatermark && resolvedTheme.watermarkText.trim()) {
    const watermarkText = resolvedTheme.watermarkText.trim().toUpperCase();
    const size = 90;
    const textWidth = boldFont.widthOfTextAtSize(watermarkText, size);
    page.drawText(watermarkText, {
      x: (pageWidth - textWidth) / 2,
      y: (pageHeight - size) / 2,
      size,
      font: boldFont,
      color: rgb(brandR * 0.8 + 0.2, brandG * 0.8 + 0.2, brandB * 0.8 + 0.2),
      opacity: 0.12,
    });
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
