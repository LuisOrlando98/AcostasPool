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
  const fallback = (reason: string) => {
    console.error(`[pay invoice token] falling back to login, reason=${reason}`);
    return NextResponse.redirect(
      `${appUrl}/login?next=%2Fclient%2Finvoices&reason=${reason}`,
      { status: 303 }
    );
  };

  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `pay-invoice-token:ip:${ip}`,
    limit: 30,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return fallback("rate_limited");
  }

  const params = await resolveParams(context.params);
  const token = params?.token;
  if (!token) {
    return fallback("missing_token");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { paymentToken: token },
    select: { id: true, status: true, paymentTokenExpiresAt: true },
  });

  if (!invoice) {
    return fallback("token_not_found");
  }
  if (!invoice.paymentTokenExpiresAt || invoice.paymentTokenExpiresAt < new Date()) {
    return fallback("token_expired");
  }
  if (invoice.status === "PAID") {
    return fallback("already_paid");
  }

  try {
    const url = await createInvoiceCheckoutSession(invoice.id);
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("[pay invoice token] checkout session creation failed", error);
    return fallback("checkout_failed");
  }
}
