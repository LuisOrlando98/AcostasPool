import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe/client";
import { recordPayment, markInvoicePaid } from "@/lib/payments/service";
import { mapStripeSubscriptionStatus, subscriptionPeriod } from "@/lib/payments/membership";
import { createNotification } from "@/lib/notifications/create";
import { revalidateAttentionPaths } from "@/lib/reports/revalidate";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) {
      return;
    }
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.status === "PAID") {
      return;
    }
    const amountCents = session.amount_total ?? Math.round(Number(invoice.total) * 100);
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    const paidAt = new Date();

    await recordPayment({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      amountCents,
      status: "SUCCEEDED",
      method: "CARD",
      stripePaymentIntentId: paymentIntentId,
      paidAt,
    });
    await markInvoicePaid(invoice.id, paidAt);
    await createNotification({
      customerId: invoice.customerId,
      recipientRole: "ADMIN",
      eventType: "PAYMENT_RECEIVED",
      severity: "INFO",
      payload: {
        invoiceId: invoice.id,
        amountCents,
        source: "Stripe",
      },
    });
    revalidateAttentionPaths(invoice.customerId);
    return;
  }

  if (session.mode === "subscription") {
    const metadata = session.metadata ?? {};
    const customerId = metadata.customerId;
    const propertyId = metadata.propertyId || null;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);
    if (!customerId || !subscriptionId) {
      return;
    }

    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const period = subscriptionPeriod(subscription);
    const baseAmountCents = Number(metadata.baseAmountCents);
    const feeAmountCents = Number(metadata.feeAmountCents);
    const hasFeeBreakdown = Number.isFinite(baseAmountCents) && Number.isFinite(feeAmountCents);
    const servicePrice =
      subscription.items.data.find((item) => item.price.unit_amount === baseAmountCents)
        ?.price ?? subscription.items.data[0]?.price;
    const totalAmountCents = hasFeeBreakdown
      ? baseAmountCents + feeAmountCents
      : (servicePrice?.unit_amount ?? 0);

    const existing = await prisma.membership.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (existing) {
      return;
    }

    await prisma.membership.create({
      data: {
        customerId,
        propertyId,
        stripeSubscriptionId: subscriptionId,
        stripePriceId: servicePrice?.id ?? "",
        amountCents: totalAmountCents,
        baseAmountCents: hasFeeBreakdown ? baseAmountCents : null,
        feeAmountCents: hasFeeBreakdown ? feeAmountCents : null,
        status: mapStripeSubscriptionStatus(subscription.status),
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        authorizedAt: new Date(),
        authorizedVia: metadata.authorizedVia || null,
        authorizedByUserId: metadata.authorizedByUserId || null,
        authorizedIp: metadata.authorizedIp || null,
        authorizedUserAgent: metadata.authorizedUserAgent || null,
      },
    });
    revalidateAttentionPaths(customerId);
  }
}

async function handleInvoicePaymentSucceeded(stripeInvoiceObject: Stripe.Invoice) {
  const subscriptionRef = stripeInvoiceObject.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef?.id ?? null);
  if (!subscriptionId) {
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!membership) {
    return;
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { stripeInvoiceId: stripeInvoiceObject.id },
  });
  if (existingPayment) {
    return;
  }

  const line = stripeInvoiceObject.lines.data[0];
  const paidAt = new Date();

  await recordPayment({
    customerId: membership.customerId,
    membershipId: membership.id,
    amountCents: stripeInvoiceObject.amount_paid,
    status: "SUCCEEDED",
    method: "CARD",
    stripeInvoiceId: stripeInvoiceObject.id ?? null,
    paidAt,
  });

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      status: "ACTIVE",
      currentPeriodStart: line ? new Date(line.period.start * 1000) : membership.currentPeriodStart,
      currentPeriodEnd: line ? new Date(line.period.end * 1000) : membership.currentPeriodEnd,
    },
  });

  await createNotification({
    customerId: membership.customerId,
    recipientRole: "ADMIN",
    eventType: "PAYMENT_RECEIVED",
    severity: "INFO",
    payload: {
      membershipId: membership.id,
      amountCents: stripeInvoiceObject.amount_paid,
      source: "Stripe autopay",
    },
  });
  revalidateAttentionPaths(membership.customerId);
}

async function handleInvoicePaymentFailed(stripeInvoiceObject: Stripe.Invoice) {
  const subscriptionRef = stripeInvoiceObject.parent?.subscription_details?.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string" ? subscriptionRef : (subscriptionRef?.id ?? null);
  if (!subscriptionId) {
    return;
  }

  const membership = await prisma.membership.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (!membership) {
    return;
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "PAST_DUE" },
  });

  const payload = {
    membershipId: membership.id,
    amountCents: stripeInvoiceObject.amount_due,
  };

  await createNotification({
    customerId: membership.customerId,
    recipientRole: "ADMIN",
    eventType: "MEMBERSHIP_PAYMENT_FAILED",
    severity: "CRITICAL",
    payload,
  });
  await createNotification({
    customerId: membership.customerId,
    recipientRole: "CUSTOMER",
    eventType: "MEMBERSHIP_PAYMENT_FAILED",
    severity: "CRITICAL",
    payload,
  });
  revalidateAttentionPaths(membership.customerId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const membership = await prisma.membership.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!membership) {
    return;
  }

  const period = subscriptionPeriod(subscription);
  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      status: mapStripeSubscriptionStatus(subscription.status),
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : membership.canceledAt,
    },
  });
  revalidateAttentionPaths(membership.customerId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const membership = await prisma.membership.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!membership) {
    return;
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });
  revalidateAttentionPaths(membership.customerId);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const original = await prisma.payment.findFirst({
    where: { stripeChargeId: charge.id },
  });
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);

  const fallback = original
    ? null
    : paymentIntentId
      ? await prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentIntentId } })
      : null;

  const source = original ?? fallback;
  if (!source) {
    return;
  }

  const alreadyRefunded = await prisma.payment.findFirst({
    where: { refundOfPaymentId: source.id },
  });
  if (alreadyRefunded) {
    return;
  }

  await recordPayment({
    customerId: source.customerId,
    invoiceId: source.invoiceId,
    membershipId: source.membershipId,
    amountCents: -Math.abs(charge.amount_refunded),
    status: "REFUNDED",
    method: source.method,
    stripeChargeId: charge.id,
    refundOfPaymentId: source.id,
    paidAt: new Date(),
  });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
      return;
    case "invoice.payment_succeeded":
      await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
      return;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      return;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      return;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      return;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      return;
    default:
      return;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("[stripe webhook] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error(`[stripe webhook] failed to process ${event.type}`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  await prisma.stripeWebhookEvent
    .update({
      where: { stripeEventId: event.id },
      data: { processedAt: new Date() },
    })
    .catch(() => {});

  return NextResponse.json({ received: true });
}
