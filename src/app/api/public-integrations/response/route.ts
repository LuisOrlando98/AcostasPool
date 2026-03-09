import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeEmail } from "@/lib/auth/email";
import { isAllowedPublicIntegrationToken } from "@/lib/public-integrations";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const dataUrlPattern = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

const responseSchema = z.object({
  token: z.string().trim().min(12).max(120),
  clientName: z.string().trim().min(2).max(120),
  clientEmail: z.string().trim().email().max(180),
  companyName: z.string().trim().max(120).optional(),
  decision: z.enum(["ACCEPT", "DECLINE"]),
  acceptTerms: z.boolean().optional().default(false),
  comments: z.string().trim().max(1200).optional(),
  signatureDataUrl: z
    .string()
    .trim()
    .min(120)
    .max(900_000)
    .regex(dataUrlPattern, "Invalid signature format"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRate = await checkRateLimit({
    key: `public-integration:response:ip:${ip}`,
    limit: 20,
    windowMs: 60 * 60_000,
  });
  if (!ipRate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipRate.retryAfterSeconds) },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const payload = parsed.data;
  if (!isAllowedPublicIntegrationToken(payload.token)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const clientEmail = normalizeEmail(payload.clientEmail);
  const emailRate = await checkRateLimit({
    key: `public-integration:response:email:${clientEmail}`,
    limit: 8,
    windowMs: 60 * 60_000,
  });
  if (!emailRate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(emailRate.retryAfterSeconds) },
      }
    );
  }

  if (payload.decision === "ACCEPT" && !payload.acceptTerms) {
    return NextResponse.json(
      { error: "Terms must be accepted to approve this integration." },
      { status: 400 }
    );
  }

  const record = await prisma.publicIntegrationResponse.upsert({
    where: {
      token_clientEmail: {
        token: payload.token,
        clientEmail,
      },
    },
    update: {
      clientName: payload.clientName,
      companyName: payload.companyName?.trim() || null,
      decision: payload.decision,
      acceptTerms: payload.acceptTerms,
      comments: payload.comments?.trim() || null,
      signatureDataUrl: payload.signatureDataUrl,
      ipAddress: ip || null,
      userAgent: request.headers.get("user-agent") || null,
    },
    create: {
      token: payload.token,
      clientName: payload.clientName,
      clientEmail,
      companyName: payload.companyName?.trim() || null,
      decision: payload.decision,
      acceptTerms: payload.acceptTerms,
      comments: payload.comments?.trim() || null,
      signatureDataUrl: payload.signatureDataUrl,
      ipAddress: ip || null,
      userAgent: request.headers.get("user-agent") || null,
    },
    select: {
      id: true,
      decision: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    id: record.id,
    decision: record.decision,
    updatedAt: record.updatedAt.toISOString(),
  });
}
