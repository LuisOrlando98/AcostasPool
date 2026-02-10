import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { ROLE_NOTIFICATION_TYPES } from "@/lib/notifications/constants";
import { getPreferenceList } from "@/lib/notifications/preferences";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ preferences: [] });
  }

  const preferences = await getPreferenceList(session.sub, session.role);
  return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventType = typeof body?.eventType === "string" ? body.eventType : "";
  const enabled = Boolean(body?.enabled);
  const allowed = ROLE_NOTIFICATION_TYPES[session.role] ?? [];

  if (!eventType || !allowed.includes(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  await prisma.notificationPreference.upsert({
    where: { userId_eventType: { userId: session.sub, eventType } },
    update: { enabled },
    create: { userId: session.sub, eventType, enabled },
  });

  return NextResponse.json({ ok: true });
}
