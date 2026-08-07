import crypto from "crypto";
import { prisma } from "@/lib/db";

export const INVOICE_PAYMENT_TOKEN_TTL_DAYS = 30;

/**
 * Issues (or re-issues) a long-lived, single-purpose token that lets an
 * invoice be paid from the emailed link without logging in. Regenerated on
 * every send, so re-sending an invoice also resets the 30-day window.
 */
export async function issueInvoicePaymentToken(invoiceId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVOICE_PAYMENT_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paymentToken: token, paymentTokenExpiresAt: expiresAt },
  });

  return token;
}
