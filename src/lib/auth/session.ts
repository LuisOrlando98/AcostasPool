import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/jwt";

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!cookie) {
    return null;
  }
  return verifySessionToken(cookie);
}
