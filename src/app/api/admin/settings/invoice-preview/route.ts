import { NextResponse, type NextRequest } from "next/server";
import { getRequestLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth/session";
import { resolveEmailTemplateLocale } from "@/lib/email-templates";
import { generateInvoicePdfBytes } from "@/lib/invoices/pdf";
import {
  INVOICE_PREVIEW_THEME_PARAM,
  buildInvoicePreviewSample,
  resolveInvoicePreviewTheme,
} from "@/lib/invoices/preview-sample";
import { getInvoiceTemplateConfig } from "@/lib/site-settings";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const theme = resolveInvoicePreviewTheme(
    request.nextUrl.searchParams.get(INVOICE_PREVIEW_THEME_PARAM)
  );

  try {
    const [requestLocale, template] = await Promise.all([
      getRequestLocale(),
      getInvoiceTemplateConfig(),
    ]);
    const pdfBytes = await generateInvoicePdfBytes(
      buildInvoicePreviewSample({
        locale: resolveEmailTemplateLocale(requestLocale),
        theme,
        template,
      })
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-preview-${theme.toLowerCase()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[settings] Invoice preview PDF generation failed.", error);
    return NextResponse.json(
      { error: "Could not generate invoice preview PDF" },
      { status: 500 }
    );
  }
}
