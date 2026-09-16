import { PrismaClient } from "@prisma/client";
import { getBusinessNow } from "@/lib/timezone";
import { SEED_CREDENTIALS } from "./constants";

/** Hour of the business day at which scripts/seed.cjs schedules the seed job. */
const SEED_JOB_HOUR = 9;

const caseInsensitive = (email: string) => ({
  equals: email,
  mode: "insensitive" as const,
});

/**
 * Resolves the id of the seed job (scripts/seed.cjs: seed customer served by
 * the seed technician) and reschedules it to today when the seed ran on an
 * earlier day. /tech (src/app/tech/page.tsx) only lists jobs from the start of
 * the current business day, so a stale job would be invisible to the suite.
 * Needs DATABASE_URL: playwright.config.ts loads .env when it is not set.
 */
export async function ensureSeedJobScheduledToday(): Promise<string> {
  const prisma = new PrismaClient();
  try {
    const job = await prisma.job.findFirst({
      where: {
        customer: { user: { email: caseInsensitive(SEED_CREDENTIALS.CUSTOMER.email) } },
        technician: { user: { email: caseInsensitive(SEED_CREDENTIALS.TECH.email) } },
      },
      orderBy: { scheduledDate: "desc" },
      select: { id: true, scheduledDate: true },
    });
    if (!job) {
      throw new Error(
        "Seed job not found in DATABASE_URL: run `npm run db:seed` first"
      );
    }

    const startOfToday = getBusinessNow().startOf("day");
    if (job.scheduledDate >= startOfToday.toJSDate()) {
      return job.id;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        scheduledDate: startOfToday.plus({ hours: SEED_JOB_HOUR }).toJSDate(),
      },
    });
    return job.id;
  } finally {
    await prisma.$disconnect();
  }
}
