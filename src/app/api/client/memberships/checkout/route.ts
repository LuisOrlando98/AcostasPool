import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createMembershipCheckoutSession } from "@/lib/payments/checkout";
import { toCents } from "@/lib/payments/service";
import { getPublicAppUrl } from "@/lib/app-url";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const propertyId = new URL(request.url).searchParams.get("propertyId");
  if (!propertyId) {
    return NextResponse.json({ error: "Invalid property" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, customerId: true, servicePrice: true, paymentDay: true },
  });
  if (
    !customer ||
    !property ||
    property.customerId !== customer.id ||
    property.servicePrice === null
  ) {
    return NextResponse.json({ error: "Invalid property" }, { status: 400 });
  }

  const existingMembership = await prisma.membership.findFirst({
    where: {
      customerId: customer.id,
      propertyId: property.id,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
  });
  if (existingMembership) {
    return NextResponse.redirect(
      `${getPublicAppUrl()}/client/invoices?membership=already-active`,
      { status: 303 }
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  try {
    const url = await createMembershipCheckoutSession({
      customerId: customer.id,
      propertyId: property.id,
      baseAmountCents: toCents(Number(property.servicePrice)),
      paymentDay: property.paymentDay,
      authorizedVia: "PORTAL",
      authorizedByUserId: session.sub,
      authorizedIp: forwardedFor ? forwardedFor.split(",")[0].trim() : null,
      authorizedUserAgent: request.headers.get("user-agent"),
    });
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("[client membership checkout]", error);
    return NextResponse.redirect(`${getPublicAppUrl()}/client/invoices?membership=error`, {
      status: 303,
    });
  }
}
