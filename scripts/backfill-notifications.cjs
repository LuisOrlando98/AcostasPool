const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const run = async () => {
  console.log("Backfilling notifications...");

  await prisma.notification.updateMany({
    where: { eventType: "JOB_COMPLETED" },
    data: { recipientRole: "ADMIN", severity: "INFO" },
  });

  await prisma.notification.updateMany({
    where: { eventType: "CUSTOMER_REQUEST" },
    data: { recipientRole: "ADMIN", severity: "WARNING" },
  });

  await prisma.notification.updateMany({
    where: { eventType: "SERVICE_RESCHEDULED" },
    data: { recipientRole: "CUSTOMER", severity: "WARNING" },
  });

  await prisma.notification.updateMany({
    where: { eventType: "SERVICE_SCHEDULED" },
    data: { recipientRole: "CUSTOMER", severity: "INFO" },
  });

  await prisma.notification.updateMany({
    where: { eventType: "ROUTE_UPDATED" },
    data: { recipientRole: "CUSTOMER", severity: "INFO" },
  });

  await prisma.notification.updateMany({
    where: { eventType: "INVOICE_SENT", status: "FAILED" },
    data: { recipientRole: "CUSTOMER", severity: "WARNING" },
  });

  await prisma.notification.updateMany({
    where: { eventType: "INVOICE_SENT", status: { not: "FAILED" } },
    data: { recipientRole: "CUSTOMER", severity: "INFO" },
  });

  console.log("Backfill complete.");
};

run()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
