import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normalizeChecklist } from "@/lib/service-tiers";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = name;
  }

  if (typeof body?.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  if (body?.checklist !== undefined) {
    data.checklist = normalizeChecklist(body.checklist);
  }

  const tier = await prisma.serviceTier.update({
    where: { id },
    data,
  });

  return NextResponse.json({ tier });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const usage = await Promise.all([
    prisma.job.count({ where: { serviceTierId: id } }),
    prisma.servicePlan.count({ where: { serviceTierId: id } }),
  ]);
  const inUse = usage.reduce((sum, count) => sum + count, 0);

  if (inUse > 0) {
    const tier = await prisma.serviceTier.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ tier, archived: true });
  }

  await prisma.serviceTier.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
