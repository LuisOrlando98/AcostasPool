-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "EmailLog_customerId_idx" ON "EmailLog"("customerId");

-- CreateIndex
CREATE INDEX "EmailLog_technicianId_idx" ON "EmailLog"("technicianId");

-- CreateIndex
CREATE INDEX "EmailLog_jobId_idx" ON "EmailLog"("jobId");

-- CreateIndex
CREATE INDEX "Property_customerId_idx" ON "Property"("customerId");

-- CreateIndex
CREATE INDEX "ServicePlan_isActive_nextRunAt_idx" ON "ServicePlan"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "ServicePlan_customerId_idx" ON "ServicePlan"("customerId");

-- CreateIndex
CREATE INDEX "ServicePlan_propertyId_idx" ON "ServicePlan"("propertyId");

-- CreateIndex
CREATE INDEX "ServicePlan_technicianId_idx" ON "ServicePlan"("technicianId");

-- CreateIndex
CREATE INDEX "TechDigest_technicianId_routeDate_idx" ON "TechDigest"("technicianId", "routeDate");
