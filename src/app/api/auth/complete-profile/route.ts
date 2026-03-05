import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { formatCustomerName } from "@/lib/customers/format";
import { normalizeUsPhone } from "@/lib/phones";
import { hashPasswordResetToken } from "@/lib/auth/reset-token";

const completeSchema = z.object({
  token: z.string().min(10).max(512),
  password: z.string().min(10),
  nombre: z.string().trim().min(1),
  apellidos: z.string().trim().min(1),
  telefono: z.string().trim().min(1),
  telefonoSecundario: z.string().optional().nullable(),
  idiomaPreferencia: z.enum(["ES", "EN"]).optional(),
  direccionLinea1: z.string().optional().nullable(),
  direccionLinea2: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  estadoProvincia: z.string().optional().nullable(),
  codigoPostal: z.string().optional().nullable(),
});

function splitFullName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  if (!cleaned) {
    return { nombre: "", apellidos: "" };
  }
  const parts = cleaned.split(" ");
  const nombre = parts.shift() ?? "";
  return { nombre, apellidos: parts.join(" ") };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";
    if (!token) {
      return json({ error: "Token requerido" }, 400);
    }
    const tokenHash = hashPasswordResetToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token }],
      },
      include: { user: { include: { customer: true, technician: true } } },
    });

    if (!resetToken || resetToken.purpose !== "INVITE" || resetToken.usedAt) {
      return json({ error: "Token invalido" }, 400);
    }

    if (resetToken.expiresAt < new Date()) {
      return json({ error: "Token expirado" }, 400);
    }

    const user = resetToken.user;
    const customer = user?.customer;
    const technician = user?.technician;

    if (!user) {
      return json({ error: "Invitacion invalida" }, 400);
    }

    if (user.role === "CUSTOMER" && customer) {
      return json({
        accountType: "CUSTOMER",
        customer: {
          nombre: customer.nombre,
          apellidos: customer.apellidos,
          email: customer.email,
          telefono: customer.telefono,
          telefonoSecundario: customer.telefonoSecundario,
          idiomaPreferencia: customer.idiomaPreferencia,
          direccionLinea1: customer.direccionLinea1,
          direccionLinea2: customer.direccionLinea2,
          ciudad: customer.ciudad,
          estadoProvincia: customer.estadoProvincia,
          codigoPostal: customer.codigoPostal,
        },
      });
    }

    if (user.role === "TECH" && technician) {
      const splitName = splitFullName(user.fullName);
      return json({
        accountType: "TECH",
        technician: {
          nombre: splitName.nombre,
          apellidos: splitName.apellidos,
          email: user.email,
          telefono: technician.phone ?? "",
          idiomaPreferencia: user.locale,
        },
      });
    }

    return json({ error: "Invitacion invalida" }, 400);
  } catch (error) {
    console.error("Complete profile GET failed:", error);
    return json({ error: "No se pudo validar la invitacion. Intenta de nuevo." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "Datos invalidos" }, 400);
    }

    const {
      token,
      password,
      nombre,
      apellidos,
      telefono: telefonoRaw,
      telefonoSecundario: telefonoSecundarioRaw,
      idiomaPreferencia,
      direccionLinea1,
      direccionLinea2,
      ciudad,
      estadoProvincia,
      codigoPostal,
    } = parsed.data;
    const tokenHash = hashPasswordResetToken(token);

    const telefono = normalizeUsPhone(telefonoRaw);
    if (!telefono) {
      return json({ error: "Telefono invalido" }, 400);
    }

    const telefonoSecundarioClean = telefonoSecundarioRaw?.trim() ?? "";
    const telefonoSecundario = telefonoSecundarioClean
      ? normalizeUsPhone(telefonoSecundarioClean)
      : null;
    if (telefonoSecundarioClean && !telefonoSecundario) {
      return json({ error: "Telefono secundario invalido" }, 400);
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token }],
      },
      include: { user: { include: { customer: true, technician: true } } },
    });

    if (!resetToken || resetToken.purpose !== "INVITE" || resetToken.usedAt) {
      return json({ error: "Token invalido" }, 400);
    }

    if (resetToken.expiresAt < new Date()) {
      return json({ error: "Token expirado" }, 400);
    }

    const user = resetToken.user;
    const customer = user?.customer;
    const technician = user?.technician;

    if (!user) {
      return json({ error: "Invitacion invalida" }, 400);
    }

    if (user.role === "TECH" && technician) {
      const passwordHash = await hashPassword(password);
      const fullName = `${nombre} ${apellidos}`.trim();

      await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            isActive: true,
            fullName,
            locale: idiomaPreferencia ?? user.locale,
          },
        }),
        prisma.technician.update({
          where: { id: technician.id },
          data: {
            phone: telefono,
          },
        }),
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, purpose: "INVITE", usedAt: null },
          data: { usedAt: new Date() },
        }),
      ]);

      return json({ ok: true });
    }

    if (user.role !== "CUSTOMER" || !customer) {
      return json({ error: "Invitacion invalida" }, 400);
    }

    const passwordHash = await hashPassword(password);
    const fullName = formatCustomerName({ nombre, apellidos, email: user.email });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isActive: customer.estadoCuenta === "ACTIVE",
          fullName,
          locale: idiomaPreferencia ?? user.locale,
        },
      }),
      prisma.customer.update({
        where: { id: customer.id },
        data: {
          nombre,
          apellidos,
          telefono,
          telefonoSecundario,
          idiomaPreferencia: idiomaPreferencia ?? customer.idiomaPreferencia,
          direccionLinea1: direccionLinea1?.trim() || null,
          direccionLinea2: direccionLinea2?.trim() || null,
          ciudad: ciudad?.trim() || null,
          estadoProvincia: estadoProvincia?.trim() || null,
          codigoPostal: codigoPostal?.trim() || null,
        },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, purpose: "INVITE", usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return json({ ok: true });
  } catch (error) {
    console.error("Complete profile POST failed:", error);
    return json({ error: "No se pudo completar el perfil. Intenta nuevamente." }, 500);
  }
}
