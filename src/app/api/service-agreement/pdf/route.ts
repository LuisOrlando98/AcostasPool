import { NextResponse } from "next/server";
import { buildServiceAgreementPdfBytes } from "@/lib/service-agreement-pdf";

export async function GET() {
  try {
    const pdfBytes = await buildServiceAgreementPdfBytes();
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="acostaspool-service-agreement.pdf"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("service-agreement-pdf-error", error);
    return NextResponse.json(
      { error: "Could not generate service agreement PDF" },
      { status: 500 }
    );
  }
}
