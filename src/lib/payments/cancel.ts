import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/client";

export async function cancelMembership(
  membershipId: string,
  mode: "immediate" | "period_end"
) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) {
    throw new Error("Membership not found");
  }

  const stripe = getStripeClient();
  if (mode === "immediate") {
    await stripe.subscriptions.cancel(membership.stripeSubscriptionId);
    await prisma.membership.update({
      where: { id: membershipId },
      data: { status: "CANCELED", canceledAt: new Date(), cancelAtPeriodEnd: false },
    });
    return;
  }

  await stripe.subscriptions.update(membership.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  await prisma.membership.update({
    where: { id: membershipId },
    data: { cancelAtPeriodEnd: true },
  });
}
