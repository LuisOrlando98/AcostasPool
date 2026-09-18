import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signSessionToken } from "@/lib/auth/jwt";
import type { Credentials } from "./constants";

/**
 * Cuenta de desarrollador para la suite de "vista de desarrollador".
 *
 * El correo debe estar en DEFAULT_DEVELOPER_EMAILS (src/lib/auth/developer.ts):
 * la lista es la que concede el acceso, no la marca `isDeveloper` por sí sola.
 *
 * La vista de desarrollador ya no usa credenciales ajenas: las filas
 * `Technician` / `Customer` / `Property` que crea el cambio de vista pertenecen
 * a esta misma cuenta, así que la limpieza final las borra todas.
 */
export const DEVELOPER_EMAIL = "luiso.rodriguezcabrera@gmail.com";
export const DEVELOPER_CREDENTIALS: Credentials = {
  email: DEVELOPER_EMAIL,
  password: "DevView123!",
};
const DEVELOPER_FULL_NAME = "Dev E2E";
/** Mismo coste que scripts/seed.cjs y src/lib/auth/password.ts. */
const BCRYPT_ROUNDS = 12;
/** Acción de AuditLog que escribe POST /api/developer/view. */
const DEV_VIEW_AUDIT_ACTION = "DEV_VIEW_SWITCH";

/** Textos de las filas de pruebas (src/lib/auth/dev-view-records.ts). */
export const DEV_TEST_PROPERTY_NAME = "Propiedad de pruebas";
export const DEV_TEST_PROPERTY_ADDRESS = "123 Test St, Miami, FL";

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
  readonly userId: string;
};

/**
 * Crea (o actualiza) la cuenta de desarrollador y devuelve lo necesario para
 * dejar la base de datos como estaba. Nunca borra una cuenta preexistente:
 * guarda su estado y `cleanupDeveloperUser` lo repone.
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
    const user = await prisma.user.upsert({
      where: { email: DEVELOPER_EMAIL },
      update: data,
      create: { email: DEVELOPER_EMAIL, ...data },
      select: { id: true },
    });

    return { created: existing === null, previous: existing, userId: user.id };
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Borra las filas de pruebas creadas por los cambios de vista (propiedad,
 * cliente, técnico y auditoría) y, si la suite creó la cuenta, también el
 * usuario; si ya existía, repone su estado anterior.
 */
export async function cleanupDeveloperUser(fixture: DeveloperFixture): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const customer = await prisma.customer.findUnique({
      where: { userId: fixture.userId },
      select: { id: true },
    });
    if (customer) {
      await prisma.property.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
    }
    await prisma.technician.deleteMany({ where: { userId: fixture.userId } });
    await prisma.auditLog.deleteMany({
      where: { userId: fixture.userId, action: DEV_VIEW_AUDIT_ACTION },
    });

    if (fixture.created) {
      // AuditLog.userId es SetNull, así que el resto de filas de auditoría
      // sobrevivirían al borrado del usuario: se eliminan explícitamente.
      await prisma.auditLog.deleteMany({ where: { userId: fixture.userId } });
      await prisma.user.delete({ where: { id: fixture.userId } });
      return;
    }
    if (fixture.previous) {
      await prisma.user.update({
        where: { id: fixture.userId },
        data: fixture.previous,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Token de sesión SIN el claim `dev`, como los que emitía el login antes de que
 * existiera. Sirve para comprobar que el cambio de vista funciona igualmente
 * porque `POST /api/developer/view` vuelve a firmar la cookie.
 */
export async function signLegacySessionToken(userId: string): Promise<string> {
  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required to sign the legacy session token");
  }
  return signSessionToken({
    sub: userId,
    email: DEVELOPER_EMAIL,
    name: DEVELOPER_FULL_NAME,
    role: "ADMIN",
  });
}
