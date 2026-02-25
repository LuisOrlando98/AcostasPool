/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function upsertUser({ email, password, fullName, role }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        fullName,
        role,
        passwordHash,
        isActive: true,
      },
    });
  }
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      role,
      locale: "ES",
      isActive: true,
    },
  });
}

async function main() {
  const adminEmail = normalizeEmail(
    process.env.SEED_ADMIN_EMAIL || "admin@acostaspool.com"
  );
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const techEmail = normalizeEmail(
    process.env.SEED_TECH_EMAIL || "tech@acostaspool.com"
  );
  const techPassword = process.env.SEED_TECH_PASSWORD || "Tech123!";
  const customerEmail = normalizeEmail(
    process.env.SEED_CUSTOMER_EMAIL || "cliente@acostaspool.com"
  );
  const customerPassword =
    process.env.SEED_CUSTOMER_PASSWORD || "Client123!";

  const admin = await upsertUser({
    email: adminEmail,
    password: adminPassword,
    fullName: "Administrador Principal",
    role: "ADMIN",
  });

  const techUser = await upsertUser({
    email: techEmail,
    password: techPassword,
    fullName: "Tecnico Demo",
    role: "TECH",
  });

  const customerUser = await upsertUser({
    email: customerEmail,
    password: customerPassword,
    fullName: "Cliente Demo",
    role: "CUSTOMER",
  });

  const technician = await prisma.technician.upsert({
    where: { userId: techUser.id },
    create: {
      userId: techUser.id,
      phone: "+1 000-000-0000",
    },
    update: {},
  });

  const customer = await prisma.customer.upsert({
    where: { userId: customerUser.id },
    create: {
      userId: customerUser.id,
      nombre: "Cliente",
      apellidos: "Demo",
      email: customerEmail,
      telefono: "+1 000-000-0000",
      idiomaPreferencia: "ES",
      estadoCuenta: "ACTIVE",
      tipoCliente: "RESIDENTIAL",
      direccionLinea1: "100 Ocean Drive",
      ciudad: "Miami",
      estadoProvincia: "FL",
      codigoPostal: "33139",
    },
    update: {},
  });

  let property = await prisma.property.findFirst({
    where: { customerId: customer.id, address: "100 Ocean Drive" },
  });

  if (!property) {
    property = await prisma.property.create({
      data: {
        customerId: customer.id,
        address: "100 Ocean Drive",
        poolType: "Residencial",
        waterType: "Cloro",
        poolVolumeGallons: 12000,
        hasSpa: false,
      },
    });
  }

  const today = new Date();
  today.setHours(9, 0, 0, 0);

  const existingJob = await prisma.job.findFirst({
    where: {
      customerId: customer.id,
      propertyId: property.id,
      scheduledDate: today,
    },
  });

  if (!existingJob) {
    await prisma.job.create({
      data: {
        customerId: customer.id,
        propertyId: property.id,
        technicianId: technician.id,
        scheduledDate: today,
        status: "PENDING",
        type: "ROUTINE",
      },
    });
  }

  console.log("Seed completed:");
  console.log(`Admin: ${admin.email} / ${adminPassword}`);
  console.log(`Tech: ${techUser.email} / ${techPassword}`);
  console.log(`Customer: ${customerUser.email} / ${customerPassword}`);
  console.log(`Admin user id: ${admin.id}`);
  console.log(`Customer id: ${customer.id}`);
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
