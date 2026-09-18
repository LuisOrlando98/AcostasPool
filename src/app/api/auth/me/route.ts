import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { headers });
  }
  return NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      name: session.name,
      role: session.role,
      avatarUrl: session.avatarUrl ?? null,
      isDeveloper: session.isDeveloper === true,
      // Vista de desarrollador activa (o null): la usa el conmutador de la
      // cabecera, que se alimenta de esta misma llamada desde `AppShell`.
      devView: session.devView ? { role: session.devView.role } : null,
    },
  }, { headers });
}
