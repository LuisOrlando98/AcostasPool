import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const TECH_DIGEST_TIMEZONE = "America/New_York";

export const getRouteDate = (value: Date) => {
  const routeDate = new Date(value);
  routeDate.setHours(0, 0, 0, 0);
  return routeDate;
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
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};
