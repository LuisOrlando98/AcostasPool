import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/notifications/preferences";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ unread: 0 });
  }

  if (session.role === "ADMIN") {
    const { allowed, disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const filtered = allowed.filter((eventType) => !disabled.has(eventType));
    if (filtered.length === 0) {
      return NextResponse.json({ unread: 0 });
    }
    const unread = await prisma.notification.count({
      where: {
        readAt: null,
        eventType: { in: filtered },
        recipientRole: "ADMIN",
        OR: [{ actorUserId: null }, { actorUserId: { not: session.sub } }],
      },
    });
    return NextResponse.json({ unread });
  }

  if (session.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
    });
    if (!customer) {
      return NextResponse.json({ unread: 0 });
    }
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const unread = await prisma.notification.count({
      where: {
        customerId: customer.id,
        recipientRole: "CUSTOMER",
        readAt: null,
        createdAt: { gte: since },
        ...(disabled.size > 0 ? { eventType: { notIn: [...disabled] } } : {}),
      },
    });
    return NextResponse.json({ unread });
  }

  return NextResponse.json({ unread: 0 });
}
