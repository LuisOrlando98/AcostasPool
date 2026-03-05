import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { buildTechRecipientWhere } from "@/lib/notifications/tech";

export async function GET() {
  const json = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  const session = await getSession();
  if (!session) {
    return json({ unread: 0 });
  }

  if (session.role === "ADMIN") {
    const { allowed, disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const filtered = allowed.filter((eventType) => !disabled.has(eventType));
    if (filtered.length === 0) {
      return json({ unread: 0 });
    }
    const unread = await prisma.notification.count({
      where: {
        readAt: null,
        eventType: { in: filtered },
        recipientRole: "ADMIN",
        OR: [{ actorUserId: null }, { actorUserId: { not: session.sub } }],
      },
    });
    return json({ unread });
  }

  if (session.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
    });
    if (!customer) {
      return json({ unread: 0 });
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
    return json({ unread });
  }

  if (session.role === "TECH") {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const unread = await prisma.notification.count({
      where: {
        recipientRole: "TECH",
        AND: buildTechRecipientWhere(session.sub),
        readAt: null,
        createdAt: { gte: since },
        ...(disabled.size > 0 ? { eventType: { notIn: [...disabled] } } : {}),
      },
    });
    return json({ unread });
  }

  return json({ unread: 0 });
}
