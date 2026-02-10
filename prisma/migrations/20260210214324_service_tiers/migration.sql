-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "serviceTierId" TEXT;

-- AlterTable
ALTER TABLE "ServicePlan" ADD COLUMN     "serviceTierId" TEXT;

-- CreateTable
CREATE TABLE "ServiceTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "checklist" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTier_name_key" ON "ServiceTier"("name");

-- CreateIndex
CREATE INDEX "Job_serviceTierId_idx" ON "Job"("serviceTierId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_serviceTierId_fkey" FOREIGN KEY ("serviceTierId") REFERENCES "ServiceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePlan" ADD CONSTRAINT "ServicePlan_serviceTierId_fkey" FOREIGN KEY ("serviceTierId") REFERENCES "ServiceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
