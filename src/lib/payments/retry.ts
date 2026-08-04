import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/client";

export async function retryMembershipCharge(membershipId: string): Promise<void> {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
  });
  if (!membership) {
    throw new Error("Membership not found");
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
  const latestInvoiceId =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id;

  if (!latestInvoiceId) {
    throw new Error("No open invoice to retry for this membership");
  }

  await stripe.invoices.pay(latestInvoiceId);
}
