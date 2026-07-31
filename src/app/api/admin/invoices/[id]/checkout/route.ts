import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createInvoiceCheckoutSession } from "@/lib/payments/checkout";
import { resolveParams } from "@/lib/utils/params";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await resolveParams(context.params);
  const invoiceId = params?.id;
  if (!invoiceId) {
    return NextResponse.json({ error: "Invalid invoice" }, { status: 400 });
  }

  try {
    const url = await createInvoiceCheckoutSession(invoiceId);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("[admin invoice checkout]", error);
    return NextResponse.redirect(
      new URL(`/admin/invoices/${invoiceId}?payment=error`, request.url),
      { status: 303 }
    );
  }
}
