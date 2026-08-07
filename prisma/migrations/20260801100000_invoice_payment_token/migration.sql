-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paymentToken" TEXT,
ADD COLUMN     "paymentTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentToken_key" ON "Invoice"("paymentToken");
