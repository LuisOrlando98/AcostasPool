import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { ensureServiceTiers, normalizeChecklist } from "@/lib/service-tiers";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureServiceTiers();
  const tiers = await prisma.serviceTier.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tiers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const checklist = normalizeChecklist(body?.checklist);
  const isActive =
    typeof body?.isActive === "boolean" ? body.isActive : true;

  const tier = await prisma.serviceTier.create({
    data: {
      name,
      checklist,
      isActive,
    },
  });

  return NextResponse.json({ tier }, { status: 201 });
}
