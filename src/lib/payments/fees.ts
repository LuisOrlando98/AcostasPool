import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/client";

export const MEMBERSHIP_TRANSACTION_FEE_PERCENT = 3;

export function computeMembershipFeeCents(baseCents: number) {
  const feeCents = Math.round(baseCents * (MEMBERSHIP_TRANSACTION_FEE_PERCENT / 100));
  return {
    baseCents,
    feeCents,
    totalCents: baseCents + feeCents,
  };
}

/**
 * Adds the transaction-fee subscription item to a membership that was
 * created before the fee existed. Takes effect at the next billing cycle
 * (proration_behavior: "none") rather than charging a prorated amount
 * mid-cycle.
 */
export async function applyFeeToMembership(membershipId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership) {
    throw new Error("Membership not found");
  }
  if (membership.feeAmountCents) {
    return;
  }

  const baseAmountCents = membership.baseAmountCents ?? membership.amountCents;
  const { feeCents } = computeMembershipFeeCents(baseAmountCents);

  const stripe = getStripeClient();
  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: feeCents,
    recurring: { interval: "month" },
    product_data: {
      name: `Payment processing fee (${MEMBERSHIP_TRANSACTION_FEE_PERCENT}%)`,
    },
  });

  await stripe.subscriptionItems.create({
    subscription: membership.stripeSubscriptionId,
    price: price.id,
    proration_behavior: "none",
  });

  await prisma.membership.update({
    where: { id: membershipId },
    data: {
      baseAmountCents,
      feeAmountCents: feeCents,
      amountCents: baseAmountCents + feeCents,
    },
  });
}
