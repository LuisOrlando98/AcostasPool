import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit/log";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { AssistantErrorResponse } from "@/lib/routing/assistant-types";
import { geocodeAddresses } from "@/lib/routing/geo";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * PATCH /api/admin/properties/[id]/location
 *
 * Corrige la ubicación de una propiedad desde el asistente de rutas. Con una
 * dirección se geocodifica; con un par lat/lng se guardan las coordenadas tal
 * cual (corrección manual). Si la geocodificación no resuelve, la dirección se
 * guarda igualmente y la respuesta lo dice con `geocoded: false`, para que la
 * interfaz ofrezca escribir las coordenadas a mano en vez de dar un error.
 */

const ADDRESS_MIN_LENGTH = 5;
const ADDRESS_MAX_LENGTH = 200;
const MAX_LATITUDE_DEGREES = 90;
const MAX_LONGITUDE_DEGREES = 180;
const LOCATION_RATE_LIMIT = 30;
const MS_PER_MINUTE = 60_000;
const LOCATION_RATE_LIMIT_WINDOW_MS = 5 * MS_PER_MINUTE;

/** Acción registrada en AuditLog al corregir la ubicación de una propiedad. */
const LOCATION_AUDIT_ACTION = "PROPERTY_LOCATION_UPDATED";
const LOCATION_AUDIT_ENTITY = "Property";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_INTERNAL_ERROR = 500;

const propertyLocationSelect = {
  id: true,
  address: true,
  lat: true,
  lng: true,
  geocodedAt: true,
} satisfies Prisma.PropertySelect;

type PropertyLocation = Prisma.PropertyGetPayload<{
  select: typeof propertyLocationSelect;
}>;

/**
 * Al menos la dirección o el par completo de coordenadas; lat y lng van juntas
 * o no van, porque media coordenada no ubica nada.
 */
const bodySchema = z
  .object({
    address: z
      .string()
      .trim()
      .min(ADDRESS_MIN_LENGTH)
      .max(ADDRESS_MAX_LENGTH)
      .optional(),
    lat: z.number().min(-MAX_LATITUDE_DEGREES).max(MAX_LATITUDE_DEGREES).optional(),
    lng: z
      .number()
      .min(-MAX_LONGITUDE_DEGREES)
      .max(MAX_LONGITUDE_DEGREES)
      .optional(),
  })
  .strict()
  .refine((body) => (body.lat === undefined) === (body.lng === undefined), {
    message: "lat and lng must be sent together",
  })
  .refine((body) => body.address !== undefined || body.lat !== undefined, {
    message: "address or lat/lng is required",
  });

type LocationRequest = z.infer<typeof bodySchema>;

type LocationUpdate = {
  readonly data: {
    address?: string;
    lat: number | null;
    lng: number | null;
    geocodedAt: Date | null;
  };
  /** La propiedad queda con coordenadas utilizables. */
  readonly geocoded: boolean;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Coordenadas escritas a mano: se guardan tal cual y se sellan con la fecha. */
function manualLocationUpdate(input: {
  address?: string;
  lat: number;
  lng: number;
}): LocationUpdate {
  return {
    data: {
      ...(input.address === undefined ? {} : { address: input.address }),
      lat: input.lat,
      lng: input.lng,
      geocodedAt: new Date(),
    },
    geocoded: true,
  };
}

/**
 * Dirección sin coordenadas: se geocodifica. Si no resuelve, las coordenadas
 * quedan a null en vez de conservar las anteriores, que son las de la dirección
 * vieja y el asistente volvería a darlas por buenas.
 */
async function geocodedLocationUpdate(address: string): Promise<LocationUpdate> {
  const point = (await geocodeAddresses([address])).get(address) ?? null;
  return {
    data: {
      address,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      geocodedAt: point ? new Date() : null,
    },
    geocoded: point !== null,
  };
}

function resolveLocationUpdate(
  input: LocationRequest,
  current: PropertyLocation
): Promise<LocationUpdate> | LocationUpdate {
  if (input.lat !== undefined && input.lng !== undefined) {
    return manualLocationUpdate({
      address: input.address,
      lat: input.lat,
      lng: input.lng,
    });
  }
  return geocodedLocationUpdate(input.address ?? current.address);
}

function toLocationResponse(property: PropertyLocation) {
  return {
    id: property.id,
    address: property.address,
    lat: property.lat,
    lng: property.lng,
    geocodedAt: property.geocodedAt ? property.geocodedAt.toISOString() : null,
  };
}

function locationAuditMetadata(
  before: PropertyLocation,
  after: PropertyLocation
) {
  return {
    before: { address: before.address, lat: before.lat, lng: before.lng },
    after: { address: after.address, lat: after.lat, lng: after.lng },
  };
}

async function updatePropertyLocation(params: {
  id: string;
  input: LocationRequest;
  userId: string;
}) {
  const current = await prisma.property.findUnique({
    where: { id: params.id },
    select: propertyLocationSelect,
  });
  if (!current) {
    return NextResponse.json(
      {
        error: "Property not found",
        code: "PROPERTY_NOT_FOUND",
      } satisfies AssistantErrorResponse,
      { status: HTTP_NOT_FOUND }
    );
  }

  const update = await resolveLocationUpdate(params.input, current);
  const property = await prisma.property.update({
    where: { id: params.id },
    data: update.data,
    select: propertyLocationSelect,
  });
  await logAuditEvent({
    userId: params.userId,
    action: LOCATION_AUDIT_ACTION,
    entity: LOCATION_AUDIT_ENTITY,
    entityId: property.id,
    metadata: locationAuditMetadata(current, property),
  });

  return NextResponse.json({
    ok: true,
    geocoded: update.geocoded,
    property: toLocationResponse(property),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_UNAUTHORIZED }
    );
  }

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!id || !parsed.success) {
    return NextResponse.json(
      { error: "Invalid request data" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const rateLimit = await checkRateLimit({
    key: `property-location:${session.sub}`,
    limit: LOCATION_RATE_LIMIT,
    windowMs: LOCATION_RATE_LIMIT_WINDOW_MS,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        code: "RATE_LIMITED",
      } satisfies AssistantErrorResponse,
      { status: HTTP_TOO_MANY_REQUESTS }
    );
  }

  try {
    return await updatePropertyLocation({
      id,
      input: parsed.data,
      userId: session.sub,
    });
  } catch (error) {
    console.error("property location: update failed", {
      userId: session.sub,
      propertyId: id,
      error,
    });
    return NextResponse.json(
      { error: "Failed to update property location" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
