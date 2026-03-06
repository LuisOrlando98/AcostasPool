import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  BUSINESS_TIMEZONE,
  endOfBusinessDay,
  startOfBusinessDay,
} from "@/lib/timezone";

export const TECH_DIGEST_TIMEZONE = BUSINESS_TIMEZONE;

export const getRouteDate = (value: Date) => {
  const routeDate = startOfBusinessDay(value);
  return routeDate ?? new Date(value);
};

type DigestItemInput = {
  technicianId: string;
  jobId: string;
  routeDate: Date;
  changeType: string;
  payload?: Prisma.JsonValue;
};

export const queueTechDigestItem = async ({
  technicianId,
  jobId,
  routeDate,
  changeType,
  payload,
}: DigestItemInput) => {
  return prisma.techDigestItem.create({
    data: {
      technicianId,
      jobId,
      routeDate: getRouteDate(routeDate),
      changeType,
      payload,
    },
  });
};

export const getRouteDayRange = (value: Date) => {
  const start = getRouteDate(value);
  const end = endOfBusinessDay(start) ?? new Date(start);
  return { start, end };
};
