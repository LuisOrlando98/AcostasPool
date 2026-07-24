-- CreateTable
CREATE TABLE "ServiceContract" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "locale" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "periodMonth" TIMESTAMP(3) NOT NULL,

    "customerNameSnapshot" TEXT NOT NULL,
    "customerEmailSnapshot" TEXT,
    "customerPhoneSnapshot" TEXT,
    "customerAddressSnapshot" TEXT,
    "propertyAddressSnapshot" TEXT,
    "poolTypeSnapshot" TEXT,
    "planNameSnapshot" TEXT,
    "servicePriceSnapshot" DECIMAL(10, 2),
    "paymentDaySnapshot" INTEGER,
    "paymentMethodSnapshot" TEXT,
    "paymentTypeSnapshot" TEXT,
    "poolConditionSnapshot" JSONB,

    "companySignatureUrl" TEXT,
    "pdfUrl" TEXT,

    "sentAt" TIMESTAMP(3),

    "clientSignatureUrl" TEXT,
    "clientSignedAt" TIMESTAMP(3),
    "clientSignedVia" TEXT,
    "clientSignedByUserId" TEXT,
    "clientSignedIp" TEXT,
    "clientSignedUserAgent" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceContract_customerId_periodMonth_idx" ON "ServiceContract"("customerId", "periodMonth");

-- CreateIndex
CREATE INDEX "ServiceContract_status_idx" ON "ServiceContract"("status");

-- AddForeignKey
ALTER TABLE "ServiceContract" ADD CONSTRAINT "ServiceContract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceContract" ADD CONSTRAINT "ServiceContract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN "companySignatureUrl" TEXT;
