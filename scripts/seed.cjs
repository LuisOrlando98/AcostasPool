/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

/**
 * Demo accounts for `npm run db:seed`.
 *
 * Passwords come from the SEED_*_PASSWORD variables (what CI and the local
 * .env define, so a configured environment behaves exactly as before). When one
 * is missing the script generates a random password and prints it once instead
 * of falling back to a shared, published default; with NODE_ENV=production it
 * refuses to run at all rather than creating a guessable account.
 */
const PRODUCTION_NODE_ENV = "production";
const GENERATED_PASSWORD_BYTES = 24;
/** Appended so a generated password also satisfies upper/lower/digit/symbol policies. */
const GENERATED_PASSWORD_SUFFIX = "aA1!";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function generateStrongPassword() {
  const random = crypto.randomBytes(GENERATED_PASSWORD_BYTES).toString("base64url");
  return `${random}${GENERATED_PASSWORD_SUFFIX}`;
}

/**
 * Resolves the three demo credentials. Returns the passwords plus the list of
 * accounts whose password was generated, so `main` can print them once.
 */
function resolveSeedAccounts(env) {
  const definitions = [
    {
      label: "Admin",
      emailVariable: "SEED_ADMIN_EMAIL",
      passwordVariable: "SEED_ADMIN_PASSWORD",
      defaultEmail: "admin@acostaspool.com",
    },
    {
      label: "Tech",
      emailVariable: "SEED_TECH_EMAIL",
      passwordVariable: "SEED_TECH_PASSWORD",
      defaultEmail: "tech@acostaspool.com",
    },
    {
      label: "Customer",
      emailVariable: "SEED_CUSTOMER_EMAIL",
      passwordVariable: "SEED_CUSTOMER_PASSWORD",
      defaultEmail: "cliente@acostaspool.com",
    },
  ];

  const missing = definitions
    .filter((definition) => !env[definition.passwordVariable])
    .map((definition) => definition.passwordVariable);

  if (missing.length > 0 && env.NODE_ENV === PRODUCTION_NODE_ENV) {
    throw new Error(
      `Refusing to seed with generated credentials in production. Set ${missing.join(", ")} (and the matching SEED_*_EMAIL) before running npm run db:seed.`
    );
  }

  return definitions.map((definition) => {
    const configuredPassword = env[definition.passwordVariable];
    return {
      label: definition.label,
      email: normalizeEmail(env[definition.emailVariable] || definition.defaultEmail),
      password: configuredPassword || generateStrongPassword(),
      generated: !configuredPassword,
    };
  });
}

/** Prints generated passwords once: they are not stored anywhere else. */
function printGeneratedPasswords(accounts) {
  const generated = accounts.filter((account) => account.generated);
  if (generated.length === 0) {
    return;
  }
  console.log("");
  console.log("Generated demo passwords (shown once, not recoverable):");
  for (const account of generated) {
    console.log(`  ${account.label}: ${account.email} / ${account.password}`);
  }
  console.log("Set the matching SEED_*_PASSWORD variables to keep them stable.");
  console.log("");
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
  const [adminAccount, techAccount, customerAccount] = resolveSeedAccounts(
    process.env
  );
  const adminEmail = adminAccount.email;
  const techEmail = techAccount.email;
  const customerEmail = customerAccount.email;

  const admin = await upsertUser({
    email: adminEmail,
    password: adminAccount.password,
    fullName: "Administrador Principal",
    role: "ADMIN",
  });

  const techUser = await upsertUser({
    email: techEmail,
    password: techAccount.password,
    fullName: "Tecnico Demo",
    role: "TECH",
  });

  const customerUser = await upsertUser({
    email: customerEmail,
    password: customerAccount.password,
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
  console.log(`Admin: ${admin.email}`);
  console.log(`Tech: ${techUser.email}`);
  console.log(`Customer: ${customerUser.email}`);
  console.log(`Admin user id: ${admin.id}`);
  console.log(`Customer id: ${customer.id}`);
  printGeneratedPasswords([adminAccount, techAccount, customerAccount]);
}

main()
  .catch((error) => {
    console.error("Seed error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
