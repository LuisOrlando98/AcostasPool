import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/email";
import { formatCustomerName } from "@/lib/customers/format";
import {
  buildCustomerListWhere,
  normalizeCustomerAccountFilter,
  normalizeCustomerPortalFilter,
} from "@/lib/customers/admin-filters";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const status = normalizeCustomerAccountFilter(searchParams.get("status"));
  const portal = normalizeCustomerPortalFilter(searchParams.get("portal"));

  if (portal !== "INACTIVE") {
    return NextResponse.json(
      { error: "Portal filter must be inactive" },
      { status: 400 }
    );
  }

  const customers = await prisma.customer.findMany({
    where: buildCustomerListWhere({
      query,
      status,
      portal,
    }),
    orderBy: [{ nombre: "asc" }, { apellidos: "asc" }],
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      email: true,
    },
  });

  const targets = customers
    .map((customer) => {
      const normalizedCustomerEmail = normalizeEmail(customer.email ?? "");
      if (!normalizedCustomerEmail) {
        return null;
      }

      return {
        id: customer.id,
        name: formatCustomerName(customer),
        email: normalizedCustomerEmail,
      };
    })
    .filter(
      (
        customer
      ): customer is { id: string; name: string; email: string } => customer !== null
    );

  return NextResponse.json({
    ok: true,
    totalMatching: customers.length,
    eligibleCount: targets.length,
    skippedCount: customers.length - targets.length,
    targets,
  });
}
