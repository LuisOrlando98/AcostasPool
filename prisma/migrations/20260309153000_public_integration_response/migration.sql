CREATE TYPE "PublicIntegrationDecision" AS ENUM ('ACCEPT', 'DECLINE');

CREATE TABLE "PublicIntegrationResponse" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "companyName" TEXT,
    "decision" "PublicIntegrationDecision" NOT NULL,
    "acceptTerms" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "signatureDataUrl" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicIntegrationResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicIntegrationResponse_token_clientEmail_key"
ON "PublicIntegrationResponse"("token", "clientEmail");

CREATE INDEX "PublicIntegrationResponse_token_createdAt_idx"
ON "PublicIntegrationResponse"("token", "createdAt");
