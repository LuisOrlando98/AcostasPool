import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { getSession } from "@/lib/auth/session";
import {
  getRouteAssistantConfig,
  ROUTE_ORIGIN_ADDRESS_MAX_LENGTH,
  ROUTE_ORIGIN_ADDRESS_MIN_LENGTH,
  saveRouteAssistantConfig,
  type RouteAssistantConfig,
} from "@/lib/site-settings";

/** Acción registrada en AuditLog al cambiar los ajustes del asistente. */
const SETTINGS_AUDIT_ACTION = "ROUTE_ASSISTANT_SETTINGS";
const SETTINGS_AUDIT_ENTITY = "SiteSettings";

const HTTP_UNAUTHORIZED = 401;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

const bodySchema = z
  .object({
    dailyAutoOptimizeEnabled: z.boolean().optional(),
    originAddress: z
      .string()
      .trim()
      .min(ROUTE_ORIGIN_ADDRESS_MIN_LENGTH)
      .max(ROUTE_ORIGIN_ADDRESS_MAX_LENGTH)
      .optional(),
  })
  .strict();

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_UNAUTHORIZED });
  }

  const config = await getRouteAssistantConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_UNAUTHORIZED });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request data" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  try {
    const current = await getRouteAssistantConfig();
    const config: RouteAssistantConfig = {
      dailyAutoOptimizeEnabled:
        parsed.data.dailyAutoOptimizeEnabled ?? current.dailyAutoOptimizeEnabled,
      originAddress: parsed.data.originAddress ?? current.originAddress,
    };
    await saveRouteAssistantConfig(config);
    await logAuditEvent({
      userId: session.sub,
      action: SETTINGS_AUDIT_ACTION,
      entity: SETTINGS_AUDIT_ENTITY,
      metadata: { ...config },
    });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    console.error("route-assistant settings: save failed", {
      userId: session.sub,
      error,
    });
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
