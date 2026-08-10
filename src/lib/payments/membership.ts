import type { MembershipStatus } from "@prisma/client";
import type Stripe from "stripe";
import type { DateTime } from "luxon";
import { getBusinessNow } from "@/lib/timezone";

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

/**
 * The next occurrence (business timezone, 9am) of a property's payment day.
 * Passed to Stripe as `subscription_data.trial_end` so a customer who
 * activates autopay isn't charged immediately - the card is saved/verified
 * now, and the first real charge (and every renewal after it) lands on the
 * day they were told to expect it.
 */
export function nextPaymentDayDate(paymentDay: number | null | undefined): Date | null {
  if (!paymentDay || paymentDay < 1 || paymentDay > 31) {
    return null;
  }

  const now = getBusinessNow();
  const buildCandidate = (base: DateTime) =>
    base.set({
      day: Math.min(paymentDay, base.daysInMonth ?? paymentDay),
      hour: 9,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

  let candidate = buildCandidate(now);
  if (candidate <= now) {
    candidate = buildCandidate(now.plus({ months: 1 }));
  }

  return candidate.toUTC().toJSDate();
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
