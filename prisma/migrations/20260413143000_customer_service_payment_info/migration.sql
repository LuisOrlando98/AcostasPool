ALTER TABLE "Customer"
ADD COLUMN "serviceStartDate" TIMESTAMP(3),
ADD COLUMN "paymentDay" INTEGER,
ADD COLUMN "servicePrice" DECIMAL(10, 2),
ADD COLUMN "paymentType" TEXT,
ADD COLUMN "paymentNotes" TEXT;
