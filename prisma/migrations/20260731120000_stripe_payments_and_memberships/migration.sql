-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "stripeCheckoutSessionId" TEXT;

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "propertyId" TEXT,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" "MembershipStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "authorizedVia" TEXT,
    "authorizedByUserId" TEXT,
    "authorizedIp" TEXT,
    "authorizedUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "membershipId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "PaymentStatus" NOT NULL,
    "method" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeChargeId" TEXT,
    "stripeInvoiceId" TEXT,
    "refundOfPaymentId" TEXT,
    "recordedByUserId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("stripeEventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_stripeCustomerId_key" ON "Customer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_stripeSubscriptionId_key" ON "Membership"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Membership_customerId_idx" ON "Membership"("customerId");

-- CreateIndex
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

-- CreateIndex: prevent two concurrently-ACTIVE memberships for the same customer+property
CREATE UNIQUE INDEX "Membership_active_customer_property_key" ON "Membership"("customerId", "propertyId") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "Payment_customerId_paidAt_idx" ON "Payment"("customerId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_membershipId_idx" ON "Payment"("membershipId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
