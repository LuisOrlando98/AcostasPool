import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createMembershipCheckoutSession } from "@/lib/payments/checkout";
import { toCents } from "@/lib/payments/service";

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
    select: { id: true, customerId: true, servicePrice: true },
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
      new URL("/client/invoices?membership=already-active", request.url),
      { status: 303 }
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  try {
    const url = await createMembershipCheckoutSession({
      customerId: customer.id,
      propertyId: property.id,
      amountCents: toCents(Number(property.servicePrice)),
      authorizedVia: "PORTAL",
      authorizedByUserId: session.sub,
      authorizedIp: forwardedFor ? forwardedFor.split(",")[0].trim() : null,
      authorizedUserAgent: request.headers.get("user-agent"),
    });
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("[client membership checkout]", error);
    return NextResponse.redirect(
      new URL("/client/invoices?membership=error", request.url),
      { status: 303 }
    );
  }
}
