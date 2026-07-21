-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "contractedServiceTierId" TEXT,
ADD COLUMN "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "Property"
ADD COLUMN "filterBrand" TEXT,
ADD COLUMN "filterModel" TEXT,
ADD COLUMN "pumpBrand" TEXT,
ADD COLUMN "pumpHorsepower" TEXT,
ADD COLUMN "poolCondition" JSONB,
ADD COLUMN "poolConditionNotes" TEXT;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_contractedServiceTierId_fkey" FOREIGN KEY ("contractedServiceTierId") REFERENCES "ServiceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
