import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createInvoiceCheckoutSession } from "@/lib/payments/checkout";
import { resolveParams } from "@/lib/utils/params";
import { getPublicAppUrl } from "@/lib/app-url";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const appUrl = getPublicAppUrl();
  const fallback = () => NextResponse.redirect(`${appUrl}/login?next=%2Fclient%2Finvoices`, {
    status: 303,
  });

  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `pay-invoice-token:ip:${ip}`,
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return fallback();
  }

  const params = await resolveParams(context.params);
  const token = params?.token;
  if (!token) {
    return fallback();
  }

  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    select: { id: true, status: true, paymentTokenExpiresAt: true },
  });

  if (
    !invoice ||
    !invoice.paymentTokenExpiresAt ||
    invoice.paymentTokenExpiresAt < new Date() ||
    invoice.status === "PAID"
  ) {
    return fallback();
  }

  try {
    const url = await createInvoiceCheckoutSession(invoice.id);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("[pay invoice token]", error);
    return fallback();
  }
}
