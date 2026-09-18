import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Credentials } from "./constants";
import { SEED_CREDENTIALS } from "./constants";

/**
 * Cuenta de desarrollador para la suite de "vista de desarrollador".
 *
 * El correo debe estar en DEFAULT_DEVELOPER_EMAILS (src/lib/auth/developer.ts):
 * la lista es la que concede el acceso, no la marca `isDeveloper` por sí sola.
 */
export const DEVELOPER_EMAIL = "luiso.rodriguezcabrera@gmail.com";
export const DEVELOPER_CREDENTIALS: Credentials = {
  email: DEVELOPER_EMAIL,
  password: "DevView123!",
};
const DEVELOPER_FULL_NAME = "Dev E2E";
/** Mismo coste que scripts/seed.cjs y src/lib/auth/password.ts. */
const BCRYPT_ROUNDS = 12;

type DeveloperSnapshot = {
  passwordHash: string;
  fullName: string;
  role: "ADMIN" | "TECH" | "CUSTOMER";
  isDeveloper: boolean;
  isActive: boolean;
};

export type DeveloperFixture = {
  /** `true` cuando la suite creó la fila y por tanto debe borrarla al terminar. */
  readonly created: boolean;
  /** Estado previo de una cuenta ya existente, para restaurarla tal cual. */
  readonly previous: DeveloperSnapshot | null;
  readonly technicianUserId: string;
  readonly customerUserId: string;
};

const caseInsensitive = (email: string) => ({
  equals: email,
  mode: "insensitive" as const,
});

async function findSeedUserId(
  prisma: PrismaClient,
  email: string,
  label: string
): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { email: caseInsensitive(email) },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`Seed ${label} not found in DATABASE_URL: run \`npm run db:seed\` first`);
  }
  return user.id;
}

/**
 * Crea (o actualiza) la cuenta de desarrollador y devuelve lo necesario para
 * dejar la base de datos como estaba. Nunca borra una cuenta preexistente:
 * guarda su estado y `restoreDeveloperUser` lo repone.
 */
export async function ensureDeveloperUser(): Promise<DeveloperFixture> {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({
      where: { email: DEVELOPER_EMAIL },
      select: {
        passwordHash: true,
        fullName: true,
        role: true,
        isDeveloper: true,
        isActive: true,
      },
    });

    const passwordHash = await bcrypt.hash(DEVELOPER_CREDENTIALS.password, BCRYPT_ROUNDS);
    const data = {
      fullName: DEVELOPER_FULL_NAME,
      passwordHash,
      role: "ADMIN" as const,
      isDeveloper: true,
      isActive: true,
    };
    await prisma.user.upsert({
      where: { email: DEVELOPER_EMAIL },
      update: data,
      create: { email: DEVELOPER_EMAIL, ...data },
    });

    const [technicianUserId, customerUserId] = await Promise.all([
      findSeedUserId(prisma, SEED_CREDENTIALS.TECH.email, "technician"),
      findSeedUserId(prisma, SEED_CREDENTIALS.CUSTOMER.email, "customer"),
    ]);

    return {
      created: existing === null,
      previous: existing,
      technicianUserId,
      customerUserId,
    };
  } finally {
    await prisma.$disconnect();
  }
}

/** Borra la cuenta creada por la suite (y su auditoría) o restaura la original. */
export async function restoreDeveloperUser(fixture: DeveloperFixture): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email: DEVELOPER_EMAIL },
      select: { id: true },
    });
    if (!user) {
      return;
    }
    // AuditLog.userId es SetNull, así que las filas del cambio de vista
    // sobrevivirían al borrado: se eliminan explícitamente.
    await prisma.auditLog.deleteMany({ where: { userId: user.id } });
    if (fixture.created) {
      await prisma.user.delete({ where: { id: user.id } });
      return;
    }
    if (fixture.previous) {
      await prisma.user.update({ where: { id: user.id }, data: fixture.previous });
    }
  } finally {
    await prisma.$disconnect();
  }
}
