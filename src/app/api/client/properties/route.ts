import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: { properties: true },
  });

  if (!customer) {
    return NextResponse.json({ properties: [] });
  }

  return NextResponse.json({ properties: customer.properties });
}
