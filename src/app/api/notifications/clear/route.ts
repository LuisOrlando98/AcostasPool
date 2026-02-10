import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/notifications/preferences";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    const { allowed, disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const filtered = allowed.filter((eventType) => !disabled.has(eventType));
    if (filtered.length === 0) {
      return NextResponse.json({ ok: true, count: 0 });
    }
    const result = await prisma.notification.updateMany({
      where: {
        readAt: null,
        eventType: { in: filtered },
        recipientRole: "ADMIN",
        OR: [{ actorUserId: null }, { actorUserId: { not: session.sub } }],
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  if (session.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
    });
    if (!customer) {
      return NextResponse.json({ ok: true, count: 0 });
    }
    const { disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const result = await prisma.notification.updateMany({
      where: {
        customerId: customer.id,
        recipientRole: "CUSTOMER",
        readAt: null,
        ...(disabled.size > 0 ? { eventType: { notIn: [...disabled] } } : {}),
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, count: result.count });
  }

  return NextResponse.json({ ok: true, count: 0 });
}
