import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/auth/config";

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
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
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.role !== "string") {
      return null;
    }
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
