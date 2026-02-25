CREATE TYPE "ResetTokenPurpose" AS ENUM ('INVITE', 'PASSWORD_RESET');

ALTER TABLE "PasswordResetToken"
ADD COLUMN "purpose" "ResetTokenPurpose" NOT NULL DEFAULT 'PASSWORD_RESET';

CREATE INDEX "PasswordResetToken_purpose_userId_createdAt_idx"
ON "PasswordResetToken"("purpose", "userId", "createdAt");

UPDATE "PasswordResetToken" prt
SET "purpose" = 'INVITE'
FROM "User" u
WHERE prt."userId" = u."id"
  AND u."role" = 'CUSTOMER'
  AND u."isActive" = false
  AND prt."usedAt" IS NULL;
