import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { normalizePropertyAddress } from "@/lib/routing/address";

const normalizeOptional = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseVolume = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed);
};

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    include: {
      properties: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ properties: [] });
  }

  return NextResponse.json({ properties: customer.properties });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const address =
    typeof body.address === "string" ? body.address.trim() : "";
  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }
  const normalizedAddress = await normalizePropertyAddress(address);

  const property = await prisma.property.create({
    data: {
      customerId: customer.id,
      name: normalizeOptional(body.name),
      address: normalizedAddress,
      poolType: normalizeOptional(body.poolType),
      waterType: normalizeOptional(body.waterType),
      sanitizerType: normalizeOptional(body.sanitizerType),
      filterType: normalizeOptional(body.filterType),
      poolVolumeGallons: parseVolume(body.poolVolumeGallons),
      hasSpa: Boolean(body.hasSpa),
      accessInfo: normalizeOptional(body.accessInfo),
      locationNotes: normalizeOptional(body.locationNotes),
    },
  });

  revalidatePath("/client/properties");
  return NextResponse.json({ property });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const propertyId =
    typeof body.propertyId === "string" ? body.propertyId.trim() : "";
  const address =
    typeof body.address === "string" ? body.address.trim() : "";

  if (!propertyId || !address) {
    return NextResponse.json(
      { error: "propertyId and address are required" },
      { status: 400 }
    );
  }
  const normalizedAddress = await normalizePropertyAddress(address);

  const existing = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, customerId: true },
  });

  if (!existing || existing.customerId !== customer.id) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const property = await prisma.property.update({
    where: { id: existing.id },
    data: {
      name: normalizeOptional(body.name),
      address: normalizedAddress,
      poolType: normalizeOptional(body.poolType),
      waterType: normalizeOptional(body.waterType),
      sanitizerType: normalizeOptional(body.sanitizerType),
      filterType: normalizeOptional(body.filterType),
      poolVolumeGallons: parseVolume(body.poolVolumeGallons),
      hasSpa: Boolean(body.hasSpa),
      accessInfo: normalizeOptional(body.accessInfo),
      locationNotes: normalizeOptional(body.locationNotes),
    },
  });

  revalidatePath("/client/properties");
  return NextResponse.json({ property });
}
