import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import { normalizeUsPhone } from "@/lib/phones";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";

type Payload =
  | {
      kind: "personal";
      nombre: string;
      apellidos: string;
      email: string;
      telefono: string;
      telefonoSecundario?: string;
      idiomaPreferencia: "EN" | "ES";
    }
  | {
      kind: "address";
      direccionLinea1?: string;
      direccionLinea2?: string;
      ciudad?: string;
      estadoProvincia?: string;
      codigoPostal?: string;
    }
  | {
      kind: "security";
      email2faEnabled: boolean;
    };

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({
    where: { userId: session.sub },
    select: { id: true, userId: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as Payload | null;
  if (!payload || typeof payload !== "object" || !("kind" in payload)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload.kind === "personal") {
    const nombre = String(payload.nombre ?? "").trim();
    const apellidos = String(payload.apellidos ?? "").trim();
    const email = normalizeEmail(String(payload.email ?? ""));
    const telefonoRaw = String(payload.telefono ?? "").trim();
    const telefonoSecundarioRaw = String(payload.telefonoSecundario ?? "").trim();
    const idiomaPreferencia = payload.idiomaPreferencia === "ES" ? "ES" : "EN";

    const telefono = normalizeUsPhone(telefonoRaw);
    const telefonoSecundario = telefonoSecundarioRaw
      ? normalizeUsPhone(telefonoSecundarioRaw)
      : null;

    if (!nombre || !apellidos || !email || !telefono) {
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });
    }
    if (telefonoSecundarioRaw && !telefonoSecundario) {
      return NextResponse.json({ error: "Invalid secondary phone" }, { status: 400 });
    }

    if (customer.userId) {
      const duplicate = await prisma.user.findFirst({
        where: {
          id: { not: customer.userId },
          email: { equals: email, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        nombre,
        apellidos,
        email,
        telefono,
        telefonoSecundario,
        idiomaPreferencia,
      },
    });

    if (customer.userId) {
      await prisma.user.update({
        where: { id: customer.userId },
        data: {
          fullName: `${nombre} ${apellidos}`.trim(),
          email,
          locale: idiomaPreferencia,
        },
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(LOCALE_COOKIE, normalizeLocale(idiomaPreferencia), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    revalidatePath("/client/profile");
    revalidatePath("/client");
    return response;
  }

  if (payload.kind === "address") {
    const direccionLinea1 = String(payload.direccionLinea1 ?? "").trim();
    const direccionLinea2 = String(payload.direccionLinea2 ?? "").trim();
    const ciudad = String(payload.ciudad ?? "").trim();
    const estadoProvincia = String(payload.estadoProvincia ?? "").trim();
    const codigoPostal = String(payload.codigoPostal ?? "").trim();

    const hasAddress = direccionLinea1 || ciudad || estadoProvincia || codigoPostal;
    if (hasAddress && (!direccionLinea1 || !ciudad || !estadoProvincia || !codigoPostal)) {
      return NextResponse.json({ error: "Complete required address fields" }, { status: 400 });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        direccionLinea1: direccionLinea1 || null,
        direccionLinea2: direccionLinea2 || null,
        ciudad: ciudad || null,
        estadoProvincia: estadoProvincia || null,
        codigoPostal: codigoPostal || null,
      },
    });

    revalidatePath("/client/profile");
    return NextResponse.json({ ok: true });
  }

  if (!customer.userId) {
    return NextResponse.json({ error: "User not linked" }, { status: 400 });
  }

  await prisma.notificationPreference.upsert({
    where: {
      userId_eventType: {
        userId: customer.userId,
        eventType: "EMAIL_2FA",
      },
    },
    update: {
      enabled: Boolean(payload.email2faEnabled),
    },
    create: {
      userId: customer.userId,
      eventType: "EMAIL_2FA",
      enabled: Boolean(payload.email2faEnabled),
    },
  });

  revalidatePath("/client/profile");
  return NextResponse.json({ ok: true, email2faEnabled: Boolean(payload.email2faEnabled) });
}
