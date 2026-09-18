-- AlterEnum
-- Nota: el nuevo valor no se usa dentro de esta misma migración (requisito de PostgreSQL >= 12
-- para ALTER TYPE ... ADD VALUE dentro de una transacción).
ALTER TYPE "NotificationStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAttemptAt" TIMESTAMPTZ(3),
ADD COLUMN     "recipientUserId" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- Backfill (idempotente): copia payload.recipientUserId a la nueva columna cuando exista
-- como cadena no vacía. Se guarda con jsonb_typeof para no fallar con payloads que no sean objeto.
UPDATE "Notification"
SET "recipientUserId" = payload->>'recipientUserId'
WHERE "recipientUserId" IS NULL
  AND payload IS NOT NULL
  AND jsonb_typeof(payload) = 'object'
  AND payload ? 'recipientUserId'
  AND jsonb_typeof(payload->'recipientUserId') = 'string'
  AND payload->>'recipientUserId' <> '';

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_createdAt_idx" ON "Notification"("recipientUserId", "createdAt");
