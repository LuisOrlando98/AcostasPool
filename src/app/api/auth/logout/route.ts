import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/config";
import { DEV_VIEW_COOKIE_NAME, DEV_VIEW_COOKIE_OPTIONS } from "@/lib/auth/dev-view";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    priority: "high",
    maxAge: 0,
    path: "/",
  });
  // La vista de desarrollador no debe sobrevivir al cierre de sesion: sin esto
  // el desarrollador reaparecería dentro de la vista emulada al volver a entrar.
  response.cookies.set(DEV_VIEW_COOKIE_NAME, "", {
    ...DEV_VIEW_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}
