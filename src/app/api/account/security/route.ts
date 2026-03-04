import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Payload = {
  email2faEnabled: boolean;
};

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload || typeof payload.email2faEnabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.notificationPreference.upsert({
    where: {
      userId_eventType: {
        userId: session.sub,
        eventType: "EMAIL_2FA",
      },
    },
    update: {
      enabled: payload.email2faEnabled,
    },
    create: {
      userId: session.sub,
      eventType: "EMAIL_2FA",
      enabled: payload.email2faEnabled,
    },
  });

  revalidatePath("/account");
  return NextResponse.json({
    ok: true,
    email2faEnabled: payload.email2faEnabled,
  });
}
