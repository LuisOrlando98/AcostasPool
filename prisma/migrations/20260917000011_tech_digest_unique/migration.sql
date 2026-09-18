-- Deduplicación previa al índice único (technicianId, routeDate, window).
-- Para cada grupo duplicado se conserva la fila más reciente (createdAt máximo; empate por id).
-- Las filas hijas (TechDigestItem, EmailLog) de los digests sobrantes se reapuntan al conservado
-- antes de borrar. Es idempotente: sin duplicados, ninguna sentencia afecta filas.

-- 1) Reapuntar TechDigestItem.digestId de los digests sobrantes al digest conservado.
UPDATE "TechDigestItem" AS item
SET "digestId" = ranked."keepId"
FROM (
  SELECT
    d."id",
    FIRST_VALUE(d."id") OVER (
      PARTITION BY d."technicianId", d."routeDate", d."window"
      ORDER BY d."createdAt" DESC, d."id" DESC
    ) AS "keepId"
  FROM "TechDigest" AS d
) AS ranked
WHERE item."digestId" = ranked."id"
  AND ranked."id" <> ranked."keepId";

-- 2) Reapuntar EmailLog.digestId de los digests sobrantes al digest conservado.
UPDATE "EmailLog" AS log
SET "digestId" = ranked."keepId"
FROM (
  SELECT
    d."id",
    FIRST_VALUE(d."id") OVER (
      PARTITION BY d."technicianId", d."routeDate", d."window"
      ORDER BY d."createdAt" DESC, d."id" DESC
    ) AS "keepId"
  FROM "TechDigest" AS d
) AS ranked
WHERE log."digestId" = ranked."id"
  AND ranked."id" <> ranked."keepId";

-- 3) Borrar los digests sobrantes (ya sin hijos apuntando a ellos).
DELETE FROM "TechDigest" AS d
USING (
  SELECT
    x."id",
    FIRST_VALUE(x."id") OVER (
      PARTITION BY x."technicianId", x."routeDate", x."window"
      ORDER BY x."createdAt" DESC, x."id" DESC
    ) AS "keepId"
  FROM "TechDigest" AS x
) AS ranked
WHERE d."id" = ranked."id"
  AND ranked."id" <> ranked."keepId";

-- CreateIndex
CREATE UNIQUE INDEX "TechDigest_technicianId_routeDate_window_key" ON "TechDigest"("technicianId", "routeDate", "window");
