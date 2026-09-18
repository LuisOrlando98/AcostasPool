-- Índices que faltaban sobre claves foráneas y columnas usadas en filtros/orden.
-- Nota de integración: "ServicePlan_isActive_nextRunAt_idx" y "Property_customerId_idx"
-- ya los crea la migración anterior 20260812120000_performance_indexes, por lo que aquí
-- se omiten deliberadamente (crearlos de nuevo abortaría la migración).

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
CREATE INDEX "ServicePlan_customerId_idx" ON "ServicePlan"("customerId");

-- CreateIndex
CREATE INDEX "ServicePlan_propertyId_idx" ON "ServicePlan"("propertyId");

-- CreateIndex
CREATE INDEX "ServicePlan_technicianId_idx" ON "ServicePlan"("technicianId");

-- CreateIndex
CREATE INDEX "TechDigest_technicianId_routeDate_idx" ON "TechDigest"("technicianId", "routeDate");
