UPDATE "Customer"
SET "apellidos" = ''
WHERE "apellidos" IS NULL;

UPDATE "Customer"
SET "telefono" = ''
WHERE "telefono" IS NULL;

ALTER TABLE "Customer"
ALTER COLUMN "apellidos" SET NOT NULL;

ALTER TABLE "Customer"
ALTER COLUMN "telefono" SET NOT NULL;
