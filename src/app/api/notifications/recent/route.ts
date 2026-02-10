import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { formatCustomerName } from "@/lib/customers/format";
import { getNotificationPreferences } from "@/lib/notifications/preferences";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ notifications: [] });
  }

  if (session.role === "ADMIN") {
    const { allowed, disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const filtered = allowed.filter((eventType) => !disabled.has(eventType));
    if (filtered.length === 0) {
      return NextResponse.json({ notifications: [] });
    }
    const notifications = await prisma.notification.findMany({
      where: {
        eventType: { in: filtered },
        recipientRole: "ADMIN",
        OR: [{ actorUserId: null }, { actorUserId: { not: session.sub } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { customer: true },
    });
    return NextResponse.json({
      notifications: notifications.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
        severity: item.severity,
        actorUserId: item.actorUserId,
        payload: item.payload ?? null,
        customerName: item.customer ? formatCustomerName(item.customer) : null,
        link: getNotificationLink(item.eventType, item.payload, session.role),
      })),
    });
  }

  if (session.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
    });
    if (!customer) {
      return NextResponse.json({ notifications: [] });
    }
    const { disabled } = await getNotificationPreferences(
      session.sub,
      session.role
    );
    const notifications = await prisma.notification.findMany({
      where: {
        customerId: customer.id,
        recipientRole: "CUSTOMER",
        ...(disabled.size > 0 ? { eventType: { notIn: [...disabled] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json({
      notifications: notifications.map((item) => ({
        id: item.id,
        eventType: item.eventType,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        readAt: item.readAt ? item.readAt.toISOString() : null,
        severity: item.severity,
        actorUserId: item.actorUserId,
        payload: item.payload ?? null,
        customerName: null,
        link: getNotificationLink(item.eventType, item.payload, session.role),
      })),
    });
  }

  return NextResponse.json({ notifications: [] });
}

function getNotificationLink(
  eventType: string,
  payload: unknown,
  role: string
) {
  const data =
    typeof payload === "object" && payload ? (payload as Record<string, unknown>) : {};
  const jobId = typeof data.jobId === "string" ? data.jobId : null;
  const invoiceId = typeof data.invoiceId === "string" ? data.invoiceId : null;

  if (jobId && role === "ADMIN") {
    return `/admin/routes?highlight=${jobId}`;
  }
  if (jobId && role === "CUSTOMER") {
    return `/client/jobs/${jobId}`;
  }
  if (invoiceId && role === "ADMIN") {
    return `/admin/invoices?highlight=${invoiceId}`;
  }
  if (eventType === "INVOICE_SENT" && role === "CUSTOMER") {
    return "/client/invoices";
  }
  return "/admin/notifications";
}
