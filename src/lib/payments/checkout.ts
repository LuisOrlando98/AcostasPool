import { getStripeClient } from "@/lib/stripe/client";
import { prisma } from "@/lib/db";
import { toCents } from "@/lib/payments/service";
import { computeMembershipFeeCents, MEMBERSHIP_TRANSACTION_FEE_PERCENT } from "@/lib/payments/fees";
import { getPublicAppUrl } from "@/lib/app-url";

function baseAppUrl() {
  return getPublicAppUrl();
}

async function ensureStripeCustomerId(customer: {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  stripeCustomerId: string | null;
}) {
  if (customer.stripeCustomerId) {
    return customer.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const created = await stripe.customers.create({
    email: customer.email,
    name: `${customer.nombre} ${customer.apellidos}`.trim(),
    metadata: { customerId: customer.id },
  });

  await prisma.customer.update({
    where: { id: customer.id },
    data: { stripeCustomerId: created.id },
  });

  return created.id;
}

export async function createInvoiceCheckoutSession(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true },
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  if (invoice.status === "PAID") {
    throw new Error("Invoice already paid");
  }

  const stripeCustomerId = await ensureStripeCustomerId(invoice.customer);
  const stripe = getStripeClient();
  const appUrl = baseAppUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: toCents(Number(invoice.total)),
          product_data: { name: `AcostasPool - Invoice ${invoice.number}` },
        },
        quantity: 1,
      },
    ],
    metadata: { invoiceId },
    success_url: `${appUrl}/client/invoices?payment=success`,
    cancel_url: `${appUrl}/client/invoices?payment=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { stripeCheckoutSessionId: session.id },
  });

  return session.url;
}

type MembershipCheckoutInput = {
  customerId: string;
  propertyId: string;
  baseAmountCents: number;
  authorizedVia: "PORTAL" | "IN_PERSON_ADMIN";
  authorizedByUserId?: string | null;
  authorizedIp?: string | null;
  authorizedUserAgent?: string | null;
};

export async function createMembershipCheckoutSession(
  input: MembershipCheckoutInput
) {
  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId },
  });
  if (!customer) {
    throw new Error("Customer not found");
  }

  const stripeCustomerId = await ensureStripeCustomerId(customer);
  const stripe = getStripeClient();
  const appUrl = baseAppUrl();
  const { baseCents, feeCents } = computeMembershipFeeCents(input.baseAmountCents);

  const metadata: Record<string, string> = {
    customerId: input.customerId,
    propertyId: input.propertyId,
    authorizedVia: input.authorizedVia,
    authorizedByUserId: input.authorizedByUserId ?? "",
    authorizedIp: input.authorizedIp ?? "",
    authorizedUserAgent: input.authorizedUserAgent ?? "",
    baseAmountCents: String(baseCents),
    feeAmountCents: String(feeCents),
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: baseCents,
          recurring: { interval: "month" },
          product_data: { name: "AcostasPool - Monthly membership" },
        },
        quantity: 1,
      },
      {
        price_data: {
          currency: "usd",
          unit_amount: feeCents,
          recurring: { interval: "month" },
          product_data: {
            name: `Payment processing fee (${MEMBERSHIP_TRANSACTION_FEE_PERCENT}%)`,
          },
        },
        quantity: 1,
      },
    ],
    metadata,
    subscription_data: { metadata },
    success_url: `${appUrl}/client/invoices?membership=success`,
    cancel_url: `${appUrl}/client/membership/activate?propertyId=${input.propertyId}&membership=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return session.url;
}
