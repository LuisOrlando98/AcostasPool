import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  getRouteAssistantConfig,
  saveRouteAssistantConfig,
} from "@/lib/site-settings";

const bodySchema = z.object({
  dailyAutoOptimizeEnabled: z.boolean(),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getRouteAssistantConfig();
  return NextResponse.json(config);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  await saveRouteAssistantConfig(parsed.data);
  return NextResponse.json(parsed.data);
}
