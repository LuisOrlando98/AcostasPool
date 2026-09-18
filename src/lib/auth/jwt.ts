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
   * los tokens emitidos antes de este campo siguen siendo válidos y
   * `POST /api/developer/view` los vuelve a firmar con el claim.
   */
  dev?: boolean;
};

/** Payload verificado: incluye los claims estándar que emite `SignJWT`. */
export type VerifiedSessionPayload = SessionPayload & {
  /** Caducidad en segundos desde epoch. */
  readonly exp?: number;
};

/** Caducidad estándar de un token de sesión. */
export const SESSION_TOKEN_EXPIRATION = "7d";

export type SignSessionTokenOptions = {
  /**
   * Caducidad absoluta en segundos desde epoch. Se usa para volver a firmar un
   * token sin alargar su vida (por ejemplo al añadir el claim `dev`); si falta
   * se aplica `SESSION_TOKEN_EXPIRATION`.
   */
  readonly expiresAt?: number;
};

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
};

export async function signSessionToken(
  payload: SessionPayload,
  options: SignSessionTokenOptions = {}
) {
  const secret = getSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? SESSION_TOKEN_EXPIRATION)
    .setSubject(payload.sub)
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<VerifiedSessionPayload | null> {
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
    return payload as VerifiedSessionPayload;
  } catch {
    return null;
  }
}
