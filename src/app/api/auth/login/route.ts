import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signSessionToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { normalizeEmail } from "@/lib/auth/email";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipWindow = await checkRateLimit({
      key: `auth:login:ip:${ip}`,
      limit: 15,
      windowMs: 60_000,
    });
    if (!ipWindow.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(ipWindow.retryAfterSeconds) },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Credenciales invalidas." },
        { status: 400 }
      );
    }

    const email = normalizeEmail(result.data.email);
    const accountWindow = await checkRateLimit({
      key: `auth:login:email:${email}`,
      limit: 8,
      windowMs: 5 * 60_000,
    });
    if (!accountWindow.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(accountWindow.retryAfterSeconds) },
        }
      );
    }

    const password = result.data.password;
    const remember = result.data.remember ?? false;
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Usuario o contrasena incorrectos." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Usuario o contrasena incorrectos." },
        { status: 401 }
      );
    }

    const token = await signSessionToken({
      sub: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    });

    const response = NextResponse.json({
      ok: true,
      role: user.role,
      name: user.fullName,
    });
    response.headers.set("Cache-Control", "no-store");

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      priority: "high",
      path: "/",
      ...(remember ? { maxAge: AUTH_COOKIE_MAX_AGE } : {}),
    });

    const locale = normalizeLocale(user.locale);
    response.cookies.set(LOCALE_COOKIE, locale, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      priority: "medium",
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error:
          "Error interno al iniciar sesion. Verifica la base de datos y AUTH_SECRET.",
      },
      { status: 500 }
    );
  }
}
