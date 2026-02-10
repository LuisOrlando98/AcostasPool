import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
  });

  if (!notification) {
    return NextResponse.json({ ok: true });
  }

  if (notification.recipientRole && session.role !== notification.recipientRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    const customer = await prisma.customer.findUnique({
      where: { userId: session.sub },
    });
    if (!customer || customer.id !== notification.customerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await prisma.notification.update({
    where: { id: params.id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
