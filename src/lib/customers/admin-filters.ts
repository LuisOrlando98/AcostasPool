import type { Prisma } from "@prisma/client";

export type CustomerAccountFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type CustomerPortalFilter = "ALL" | "ACTIVE" | "INACTIVE";

type BuildCustomerListWhereArgs = {
  query?: string;
  status?: string | null;
  portal?: string | null;
};

export function normalizeCustomerAccountFilter(
  value?: string | null
): CustomerAccountFilter {
  return value === "ACTIVE" || value === "INACTIVE" ? value : "ALL";
}

export function normalizeCustomerPortalFilter(
  value?: string | null
): CustomerPortalFilter {
  return value === "ACTIVE" || value === "INACTIVE" ? value : "ALL";
}

export function buildCustomerPortalWhere(
  portal: CustomerPortalFilter
): Prisma.CustomerWhereInput {
  if (portal === "ACTIVE") {
    return {
      user: {
        is: {
          passwordResetTokens: {
            some: {
              purpose: "INVITE",
              usedAt: { not: null },
            },
          },
        },
      },
    };
  }

  if (portal === "INACTIVE") {
    return {
      OR: [
        { user: { is: null } },
        {
          user: {
            is: {
              passwordResetTokens: {
                none: {
                  purpose: "INVITE",
                  usedAt: { not: null },
                },
              },
            },
          },
        },
      ],
    };
  }

  return {};
}

export function buildCustomerListWhere({
  query,
  status,
  portal,
}: BuildCustomerListWhereArgs): Prisma.CustomerWhereInput {
  const normalizedQuery = String(query ?? "").trim();
  const normalizedStatus = normalizeCustomerAccountFilter(status);
  const normalizedPortal = normalizeCustomerPortalFilter(portal);
  const conditions: Prisma.CustomerWhereInput[] = [];

  if (normalizedStatus === "ACTIVE" || normalizedStatus === "INACTIVE") {
    conditions.push({ estadoCuenta: normalizedStatus });
  }

  const portalWhere = buildCustomerPortalWhere(normalizedPortal);
  if (Object.keys(portalWhere).length > 0) {
    conditions.push(portalWhere);
  }

  if (normalizedQuery) {
    conditions.push({
      OR: [
        { nombre: { contains: normalizedQuery, mode: "insensitive" } },
        { apellidos: { contains: normalizedQuery, mode: "insensitive" } },
        { email: { contains: normalizedQuery, mode: "insensitive" } },
      ],
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  return conditions.length === 1 ? conditions[0] : { AND: conditions };
}
