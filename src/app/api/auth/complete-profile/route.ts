import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { formatCustomerName } from "@/lib/customers/format";
import { normalizeUsPhone } from "@/lib/phones";

const completeSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { include: { customer: true } } },
  });

  if (!resetToken || resetToken.usedAt) {
    return NextResponse.json({ error: "Token invalido" }, { status: 400 });
  }

  if (resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token expirado" }, { status: 400 });
  }

  const user = resetToken.user;
  const customer = user?.customer;

  if (!user || user.role !== "CUSTOMER" || !customer) {
    return NextResponse.json(
      { error: "Invitacion invalida" },
      { status: 400 }
    );
  }

  return NextResponse.json({
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
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

  const telefono = normalizeUsPhone(telefonoRaw);
  if (!telefono) {
    return NextResponse.json({ error: "Telefono invalido" }, { status: 400 });
  }

  const telefonoSecundarioClean = telefonoSecundarioRaw?.trim() ?? "";
  const telefonoSecundario = telefonoSecundarioClean
    ? normalizeUsPhone(telefonoSecundarioClean)
    : null;
  if (telefonoSecundarioClean && !telefonoSecundario) {
    return NextResponse.json(
      { error: "Telefono secundario invalido" },
      { status: 400 }
    );
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { include: { customer: true } } },
  });

  if (!resetToken || resetToken.usedAt) {
    return NextResponse.json({ error: "Token invalido" }, { status: 400 });
  }

  if (resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token expirado" }, { status: 400 });
  }

  const user = resetToken.user;
  const customer = user?.customer;

  if (!user || user.role !== "CUSTOMER" || !customer) {
    return NextResponse.json(
      { error: "Invitacion invalida" },
      { status: 400 }
    );
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
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
