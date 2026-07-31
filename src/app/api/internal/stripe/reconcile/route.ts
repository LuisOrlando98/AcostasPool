import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/client";
import { mapStripeSubscriptionStatus, subscriptionPeriod } from "@/lib/payments/membership";

function hasValidCronSecret(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }
  const received = request.headers.get("x-cron-secret")?.trim();
  return received === expected;
}

export async function POST(request: Request) {
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { status: { in: ["ACTIVE", "PAST_DUE", "INCOMPLETE"] } },
  });

  const stripe = getStripeClient();
  let correctedCount = 0;
  let checkedCount = 0;

  for (const membership of memberships) {
    checkedCount += 1;
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId);
    } catch (error) {
      console.error(
        `[stripe reconcile] failed to retrieve subscription ${membership.stripeSubscriptionId}`,
        error
      );
      continue;
    }

    const period = subscriptionPeriod(subscription);
    const nextStatus = mapStripeSubscriptionStatus(subscription.status);
    const drifted =
      nextStatus !== membership.status ||
      subscription.cancel_at_period_end !== membership.cancelAtPeriodEnd;

    if (drifted) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          status: nextStatus,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : membership.canceledAt,
        },
      });
      correctedCount += 1;
    }
  }

  return NextResponse.json({ ok: true, checkedCount, correctedCount });
}
