import fs from "fs/promises";
import path from "path";
import { PDFDocument, PDFPage, PDFFont, PDFImage, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceTemplateConfig } from "@/lib/invoice-template";
import {
  SERVICE_CONTRACT_CONTENT,
  type ServiceContractLocale,
} from "@/lib/contracts/service-contract-content";

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 46;
const TOP_HEADER_HEIGHT = 78;
const START_Y = PAGE_HEIGHT - TOP_HEADER_HEIGHT - 24;
const BOTTOM_SAFE = 56;

// The contract's Parties section must state the exact registered legal
// entity, independent of whatever short brand name is configured for
// invoices/settings.
const COMPANY_LEGAL_NAME = "Acosta's Pool LLC";

export type PoolConditionRow = {
  label: string;
  status: "BROKEN" | "BAD" | "GOOD" | null;
  statusLabel: string | null;
};

export type ServiceContractPdfInput = {
  locale: ServiceContractLocale;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  propertyAddress: string | null;
  poolType: string | null;
  planName: string | null;
  planServices: string[];
  servicePrice: number | null;
  paymentDayLabel: string | null;
  paymentTypeLabel: string | null;
  paymentMethodLabel: string | null;
  serviceStartDateLabel: string | null;
  poolCondition: PoolConditionRow[];
  company: InvoiceTemplateConfig;
  generatedAt: string;
  companySignatureImageBytes?: Uint8Array | null;
  clientSignatureImageBytes?: Uint8Array | null;
  clientSignedAtLabel?: string | null;
};

type RenderContext = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage | null;
  page: PDFPage | null;
  y: number;
  pageNumber: number;
  headerLabel: string;
  generatedAt: string;
};

const CONDITION_DOT_COLOR: Record<string, ReturnType<typeof rgb>> = {
  BROKEN: rgb(0.88, 0.24, 0.24),
  BAD: rgb(0.93, 0.7, 0.13),
  GOOD: rgb(0.13, 0.63, 0.39),
};

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${line} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = words[i];
  }
  lines.push(line);
  return lines;
}

function drawHeader(ctx: RenderContext) {
  const { page, bold, regular, pageNumber, generatedAt, logo, headerLabel } = ctx;
  if (!page) {
    return;
  }
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - TOP_HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: TOP_HEADER_HEIGHT,
    color: rgb(0.05, 0.11, 0.24),
  });

  let textX = MARGIN_X;
  if (logo) {
    const logoHeight = 34;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - TOP_HEADER_HEIGHT / 2 - logoHeight / 2,
      width: logoWidth,
      height: logoHeight,
    });
    textX = MARGIN_X + logoWidth + 12;
  }

  page.drawText(headerLabel, {
    x: textX,
    y: PAGE_HEIGHT - 32,
    font: bold,
    size: 12,
    color: rgb(0.92, 0.96, 1),
  });
  page.drawText(generatedAt, {
    x: textX,
    y: PAGE_HEIGHT - 48,
    font: regular,
    size: 8.5,
    color: rgb(0.74, 0.83, 0.94),
  });

  const pageLabel = `Page ${pageNumber}`;
  const labelWidth = regular.widthOfTextAtSize(pageLabel, 9);
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - MARGIN_X - labelWidth,
    y: PAGE_HEIGHT - 40,
    font: regular,
    size: 9,
    color: rgb(0.84, 0.9, 0.98),
  });
}

function createPage(ctx: RenderContext) {
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pageNumber += 1;
  ctx.y = START_Y;
  drawHeader(ctx);
}

function ensureRoom(ctx: RenderContext, requiredHeight: number) {
  if (ctx.y - requiredHeight < BOTTOM_SAFE) {
    createPage(ctx);
  }
}

function drawTitle(ctx: RenderContext, text: string) {
  ensureRoom(ctx, 40);
  if (!ctx.page) {
    return;
  }
  ctx.page.drawText(text, {
    x: MARGIN_X,
    y: ctx.y,
    font: ctx.bold,
    size: 18,
    color: rgb(0.06, 0.14, 0.29),
  });
  ctx.y -= 26;
}

function drawSectionHeading(ctx: RenderContext, text: string) {
  ensureRoom(ctx, 28);
  if (!ctx.page) {
    return;
  }
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - 10,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 18,
    color: rgb(0.9, 0.95, 1),
  });
  ctx.page.drawText(text, {
    x: MARGIN_X + 8,
    y: ctx.y - 4,
    font: ctx.bold,
    size: 10,
    color: rgb(0.05, 0.24, 0.46),
  });
  ctx.y -= 24;
}

function drawParagraph(ctx: RenderContext, text: string, size = 9.8, tone: "body" | "muted" = "body") {
  const width = PAGE_WIDTH - MARGIN_X * 2;
  const lines = wrapText(text, width, ctx.regular, size);
  ensureRoom(ctx, lines.length * 12 + 6);
  if (!ctx.page) {
    return;
  }
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN_X,
      y: ctx.y,
      font: ctx.regular,
      size,
      color: tone === "muted" ? rgb(0.38, 0.46, 0.58) : rgb(0.14, 0.18, 0.26),
    });
    ctx.y -= 12;
  }
  ctx.y -= 4;
}

function drawBullet(ctx: RenderContext, text: string) {
  const bulletX = MARGIN_X + 2;
  const textX = MARGIN_X + 14;
  const width = PAGE_WIDTH - textX - MARGIN_X;
  const lines = wrapText(text, width, ctx.regular, 9.6);
  ensureRoom(ctx, lines.length * 12 + 4);
  if (!ctx.page) {
    return;
  }
  ctx.page.drawCircle({
    x: bulletX + 3,
    y: ctx.y + 4,
    size: 1.8,
    color: rgb(0.06, 0.32, 0.62),
  });
  for (let i = 0; i < lines.length; i += 1) {
    ctx.page.drawText(lines[i], {
      x: textX,
      y: ctx.y,
      font: ctx.regular,
      size: 9.6,
      color: rgb(0.14, 0.18, 0.26),
    });
    ctx.y -= 12;
  }
  ctx.y -= 2;
}

function drawFieldRow(ctx: RenderContext, label: string, value: string) {
  ensureRoom(ctx, 14);
  if (!ctx.page) {
    return;
  }
  ctx.page.drawText(label, {
    x: MARGIN_X,
    y: ctx.y,
    font: ctx.bold,
    size: 9.4,
    color: rgb(0.28, 0.36, 0.5),
  });
  ctx.page.drawText(value || "N/A", {
    x: MARGIN_X + 150,
    y: ctx.y,
    font: ctx.regular,
    size: 9.4,
    color: rgb(0.14, 0.18, 0.26),
  });
  ctx.y -= 15;
}

function drawConditionRow(ctx: RenderContext, row: PoolConditionRow) {
  ensureRoom(ctx, 14);
  if (!ctx.page) {
    return;
  }
  ctx.page.drawText(row.label, {
    x: MARGIN_X,
    y: ctx.y,
    font: ctx.regular,
    size: 9.4,
    color: rgb(0.14, 0.18, 0.26),
  });
  const dotX = MARGIN_X + 220;
  if (row.status) {
    ctx.page.drawCircle({
      x: dotX,
      y: ctx.y + 3,
      size: 4,
      color: CONDITION_DOT_COLOR[row.status],
    });
  }
  ctx.page.drawText(row.statusLabel ?? "N/A", {
    x: dotX + 12,
    y: ctx.y,
    font: ctx.regular,
    size: 9.4,
    color: rgb(0.14, 0.18, 0.26),
  });
  ctx.y -= 15;
}

async function loadLogoImage(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "newlogo.png");
    const bytes = await fs.readFile(logoPath);
    return await doc.embedPng(bytes);
  } catch (error) {
    console.error("service-contract-pdf: could not embed logo", error);
    return null;
  }
}

export async function buildServiceContractPdfBytes(
  input: ServiceContractPdfInput
): Promise<Uint8Array> {
  const copy = SERVICE_CONTRACT_CONTENT[input.locale];
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogoImage(doc);

  const ctx: RenderContext = {
    doc,
    regular,
    bold,
    logo,
    page: null,
    y: START_Y,
    pageNumber: 0,
    headerLabel: `${input.company.companyName} | ${copy.headerLabel}`,
    generatedAt: input.generatedAt,
  };

  createPage(ctx);

  drawTitle(ctx, copy.documentTitle);
  drawParagraph(ctx, copy.intro.replace("{{date}}", input.generatedAt), 9, "muted");

  drawSectionHeading(ctx, copy.sections.parties);
  drawFieldRow(ctx, copy.fields.company, COMPANY_LEGAL_NAME);
  drawFieldRow(
    ctx,
    copy.fields.address,
    [input.company.companyAddressLine1, input.company.companyAddressLine2]
      .filter(Boolean)
      .join(", ")
  );
  drawFieldRow(
    ctx,
    copy.fields.contact,
    [input.company.companyEmail, input.company.companyPhone].filter(Boolean).join(" | ")
  );
  ctx.y -= 4;
  drawFieldRow(ctx, copy.fields.client, input.customerName);
  drawFieldRow(ctx, copy.fields.email, input.customerEmail ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.phone, input.customerPhone ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.clientAddress, input.customerAddress ?? copy.notAvailable);

  drawSectionHeading(ctx, copy.sections.propertyAndScope);
  drawFieldRow(ctx, copy.fields.propertyAddress, input.propertyAddress ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.poolType, input.poolType ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.plan, input.planName ?? copy.notAvailable);
  drawParagraph(ctx, copy.scopeParagraph, 9.4);

  drawSectionHeading(ctx, copy.sections.paymentTerms);
  drawFieldRow(
    ctx,
    copy.fields.servicePrice,
    input.servicePrice != null ? `$${input.servicePrice.toFixed(2)} USD / mo` : copy.notAvailable
  );
  drawFieldRow(ctx, copy.fields.startDate, input.serviceStartDateLabel ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.paymentDay, input.paymentDayLabel ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.paymentMethod, input.paymentMethodLabel ?? copy.notAvailable);
  drawFieldRow(ctx, copy.fields.paymentType, input.paymentTypeLabel ?? copy.notAvailable);
  drawParagraph(ctx, copy.paymentOverdueNote, 9.4);

  drawSectionHeading(ctx, copy.sections.poolCondition);
  if (input.poolCondition.length > 0) {
    for (const row of input.poolCondition) {
      drawConditionRow(ctx, row);
    }
  } else {
    drawParagraph(ctx, copy.poolConditionEmpty, 9, "muted");
  }

  drawSectionHeading(ctx, copy.sections.durationAndLiability);
  for (const bullet of copy.durationBullets) {
    drawBullet(ctx, bullet);
  }

  drawSectionHeading(ctx, copy.sections.signatures);
  ensureRoom(ctx, 96);
  if (ctx.page) {
    const colWidth = (PAGE_WIDTH - MARGIN_X * 2 - 24) / 2;
    const imageMaxHeight = 40;
    const lineY = ctx.y - imageMaxHeight - 8;
    const companyX = MARGIN_X;
    const clientX = MARGIN_X + colWidth + 24;

    const companySig = input.companySignatureImageBytes
      ? await doc.embedPng(input.companySignatureImageBytes).catch(() => null)
      : null;
    if (companySig) {
      const imgWidth = Math.min(colWidth, (companySig.width / companySig.height) * imageMaxHeight);
      ctx.page.drawImage(companySig, {
        x: companyX,
        y: lineY + 4,
        width: imgWidth,
        height: imageMaxHeight,
      });
    }
    const clientSig = input.clientSignatureImageBytes
      ? await doc.embedPng(input.clientSignatureImageBytes).catch(() => null)
      : null;
    if (clientSig) {
      const imgWidth = Math.min(colWidth, (clientSig.width / clientSig.height) * imageMaxHeight);
      ctx.page.drawImage(clientSig, {
        x: clientX,
        y: lineY + 4,
        width: imgWidth,
        height: imageMaxHeight,
      });
    }

    ctx.page.drawLine({
      start: { x: companyX, y: lineY },
      end: { x: companyX + colWidth, y: lineY },
      thickness: 0.7,
      color: rgb(0.4, 0.46, 0.56),
    });
    ctx.page.drawText(copy.signatureCompany, {
      x: companyX,
      y: lineY - 12,
      font: ctx.regular,
      size: 8.6,
      color: rgb(0.38, 0.46, 0.58),
    });

    ctx.page.drawLine({
      start: { x: clientX, y: lineY },
      end: { x: clientX + colWidth, y: lineY },
      thickness: 0.7,
      color: rgb(0.4, 0.46, 0.56),
    });
    ctx.page.drawText(copy.signatureClient, {
      x: clientX,
      y: lineY - 12,
      font: ctx.regular,
      size: 8.6,
      color: rgb(0.38, 0.46, 0.58),
    });
    if (input.clientSignedAtLabel) {
      ctx.page.drawText(
        copy.signedOnLabel.replace("{{date}}", input.clientSignedAtLabel),
        {
          x: clientX,
          y: lineY - 24,
          font: ctx.regular,
          size: 8,
          color: rgb(0.55, 0.6, 0.68),
        }
      );
    }
    ctx.y = lineY - 40;
  }

  drawParagraph(ctx, copy.closingNote, 8.6, "muted");

  return doc.save();
}
