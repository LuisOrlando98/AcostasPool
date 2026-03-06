import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import {
  SERVICE_AGREEMENT_CLAUSES,
  SERVICE_AGREEMENT_EXECUTIVE_SUMMARY,
  SERVICE_AGREEMENT_FEATURES,
  SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN,
  SERVICE_AGREEMENT_INITIAL_GUARANTEE,
  SERVICE_AGREEMENT_LOGOS,
  SERVICE_AGREEMENT_META,
  SERVICE_AGREEMENT_PLAN_PRICING,
  SERVICE_AGREEMENT_PLUS_PLAN,
  SERVICE_AGREEMENT_REFERENCES,
} from "@/lib/service-agreement-content";
import { formatInBusinessTimeZone } from "@/lib/timezone";

const PAGE_WIDTH = 595.28; // A4 portrait
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 46;
const TOP_HEADER_HEIGHT = 64;
const START_Y = PAGE_HEIGHT - TOP_HEADER_HEIGHT - 24;
const BOTTOM_SAFE = 48;

type RenderContext = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage | null;
  y: number;
  pageNumber: number;
  generatedAt: string;
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
  const { page, bold, regular, pageNumber, generatedAt } = ctx;
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
  page.drawText("ACOSTASPOOL | SERVICE AGREEMENT", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 24,
    font: bold,
    size: 11,
    color: rgb(0.92, 0.96, 1),
  });
  page.drawText(`Version ${SERVICE_AGREEMENT_META.documentVersion} | ${generatedAt}`, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 40,
    font: regular,
    size: 8.5,
    color: rgb(0.74, 0.83, 0.94),
  });
  const pageLabel = `Pag ${pageNumber}`;
  const labelWidth = regular.widthOfTextAtSize(pageLabel, 9);
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - MARGIN_X - labelWidth,
    y: PAGE_HEIGHT - 34,
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

function drawSubtitle(ctx: RenderContext, text: string) {
  const lines = wrapText(text, PAGE_WIDTH - MARGIN_X * 2, ctx.regular, 10.5);
  ensureRoom(ctx, lines.length * 14 + 8);
  if (!ctx.page) {
    return;
  }
  for (const line of lines) {
    ctx.page.drawText(line, {
      x: MARGIN_X,
      y: ctx.y,
      font: ctx.regular,
      size: 10.5,
      color: rgb(0.28, 0.36, 0.5),
    });
    ctx.y -= 14;
  }
  ctx.y -= 4;
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

function drawParagraph(ctx: RenderContext, text: string, size = 9.8, tone = "body") {
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

function drawPricingTable(ctx: RenderContext) {
  const tableX = MARGIN_X;
  const tableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const col1Width = tableWidth * 0.5;
  const col2Width = tableWidth * 0.24;
  const col3Width = tableWidth - col1Width - col2Width;
  const headerHeight = 18;

  let requiredHeight = headerHeight + 8;
  for (const row of SERVICE_AGREEMENT_PLAN_PRICING) {
    const planLines = wrapText(row.plan, col1Width - 10, ctx.regular, 9);
    const rowHeight = Math.max(18, planLines.length * 11 + 6);
    requiredHeight += rowHeight;
  }
  ensureRoom(ctx, requiredHeight + 6);
  if (!ctx.page) {
    return;
  }

  let currentY = ctx.y;

  ctx.page.drawRectangle({
    x: tableX,
    y: currentY - headerHeight + 2,
    width: tableWidth,
    height: headerHeight,
    color: rgb(0.05, 0.11, 0.24),
  });

  ctx.page.drawText("Plan", {
    x: tableX + 6,
    y: currentY - 11,
    font: ctx.bold,
    size: 9,
    color: rgb(0.95, 0.98, 1),
  });
  ctx.page.drawText("Ano 1", {
    x: tableX + col1Width + 6,
    y: currentY - 11,
    font: ctx.bold,
    size: 9,
    color: rgb(0.95, 0.98, 1),
  });
  ctx.page.drawText("Ano 2+", {
    x: tableX + col1Width + col2Width + 6,
    y: currentY - 11,
    font: ctx.bold,
    size: 9,
    color: rgb(0.95, 0.98, 1),
  });

  currentY -= headerHeight;

  for (let i = 0; i < SERVICE_AGREEMENT_PLAN_PRICING.length; i += 1) {
    const row = SERVICE_AGREEMENT_PLAN_PRICING[i];
    const planLines = wrapText(row.plan, col1Width - 10, ctx.regular, 9);
    const rowHeight = Math.max(18, planLines.length * 11 + 6);
    const fillColor = i % 2 === 0 ? rgb(0.97, 0.98, 1) : rgb(0.94, 0.96, 0.99);

    ctx.page.drawRectangle({
      x: tableX,
      y: currentY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      color: fillColor,
    });

    let planTextY = currentY - 12;
    for (const line of planLines) {
      ctx.page.drawText(line, {
        x: tableX + 6,
        y: planTextY,
        font: ctx.regular,
        size: 9,
        color: rgb(0.14, 0.18, 0.26),
      });
      planTextY -= 11;
    }

    ctx.page.drawText(row.year1, {
      x: tableX + col1Width + 6,
      y: currentY - 12,
      font: ctx.regular,
      size: 9,
      color: rgb(0.14, 0.18, 0.26),
    });
    ctx.page.drawText(row.year2Plus, {
      x: tableX + col1Width + col2Width + 6,
      y: currentY - 12,
      font: ctx.regular,
      size: 9,
      color: rgb(0.14, 0.18, 0.26),
    });

    ctx.page.drawLine({
      start: { x: tableX, y: currentY - rowHeight },
      end: { x: tableX + tableWidth, y: currentY - rowHeight },
      thickness: 0.6,
      color: rgb(0.82, 0.87, 0.94),
    });

    currentY -= rowHeight;
  }

  ctx.page.drawLine({
    start: { x: tableX + col1Width, y: ctx.y - 2 },
    end: { x: tableX + col1Width, y: currentY },
    thickness: 0.6,
    color: rgb(0.82, 0.87, 0.94),
  });
  ctx.page.drawLine({
    start: { x: tableX + col1Width + col2Width, y: ctx.y - 2 },
    end: { x: tableX + col1Width + col2Width, y: currentY },
    thickness: 0.6,
    color: rgb(0.82, 0.87, 0.94),
  });

  ctx.y = currentY - 6;
}

function logoCategoryColor(category: string) {
  if (category === "brand") {
    return rgb(0.11, 0.2, 0.47);
  }
  if (category === "platform") {
    return rgb(0.05, 0.37, 0.64);
  }
  if (category === "infrastructure") {
    return rgb(0.58, 0.29, 0.07);
  }
  return rgb(0.07, 0.45, 0.36);
}

function drawLogoMatrix(ctx: RenderContext) {
  const cols = 3;
  const gap = 8;
  const rowHeight = 31;
  const cardWidth = (PAGE_WIDTH - MARGIN_X * 2 - gap * (cols - 1)) / cols;
  const rows = Math.ceil(SERVICE_AGREEMENT_LOGOS.length / cols);

  for (let row = 0; row < rows; row += 1) {
    ensureRoom(ctx, rowHeight + 4);
    if (!ctx.page) {
      return;
    }
    const baseY = ctx.y;

    for (let col = 0; col < cols; col += 1) {
      const index = row * cols + col;
      if (index >= SERVICE_AGREEMENT_LOGOS.length) {
        continue;
      }
      const logo = SERVICE_AGREEMENT_LOGOS[index];
      const x = MARGIN_X + col * (cardWidth + gap);
      const y = baseY - rowHeight + 2;
      const categoryTone = logoCategoryColor(logo.category);

      ctx.page.drawRectangle({
        x,
        y,
        width: cardWidth,
        height: rowHeight,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.82, 0.87, 0.94),
        borderWidth: 0.6,
      });
      ctx.page.drawRectangle({
        x,
        y: y + rowHeight - 3,
        width: cardWidth,
        height: 3,
        color: categoryTone,
      });

      ctx.page.drawText(logo.short, {
        x: x + 5,
        y: y + 16,
        font: ctx.bold,
        size: 7.6,
        color: categoryTone,
      });

      const lines = wrapText(logo.name, cardWidth - 44, ctx.regular, 7.1).slice(0, 2);
      for (let i = 0; i < lines.length; i += 1) {
        ctx.page.drawText(lines[i], {
          x: x + 28,
          y: y + 17 - i * 8,
          font: ctx.regular,
          size: 7.1,
          color: rgb(0.14, 0.18, 0.26),
        });
      }
    }

    ctx.y -= rowHeight + 4;
  }
  ctx.y -= 2;
}

export async function buildServiceAgreementPdfBytes() {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const generatedAt = formatInBusinessTimeZone(new Date(), "es-US", {
    dateStyle: "short",
  });
  const ctx: RenderContext = {
    doc,
    regular,
    bold,
    page: null,
    y: START_Y,
    pageNumber: 0,
    generatedAt,
  };

  createPage(ctx);

  drawTitle(ctx, SERVICE_AGREEMENT_META.title);
  drawSubtitle(ctx, SERVICE_AGREEMENT_META.subtitle);
  drawParagraph(
    ctx,
    `Preparado por: ${SERVICE_AGREEMENT_META.preparedBy} | ${SERVICE_AGREEMENT_META.publicationDateLabel}: ${generatedAt}`,
    9.2,
    "muted"
  );

  drawSectionHeading(ctx, "Resumen Ejecutivo");
  for (const paragraph of SERVICE_AGREEMENT_EXECUTIVE_SUMMARY) {
    drawParagraph(ctx, paragraph);
  }

  drawSectionHeading(ctx, "Matriz visual de 23 logos");
  drawParagraph(
    ctx,
    "El acuerdo integra una matriz de 23 logos para presentacion comercial. Incluye de forma destacada Wyxloop Dev y el lockup AcostasPool utilizado en invoice."
  );
  drawLogoMatrix(ctx);

  drawSectionHeading(ctx, "Resumen de Funcionalidades de la Plataforma");
  for (const feature of SERVICE_AGREEMENT_FEATURES) {
    drawParagraph(ctx, feature.title, 10, "muted");
    drawParagraph(ctx, feature.summary, 9.7);
    for (const bullet of feature.bullets) {
      drawBullet(ctx, bullet);
    }
    ctx.y -= 2;
  }

  drawSectionHeading(ctx, "Garantia inicial y planes de continuidad");
  drawParagraph(ctx, SERVICE_AGREEMENT_INITIAL_GUARANTEE.title, 10, "muted");
  drawParagraph(ctx, SERVICE_AGREEMENT_INITIAL_GUARANTEE.summary, 9.6);
  for (const bullet of SERVICE_AGREEMENT_INITIAL_GUARANTEE.supportScope) {
    drawBullet(ctx, bullet);
  }
  drawParagraph(ctx, SERVICE_AGREEMENT_INITIAL_GUARANTEE.transitionNote, 9.2);

  drawParagraph(ctx, SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.title, 10, "muted");
  drawParagraph(ctx, SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.summary, 9.6);
  for (const bullet of SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.includedInfrastructure) {
    drawBullet(ctx, bullet);
  }
  drawParagraph(ctx, SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN.importantNote, 9.2);

  drawParagraph(ctx, SERVICE_AGREEMENT_PLUS_PLAN.title, 10, "muted");
  drawParagraph(ctx, SERVICE_AGREEMENT_PLUS_PLAN.summary, 9.6);
  drawParagraph(ctx, "Incluye:", 9.4, "muted");
  for (const bullet of SERVICE_AGREEMENT_PLUS_PLAN.includedServices) {
    drawBullet(ctx, bullet);
  }
  drawParagraph(ctx, "No incluye:", 9.4, "muted");
  for (const bullet of SERVICE_AGREEMENT_PLUS_PLAN.exclusions) {
    drawBullet(ctx, bullet);
  }
  drawParagraph(ctx, "Justificacion operativa:", 9.4, "muted");
  for (const bullet of SERVICE_AGREEMENT_PLUS_PLAN.businessRationale) {
    drawBullet(ctx, bullet);
  }

  drawParagraph(ctx, "Resumen de precios mensuales", 9.6, "muted");
  drawPricingTable(ctx);

  drawSectionHeading(ctx, "Marco Contractual Propuesto");
  for (const clause of SERVICE_AGREEMENT_CLAUSES) {
    drawParagraph(ctx, clause.title, 10, "muted");
    for (const paragraph of clause.paragraphs) {
      drawParagraph(ctx, paragraph, 9.6);
    }
    if (clause.bullets) {
      for (const bullet of clause.bullets) {
        drawBullet(ctx, bullet);
      }
    }
    ctx.y -= 3;
  }

  drawSectionHeading(ctx, "Referencias para estructura legal y de servicio");
  for (const reference of SERVICE_AGREEMENT_REFERENCES) {
    drawParagraph(ctx, reference.label, 9.8, "muted");
    drawParagraph(ctx, reference.url, 8.8, "muted");
    drawParagraph(ctx, reference.note, 9.2);
  }

  drawSectionHeading(ctx, "Bloque de validacion legal");
  drawParagraph(
    ctx,
    "Este documento es comercial y operativo. Antes de firma contractual, se recomienda revision por asesoria legal de ambas partes para adecuacion a jurisdiccion, fiscalidad y regimen de responsabilidad aplicable."
  );

  return doc.save();
}
