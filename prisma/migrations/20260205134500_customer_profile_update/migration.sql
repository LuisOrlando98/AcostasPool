-- RenameEnumValue
ALTER TYPE "AccountStatus" RENAME VALUE 'PAUSED' TO 'INACTIVE';

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- AlterTable
ALTER TABLE "Customer" RENAME COLUMN "name" TO "nombre";
ALTER TABLE "Customer" RENAME COLUMN "phone" TO "telefono";
ALTER TABLE "Customer" RENAME COLUMN "status" TO "estadoCuenta";
ALTER TABLE "Customer" RENAME COLUMN "locale" TO "idiomaPreferencia";
ALTER TABLE "Customer" RENAME COLUMN "internalNotes" TO "notas";

ALTER TABLE "Customer" DROP COLUMN "preferences";

ALTER TABLE "Customer" ADD COLUMN "apellidos" TEXT;
ALTER TABLE "Customer" ADD COLUMN "telefonoSecundario" TEXT;
ALTER TABLE "Customer" ADD COLUMN "tipoCliente" "CustomerType" NOT NULL DEFAULT 'RESIDENTIAL';
ALTER TABLE "Customer" ADD COLUMN "direccionLinea1" TEXT;
ALTER TABLE "Customer" ADD COLUMN "direccionLinea2" TEXT;
ALTER TABLE "Customer" ADD COLUMN "ciudad" TEXT;
ALTER TABLE "Customer" ADD COLUMN "estadoProvincia" TEXT;
ALTER TABLE "Customer" ADD COLUMN "codigoPostal" TEXT;

-- SyncUserStatus
UPDATE "User"
SET "isActive" = false
FROM "Customer"
WHERE "Customer"."userId" = "User"."id"
  AND "Customer"."estadoCuenta" = 'INACTIVE';
