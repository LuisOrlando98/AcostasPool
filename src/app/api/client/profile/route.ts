import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { getMailConfig, sendMailAndLog } from "@/lib/mail/transport";
import { normalizeUsPhone } from "@/lib/phones";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { parseBusinessDateInput, startOfBusinessDay } from "@/lib/timezone";

type Locale = "EN" | "ES";

type Payload =
  | {
      kind: "personal";
      nombre: string;
      apellidos: string;
      email: string;
      telefono: string;
      telefonoSecundario?: string;
      idiomaPreferencia: Locale;
      /** Required only when `email` differs from the account's current one. */
      currentPassword?: string;
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
    }
  | {
      kind: "serviceControl";
      action: "PAUSE" | "RESUME";
      pauseFrom?: string;
    };

/**
 * The account e-mail is the identifier used to sign in and to receive password
 * reset links, so changing it is treated as a credential change: the session
 * alone is not enough, the current password has to be re-entered.
 */
const INVALID_PASSWORD_ERROR = "Invalid password";
const PASSWORD_REQUIRED_ERROR = "Current password required";
const NO_PASSWORD_SET_ERROR =
  "This account has no password yet. Request a password reset link before changing the e-mail address.";

type EmailChangeNotice = { subject: string; text: string };

function buildEmailChangeNotice(
  locale: Locale,
  previousEmail: string,
  nextEmail: string
): EmailChangeNotice {
  if (locale === "ES") {
    return {
      subject: "Tu correo de acceso cambio",
      text: `El correo de acceso de tu cuenta cambio de ${previousEmail} a ${nextEmail}. Si no fuiste tu, contacta con nosotros de inmediato.`,
    };
  }
  return {
    subject: "Your sign-in e-mail was changed",
    text: `The sign-in e-mail of your account changed from ${previousEmail} to ${nextEmail}. If this was not you, contact us immediately.`,
  };
}

/**
 * Warns the previous address that it no longer controls the account. Never
 * changes the outcome of the update: a missing SMTP config or a send failure is
 * logged (the transport also writes an EmailLog row) and swallowed here.
 */
async function notifyPreviousEmail(input: {
  previousEmail: string;
  nextEmail: string;
  recipientName: string;
  locale: Locale;
  customerId: string;
}) {
  if (!getMailConfig()) {
    return;
  }
  const notice = buildEmailChangeNotice(
    input.locale,
    input.previousEmail,
    input.nextEmail
  );
  try {
    await sendMailAndLog({
      to: input.previousEmail,
      recipientName: input.recipientName,
      recipientRole: "CUSTOMER",
      // No dedicated template id exists yet; the category keeps the EmailLog row
      // searchable while the subject and body are built here.
      template: "PASSWORD_RESET",
      customerId: input.customerId,
      subject: notice.subject,
      text: notice.text,
      metadata: { category: "EMAIL_CHANGED", previousEmail: input.previousEmail },
    });
  } catch (error) {
    console.error("Email change notice failed:", error);
  }
}

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

    const account = customer.userId
      ? await prisma.user.findUnique({
          where: { id: customer.userId },
          select: { email: true, passwordHash: true },
        })
      : null;
    const previousEmail = normalizeEmail(account?.email ?? "");
    const emailChanged = Boolean(account) && previousEmail !== email;

    if (emailChanged) {
      if (!account?.passwordHash) {
        return NextResponse.json({ error: NO_PASSWORD_SET_ERROR }, { status: 400 });
      }
      const currentPassword = String(payload.currentPassword ?? "");
      if (!currentPassword) {
        return NextResponse.json(
          { error: PASSWORD_REQUIRED_ERROR },
          { status: 400 }
        );
      }
      const passwordMatches = await verifyPassword(
        currentPassword,
        account.passwordHash
      );
      if (!passwordMatches) {
        return NextResponse.json({ error: INVALID_PASSWORD_ERROR }, { status: 401 });
      }
    }

    if (customer.userId) {
      // Emails are stored normalized (lower-case), so an exact match is enough.
      const duplicate = await prisma.user.findFirst({
        where: {
          id: { not: customer.userId },
          email,
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
    }

    // The customer record and its linked user must change together.
    await prisma.$transaction([
      prisma.customer.update({
        where: { id: customer.id },
        data: {
          nombre,
          apellidos,
          email,
          telefono,
          telefonoSecundario,
          idiomaPreferencia,
        },
      }),
      ...(customer.userId
        ? [
            prisma.user.update({
              where: { id: customer.userId },
              data: {
                fullName: `${nombre} ${apellidos}`.trim(),
                email,
                locale: idiomaPreferencia,
              },
            }),
          ]
        : []),
    ]);

    if (emailChanged) {
      await notifyPreviousEmail({
        previousEmail,
        nextEmail: email,
        recipientName: `${nombre} ${apellidos}`.trim(),
        locale: idiomaPreferencia,
        customerId: customer.id,
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(LOCALE_COOKIE, normalizeLocale(idiomaPreferencia), {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      priority: "medium",
      maxAge: 60 * 60 * 24 * 30,
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

  if (payload.kind === "serviceControl") {
    if (payload.action === "PAUSE") {
      const rawPauseFrom = String(payload.pauseFrom ?? "").trim();
      const parsedPauseFrom = parseBusinessDateInput(rawPauseFrom);
      if (!parsedPauseFrom) {
        return NextResponse.json(
          { error: "Invalid pause date" },
          { status: 400 }
        );
      }
      const pauseFrom = startOfBusinessDay(parsedPauseFrom) ?? parsedPauseFrom;
      await prisma.$transaction([
        prisma.customer.update({
          where: { id: customer.id },
          data: { pauseServicesFrom: pauseFrom },
        }),
        prisma.job.deleteMany({
          where: {
            customerId: customer.id,
            planId: { not: null },
            status: { in: ["SCHEDULED", "PENDING"] },
            scheduledDate: { gte: pauseFrom },
          },
        }),
      ]);
      revalidatePath("/client/profile");
      revalidatePath("/client");
      return NextResponse.json({
        ok: true,
        pauseServicesFrom: pauseFrom.toISOString(),
      });
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { pauseServicesFrom: null },
    });
    revalidatePath("/client/profile");
    revalidatePath("/client");
    return NextResponse.json({ ok: true, pauseServicesFrom: null });
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
