import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sendCustomerInvite } from "@/lib/customers/invite";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveInviteStatusCode(error: string) {
  if (error === "Cliente no encontrado") {
    return 404;
  }
  if (
    error === "Cliente sin email" ||
    error === "Usuario asociado no es cliente" ||
    error === "Email en uso por otro rol" ||
    error === "Email ya asignado a otro cliente"
  ) {
    return 400;
  }
  return 503;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: customerId } = await context.params;
  if (!customerId) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  try {
    const result = await sendCustomerInvite(customerId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: resolveInviteStatusCode(result.error) }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Customer invite failed:", error);
    return NextResponse.json({ error: "Invite failed" }, { status: 500 });
  }
}
