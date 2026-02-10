import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { subscribe } from "@/lib/notifications/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let customerId: string | null = null;
  if (session.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
      select: { id: true },
    });
    customerId = customer?.id ?? null;
  }

  const { allowed, disabled } = await getNotificationPreferences(
    session.sub,
    session.role
  );
  const filtered = allowed.filter((eventType) => !disabled.has(eventType));
  const allowedSet = new Set(filtered);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("ready", { ok: true });

      unsubscribe = subscribe({
        id: crypto.randomUUID(),
        role: session.role,
        userId: session.sub,
        customerId,
        allowedEventTypes: allowedSet,
        send: (payload) => send("notification", payload),
      });

      heartbeat = setInterval(() => {
        send("ping", Date.now());
      }, 25000);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
      }
      if (heartbeat) {
        clearInterval(heartbeat);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
