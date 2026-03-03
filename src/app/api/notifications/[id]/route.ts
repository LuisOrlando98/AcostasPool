import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { isTechNotificationForUser } from "@/lib/notifications/tech";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: notificationId } = await context.params;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    return NextResponse.json({ ok: true });
  }

  if (notification.recipientRole && session.role !== notification.recipientRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    if (session.role === "TECH") {
      if (!isTechNotificationForUser(notification.payload, session.sub)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      const customer = await prisma.customer.findUnique({
        where: { userId: session.sub },
      });
      if (!customer || customer.id !== notification.customerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return NextResponse.json({ ok: true });
}

