ALTER TABLE "Property"
ADD COLUMN "serviceStartDate" TIMESTAMP(3),
ADD COLUMN "paymentDay" INTEGER,
ADD COLUMN "servicePrice" DECIMAL(10, 2),
ADD COLUMN "paymentType" TEXT,
ADD COLUMN "paymentNotes" TEXT;

UPDATE "Property" AS p
SET
  "serviceStartDate" = c."serviceStartDate",
  "paymentDay" = c."paymentDay",
  "servicePrice" = c."servicePrice",
  "paymentType" = c."paymentType",
  "paymentNotes" = c."paymentNotes"
FROM "Customer" AS c
WHERE p."customerId" = c."id"
  AND (
    c."serviceStartDate" IS NOT NULL OR
    c."paymentDay" IS NOT NULL OR
    c."servicePrice" IS NOT NULL OR
    c."paymentType" IS NOT NULL OR
    c."paymentNotes" IS NOT NULL
  );

ALTER TABLE "Customer"
DROP COLUMN "serviceStartDate",
DROP COLUMN "paymentDay",
DROP COLUMN "servicePrice",
DROP COLUMN "paymentType",
DROP COLUMN "paymentNotes";
