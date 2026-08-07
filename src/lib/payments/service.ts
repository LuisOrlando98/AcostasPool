import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Stripe rejects any USD charge below this amount, regardless of flow. */
export const STRIPE_MINIMUM_CHARGE_USD = 0.5;

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

type RecordPaymentInput = {
  customerId: string;
  invoiceId?: string | null;
  membershipId?: string | null;
  amountCents: number;
  currency?: string;
  status: PaymentStatus;
  method: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeInvoiceId?: string | null;
  refundOfPaymentId?: string | null;
  recordedByUserId?: string | null;
  paidAt: Date;
};

export async function recordPayment(input: RecordPaymentInput) {
  return prisma.payment.create({
    data: {
      customerId: input.customerId,
      invoiceId: input.invoiceId ?? null,
      membershipId: input.membershipId ?? null,
      amountCents: input.amountCents,
      currency: input.currency ?? "usd",
      status: input.status,
      method: input.method,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeChargeId: input.stripeChargeId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      refundOfPaymentId: input.refundOfPaymentId ?? null,
      recordedByUserId: input.recordedByUserId ?? null,
      paidAt: input.paidAt,
    },
  });
}

export async function markInvoicePaid(invoiceId: string, paidAt: Date) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "PAID", paidAt },
  });
}
