-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "sortOrder" INTEGER;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "readAt" TIMESTAMP(3);
