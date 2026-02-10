-- CreateEnum
CREATE TYPE "DigestWindow" AS ENUM ('MORNING', 'MIDDAY', 'EVENING');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "Technician" ADD COLUMN     "colorHex" TEXT;

-- CreateTable
CREATE TABLE "TechDigest" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "routeDate" TIMESTAMP(3) NOT NULL,
    "window" "DigestWindow" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechDigest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechDigestItem" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "routeDate" TIMESTAMP(3) NOT NULL,
    "changeType" TEXT NOT NULL,
    "payload" JSONB,
    "digestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechDigestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientRole" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "technicianId" TEXT,
    "jobId" TEXT,
    "digestId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TechDigest" ADD CONSTRAINT "TechDigest_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechDigestItem" ADD CONSTRAINT "TechDigestItem_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechDigestItem" ADD CONSTRAINT "TechDigestItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechDigestItem" ADD CONSTRAINT "TechDigestItem_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "TechDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "TechDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
