import type { MembershipStatus } from "@prisma/client";
import type Stripe from "stripe";

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): MembershipStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

export function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  if (!item) {
    return { start: null, end: null };
  }
  return {
    start: new Date(item.current_period_start * 1000),
    end: new Date(item.current_period_end * 1000),
  };
}
