-- Índices que faltaban sobre claves foráneas y columnas usadas en filtros/orden.
-- Nota de integración: "ServicePlan_isActive_nextRunAt_idx" y "Property_customerId_idx"
-- ya los crea la migración anterior 20260812120000_performance_indexes, por lo que aquí
-- se omiten deliberadamente (crearlos de nuevo abortaría la migración).
-- Todos los índices van con IF NOT EXISTS: la migración es idempotente aunque alguno
-- exista ya (por ejemplo, tras un intento fallido en producción o un índice manual).

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailLog_customerId_idx" ON "EmailLog"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailLog_technicianId_idx" ON "EmailLog"("technicianId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmailLog_jobId_idx" ON "EmailLog"("jobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServicePlan_customerId_idx" ON "ServicePlan"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServicePlan_propertyId_idx" ON "ServicePlan"("propertyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServicePlan_technicianId_idx" ON "ServicePlan"("technicianId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TechDigest_technicianId_routeDate_idx" ON "TechDigest"("technicianId", "routeDate");
