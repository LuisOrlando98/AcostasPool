import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { verifySessionToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db";
import { isDeveloperAccount, isDeveloperEmail } from "@/lib/auth/developer";

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!cookie) {
    return null;
  }
  const tokenPayload = await verifySessionToken(cookie);
  if (!tokenPayload?.sub) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenPayload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      avatarUrl: true,
      isActive: true,
      isDeveloper: true,
    },
  });
  if (!user || !user.isActive) {
    return null;
  }
  const developerAccess = isDeveloperAccount(user) || isDeveloperEmail(user.email);

  return {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: developerAccess ? "ADMIN" : user.role,
    avatarUrl: user.avatarUrl,
    isDeveloper: developerAccess,
  };
}
