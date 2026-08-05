import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createMembershipCheckoutSession } from "@/lib/payments/checkout";
import { toCents } from "@/lib/payments/service";
import { getPublicAppUrl } from "@/lib/app-url";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const propertyId = url.searchParams.get("propertyId");
  if (!customerId || !propertyId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, customerId: true, servicePrice: true },
  });
  if (!property || property.customerId !== customerId || property.servicePrice === null) {
    return NextResponse.json({ error: "Invalid property" }, { status: 400 });
  }

  const existingMembership = await prisma.membership.findFirst({
    where: {
      customerId,
      propertyId: property.id,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
  });
  if (existingMembership) {
    return NextResponse.redirect(
      `${getPublicAppUrl()}/admin/customers/${customerId}?membership=already-active`,
      { status: 303 }
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  try {
    const checkoutUrl = await createMembershipCheckoutSession({
      customerId,
      propertyId: property.id,
      baseAmountCents: toCents(Number(property.servicePrice)),
      authorizedVia: "IN_PERSON_ADMIN",
      authorizedByUserId: session.sub,
      authorizedIp: forwardedFor ? forwardedFor.split(",")[0].trim() : null,
      authorizedUserAgent: request.headers.get("user-agent"),
    });
    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error) {
    console.error("[admin membership checkout]", error);
    return NextResponse.redirect(
      `${getPublicAppUrl()}/admin/customers/${customerId}?membership=error`,
      { status: 303 }
    );
  }
}
