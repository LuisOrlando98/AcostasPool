import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createInvoiceCheckoutSession } from "@/lib/payments/checkout";
import { resolveParams } from "@/lib/utils/params";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await resolveParams(context.params);
  const invoiceId = params?.id;
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice" }, { status: 400 });
  }

  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    // Redirect to a real page (not back to this API route) - the client
    // router's soft navigation after login can't reliably follow a
    // redirect from a plain Route Handler.
    const next = encodeURIComponent("/client/invoices");
    return NextResponse.redirect(new URL(`/login?next=${next}`, request.url), { status: 303 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, customerId: true },
  });
  if (!customer || !invoice || invoice.customerId !== customer.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const url = await createInvoiceCheckoutSession(invoiceId);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("[client invoice checkout]", error);
    return NextResponse.redirect(
      new URL("/client/invoices?payment=error", request.url),
      { status: 303 }
    );
  }
}
