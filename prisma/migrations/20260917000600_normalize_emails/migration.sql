-- Normalización idempotente de emails a minúsculas en "User" y "Customer".
-- Solo se actualiza una fila cuando no existe ya otra fila con ese mismo email en minúsculas,
-- para no violar "User_email_key" (Customer.email no es único hoy, pero se aplica el mismo
-- criterio para no crear duplicados nuevos). Las filas en conflicto quedan sin cambios y deben
-- resolverse manualmente. Sin filas afectadas, la migración es un no-op.

UPDATE "User" u
SET email = LOWER(email)
WHERE email <> LOWER(email)
  AND NOT EXISTS (
    SELECT 1 FROM "User" v
    WHERE v.email = LOWER(u.email)
      AND v.id <> u.id
  );

UPDATE "Customer" c
SET email = LOWER(email)
WHERE email <> LOWER(email)
  AND NOT EXISTS (
    SELECT 1 FROM "Customer" d
    WHERE d.email = LOWER(c.email)
      AND d.id <> c.id
  );
