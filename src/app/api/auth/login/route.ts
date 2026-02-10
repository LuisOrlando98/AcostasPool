import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signSessionToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Credenciales inválidas." },
        { status: 400 }
      );
    }

    const email = result.data.email.trim().toLowerCase();
    const password = result.data.password;
    const remember = result.data.remember ?? false;
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
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

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(remember ? { maxAge: AUTH_COOKIE_MAX_AGE } : {}),
    });

    const locale = normalizeLocale(user.locale);
    response.cookies.set(LOCALE_COOKIE, locale, {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: AUTH_COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error:
          "Error interno al iniciar sesión. Verifica la base de datos y AUTH_SECRET.",
      },
      { status: 500 }
    );
  }
}
