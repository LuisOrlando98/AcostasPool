ALTER TABLE "SiteSettings"
ADD COLUMN "invoiceTemplate" JSONB;

CREATE TABLE "CustomerDocument" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerDocument_customerId_createdAt_idx"
ON "CustomerDocument"("customerId", "createdAt");

CREATE INDEX "CustomerDocument_uploadedByUserId_createdAt_idx"
ON "CustomerDocument"("uploadedByUserId", "createdAt");

ALTER TABLE "CustomerDocument"
ADD CONSTRAINT "CustomerDocument_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerDocument"
ADD CONSTRAINT "CustomerDocument_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
