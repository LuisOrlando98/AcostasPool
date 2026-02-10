/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function upsertUser({ email, password, fullName, role }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      fullName,
      role,
      locale: "ES",
      isActive: true,
    },
    update: {
      fullName,
      role,
      passwordHash,
      isActive: true,
    },
  });
  return user;
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@acostaspool.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const techEmail = process.env.SEED_TECH_EMAIL || "tech@acostaspool.local";
  const techPassword = process.env.SEED_TECH_PASSWORD || "Tech123!";
  const customerEmail =
    process.env.SEED_CUSTOMER_EMAIL || "cliente@acostaspool.local";
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
