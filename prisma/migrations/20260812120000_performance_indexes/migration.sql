-- CreateIndex
CREATE INDEX "ServicePlan_isActive_nextRunAt_idx" ON "ServicePlan"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "Job_type_requestedAt_idx" ON "Job"("type", "requestedAt");

-- CreateIndex
CREATE INDEX "Job_planId_idx" ON "Job"("planId");

-- CreateIndex
CREATE INDEX "Property_customerId_idx" ON "Property"("customerId");
