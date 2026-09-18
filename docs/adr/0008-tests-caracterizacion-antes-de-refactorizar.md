# 0008 - Tests de caracterización antes de refactorizar

## Estado

Aceptada (guía de trabajo hacia adelante).

## Contexto

Varias migraciones recientes tocan datos y reglas ya vigentes en producción:
`20260917000011_tech_digest_unique` (dedupe de `TechDigest` antes de poder imponer la restricción
única), `20260917000114_notification_recipient_column` (backfill de `recipientUserId` desde
`payload`), `20260917000347_on_delete_rules` (cambia el comportamiento de borrado en cascada de
media docena de tablas) y `20260917000426_timestamptz` (reescribe cada columna `DateTime` del
schema). El riesgo de romper comportamiento existente al "solo" ajustar el schema o refactorizar
un módulo con lógica no trivial (worker, notificaciones, materialización de planes, ciclo de vida
de jobs) es alto, y una migración de reescritura de tabla no se puede revertir sin restaurar un
snapshot previo (ver `Architecture.md` §12).

## Decisión

Antes de refactorizar un módulo con lógica de negocio no trivial, escribir primero pruebas de
**caracterización**: pruebas que fijan el comportamiento actual del código (lo que realmente
hace hoy, no lo que "debería" hacer) usando la suite existente (`tests/unit/**`, Vitest) como red
de seguridad, para poder comparar el comportamiento antes/después del refactor en vez de
confiarlo a la memoria. De forma simétrica, cualquier migración que transforme datos existentes
(no solo el esquema) debe escribirse para ser **idempotente** (ver ADR 0006) y probarse contra
una copia representativa de los datos antes de aplicarla en producción con
`prisma migrate deploy`.

## Consecuencias

- Positivo: un refactor puede validarse contra un comportamiento conocido y verificado, no contra
  una reconstrucción mental de la intención original. Las migraciones de datos ya escritas con
  este criterio (`tech_digest_unique`, `normalize_emails`) sirven de plantilla concreta:
  comprueban su propia condición de "no-op" antes de tocar filas.
- Negativo: escribir pruebas de caracterización antes de entender del todo un módulo añade
  fricción inicial al trabajo de refactor. Si la caracterización fija por accidente un bug
  existente como "comportamiento esperado", el refactor puede terminar preservando ese bug salvo
  que se lo revise y documente explícitamente como tal antes de escribir la prueba.
