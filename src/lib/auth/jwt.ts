import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/auth/config";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  /**
   * `true` para las cuentas de desarrollador. Permite que `src/proxy.ts`
   * (que solo lee el JWT, nunca la base de datos) deje pasar cualquier prefijo
   * protegido mientras la vista de desarrollador está activa. Es opcional:
   * los tokens emitidos antes de este campo siguen siendo válidos, pero su
   * titular debe volver a iniciar sesión una vez para obtener el claim.
   */
  dev?: boolean;
};

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
};

export async function signSessionToken(payload: SessionPayload) {
  const secret = getSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setSubject(payload.sub)
    .sign(secret);
}

export async function verifySessionToken(token: string) {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const role = payload.role;
    const dev = payload.dev;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      (role !== "ADMIN" && role !== "TECH" && role !== "CUSTOMER") ||
      (dev !== undefined && typeof dev !== "boolean")
    ) {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
