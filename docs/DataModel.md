# Modelo de Datos

> Estado: 18 sep 2026. Generado íntegramente desde `prisma/schema.prisma` (20 modelos, 17 enums)
> y contrastado con `prisma/migrations/**`. Cualquier discrepancia entre este documento y el
> schema debe resolverse a favor del schema: este archivo es una lectura, no la fuente de verdad.

## 0. Convenciones que aplican a todo el schema

- **Zona horaria en columnas de fecha**: desde la migración `20260917000426_timestamptz`, **todas**
  las columnas `DateTime` son `TIMESTAMPTZ(3)`. La aplicación siempre escribe instantes UTC
  (Luxon `.toUTC()` / Prisma), así que la conversión usó `USING col AT TIME ZONE 'UTC'` para no
  desplazar los valores existentes (ver el riesgo operativo en `Architecture.md` §12).
- **Emails en minúsculas**: no hay `CHECK` ni normalización a nivel de columna. `User.email` y
  `Customer.email` se normalizan en la aplicación (`src/lib/auth/email.ts#normalizeEmail`, usado en
  login, altas e invitaciones) y la migración `20260917000600_normalize_emails` hizo un backfill
  **idempotente** de las filas existentes (una fila se deja intacta si normalizarla chocaría con
  otra ya en minúsculas; esos choques quedan pendientes de resolución manual). Nada impide hoy que
  una escritura fuera de esos módulos inserte un email con mayúsculas.
- **`cuid()` como `id`** en todos los modelos salvo `RateLimitBucket` (clave natural, el propio
  `key` de rate limit) y `SiteSettings` (fila única, `id` fijo `"default"`).
- Los nombres de modelo y campo son exactamente los del schema (`nombre`, `apellidos`,
  `idiomaPreferencia`, etc. están en español en `Customer` porque así se definieron desde el
  inicio del proyecto; el resto del schema está en inglés).

## 1. Enums (17)

| Enum | Valores |
| --- | --- |
| `Role` | `ADMIN`, `TECH`, `CUSTOMER` |
| `Locale` | `ES`, `EN` |
| `AccountStatus` | `ACTIVE`, `INACTIVE` |
| `CustomerType` | `RESIDENTIAL`, `COMMERCIAL` |
| `JobStatus` | `SCHEDULED`, `PENDING`, `ON_THE_WAY`, `IN_PROGRESS`, `COMPLETED` |
| `JobType` | `ROUTINE`, `ON_DEMAND` |
| `JobPriority` | `NORMAL`, `URGENT` |
| `ServiceType` | `WEEKLY_CLEANING`, `FILTER_CHECK`, `CHEM_BALANCE`, `EQUIPMENT_CHECK` |
| `PlanFrequency` | `WEEKLY`, `BIWEEKLY`, `MONTHLY` |
| `InvoiceStatus` | `DRAFT`, `SENT`, `PAID`, `OVERDUE` |
| `InvoiceTheme` | `STANDARD`, `SPECIAL`, `ESTIMATE` |
| `NotificationStatus` | `QUEUED`, `PROCESSING`, `SENT`, `FAILED` |
| `NotificationChannel` | `EMAIL` (único valor hoy) |
| `NotificationSeverity` | `INFO`, `WARNING`, `CRITICAL` |
| `DigestWindow` | `MORNING`, `MIDDAY`, `EVENING` |
| `PublicIntegrationDecision` | `ACCEPT`, `DECLINE` |
| `ResetTokenPurpose` | `INVITE`, `PASSWORD_RESET` |

`NotificationStatus.PROCESSING` se añadió en la migración `20260917000114_notification_recipient_column`
(no en el diseño original) para que el worker pueda "reclamar" un lote de forma atómica antes de
enviarlo — ver `Architecture.md` §5.

## 2. Modelos (20)

Índice: `User`, `Technician`, `Customer`, `Property`, `Job`, `ServiceTier`, `ServicePlan`,
`JobPhoto`, `Invoice`, `CustomerDocument`, `Notification`, `NotificationPreference`,
`TechDigest`, `TechDigestItem`, `EmailLog`, `AuditLog`, `PasswordResetToken`,
`RateLimitBucket`, `SiteSettings`, `PublicIntegrationResponse`.

---

### User

- **Campos**: `email` (`@unique`), `passwordHash`, `fullName`, `role: Role`, `locale: Locale`
  (default `EN`), `isActive` (default `true`), `isDeveloper` (default `false`), `avatarUrl?`,
  `createdAt`/`updatedAt`.
- **Relaciones**: `technician Technician?`, `customer Customer?`, `requestedJobs Job[]`
  (relación nombrada `UserRequestedJobs`), `auditLogs AuditLog[]`, `passwordResetTokens
  PasswordResetToken[]`, `notificationPreferences NotificationPreference[]`, `actedNotifications
  Notification[]` (`NotificationActor`), `customerDocuments CustomerDocument[]`
  (`CustomerDocumentUploader`).
- **Índices**: `@@index([isDeveloper])`.
- **Notas de diseño**: `isDeveloper` por sí solo no basta — `src/lib/auth/developer.ts` exige
  además que el email esté en una allowlist fija hardcodeada en código (hoy un solo email) antes
  de elevar el rol efectivo a `ADMIN`. `role` es el único campo de autorización real leído por
  `getSession()`; el resto de "roles" (developer) son una capa encima.

### Technician

- **Campos**: `userId` (`@unique`), `phone?`, `notes?`, `colorHex?` (color de la ruta en el
  calendario admin).
- **Relaciones y onDelete**: `userId -> User`: **Cascade** (borrar el `User` borra el
  `Technician`). Hijos: `jobs Job[]`, `servicePlans ServicePlan[]`, `digests TechDigest[]`,
  `digestItems TechDigestItem[]`, `emailLogs EmailLog[]`.
- **Notas**: no tiene índices propios además del único implícito de `userId`.

### Customer

- **Campos**: `userId?` (`@unique`, puede no tener portal vinculado), `nombre`, `apellidos`,
  `email`, `telefono`, `telefonoSecundario?`, `idiomaPreferencia: Locale` (default `EN`),
  `estadoCuenta: AccountStatus` (default `ACTIVE`), `tipoCliente: CustomerType` (default
  `RESIDENTIAL`), `allowWeekendBooking` (default `false`), `pauseServicesFrom?`,
  `direccionLinea1/2?`, `ciudad?`, `estadoProvincia?`, `codigoPostal?`, `notas?`.
- **Relaciones y onDelete**: `userId -> User`: **SetNull** (borrar el `User` del portal no borra
  al cliente). Hijos, todos **Cascade**: `properties Property[]`, `jobs Job[]`, `invoices
  Invoice[]`, `documents CustomerDocument[]`, `notifications Notification[]`, `servicePlans
  ServicePlan[]`, `emailLogs EmailLog[]`.
- **Índices**: `@@index([email])` — **no** es único (a diferencia de `User.email`); en teoría
  puede haber dos `Customer` con el mismo email.
- **Notas de diseño**: `pauseServicesFrom` es la palanca que usa `jobs/materialize.ts` y el
  worker (`recurring-plans.ts`) para dejar de generar visitas de un cliente sin borrar su
  historial ni sus planes. `deleteCustomerWithRelations`
  (`src/lib/customers/delete-customer.ts`) borra a mano `Job` y `ServicePlan` **antes** que al
  `Customer`, porque `Job.propertyId`/`ServicePlan.propertyId` son `Restrict` contra `Property`
  y una cascada `Customer -> Property` fallaría si aún quedaran jobs/planes apuntando a esa
  propiedad.

### Property

- **Campos**: `customerId`, `name?`, `address`, `poolType?`, `poolVolumeGallons?`, `waterType?`,
  `surfaceType?`, `filterType?`, `pumpType?`, `heaterType?`, `hasSpa` (default `false`),
  `sanitizerType?`, `accessInfo?`, `locationNotes?`, `serviceStartDate?`, `paymentDay?`,
  `servicePrice?: Decimal(10,2)`, `paymentType?`, `paymentNotes?`, `equipmentDetails?`,
  `referencePhotos?: Json`, **`lat?: Float`, `lng?: Float`, `geocodedAt?`**.
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. Hijos: `jobs Job[]`
  (referencian esta `Property` con `onDelete: Restrict`, ver más abajo), `servicePlans
  ServicePlan[]` (idem, `Restrict`).
- **Índices**: `@@index([customerId])`.
- **Notas de diseño**: `lat`/`lng`/`geocodedAt` se añadieron en la migración
  `20260917000211_property_geocode` para persistir el resultado de la geocodificación
  (`src/lib/routing/geo.ts`) y no volver a llamar a la API de Google en cada plan de rutas;
  `geocodedAt` sirve para invalidar coordenadas de más de 365 días. `referencePhotos` (Json) está
  en el schema desde la primera migración pero **no se lee ni se escribe en ningún módulo de
  `src/` hoy** — ver §3.

### Job

- **Campos**: `customerId`, `propertyId`, `technicianId?`, `serviceTierId?`, `scheduledDate`,
  `status: JobStatus` (default `SCHEDULED`), `type: JobType` (default `ROUTINE`), `priority:
  JobPriority` (default `NORMAL`), `serviceType: ServiceType` (default `WEEKLY_CLEANING`),
  `estimatedDurationMinutes?`, `sortOrder?`, `notes?`, `customerNotes?`, `checklist?: Json`,
  `planId?`, `startedAt?`, `completedAt?`, `requestedAt?`, `requestedByUserId?`.
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. `propertyId -> Property`:
  **Restrict** (no se puede borrar una `Property` con jobs). `technicianId -> Technician`:
  **SetNull**. `serviceTierId -> ServiceTier`: **SetNull**. `planId -> ServicePlan`: **SetNull**.
  `requestedByUserId -> User` (`UserRequestedJobs`): **SetNull**. Hijos: `photos JobPhoto[]`
  (Cascade, ver abajo), `invoices Invoice[]` (este lado `Invoice.jobId` es **SetNull**),
  `digestItems TechDigestItem[]` (Cascade), `emailLogs EmailLog[]` (`EmailLog.jobId` es
  **SetNull**).
- **Índices**: `@@index([scheduledDate])`, `@@index([technicianId, scheduledDate])`,
  `@@index([customerId, scheduledDate])`, `@@index([status])`, `@@index([serviceTierId])`.
- **Notas de diseño**: no hay `@@unique` sobre `(planId, scheduledDate)` — la deduplicación de
  jobs generados por un plan recurrente es una comprobación de aplicación
  (`materializeServicePlanJob` hace `findFirst` antes de crear), no una restricción de base de
  datos. `notes` lleva el marcador de texto `[Auto generated recurring job]` cuando el job viene
  de un `ServicePlan` (no es un campo booleano separado).

### ServiceTier

- **Campos**: `name`, `checklist?: Json`, `isActive` (default `true`).
- **Relaciones**: `jobs Job[]`, `plans ServicePlan[]` (ambos `SetNull` al borrar el tier, ver
  arriba).
- **Índices/únicos**: `@@unique([name])`.
- **Notas**: `src/lib/service-tiers.ts` crea 3 tiers por defecto (Standard/Gold/Premium) la
  primera vez que se consulta la tabla vacía (`ensureServiceTiers`).

### ServicePlan

- **Campos**: `customerId`, `propertyId`, `technicianId?`, `serviceTierId?`, `name`, `frequency:
  PlanFrequency`, `serviceType: ServiceType`, `priority: JobPriority` (default `NORMAL`),
  `nextRunAt`, `preferredTime?`, `estimatedDurationMinutes?`, `checklist?: Json`, `notes?`,
  `isActive` (default `true`).
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. `propertyId -> Property`:
  **Restrict**. `technicianId -> Technician`: **SetNull**. `serviceTierId -> ServiceTier`:
  **SetNull**. Hijo: `jobs Job[]` (`Job.planId` **SetNull**, un plan borrado no borra sus jobs ya
  generados).
- **Índices**: `@@index([isActive, nextRunAt])` (el que usa el worker para elegir planes a
  materializar), `@@index([customerId])`, `@@index([propertyId])`, `@@index([technicianId])`.

### JobPhoto

- **Campos**: `jobId`, `takenAt` (default `now()`), `uploadedAt` (default `now()`), `url`,
  `visibleToCustomer` (default `true`), `uploadedByUserId?`.
- **Relaciones y onDelete**: `jobId -> Job`: **Cascade**.
- **Índices**: `@@index([jobId])`.
- **Nota de diseño**: `uploadedByUserId` **no tiene relación Prisma/FK** hacia `User` (a
  diferencia de `CustomerDocument.uploadedByUserId`, que sí la tiene) — es un `String?` suelto,
  sin integridad referencial a nivel de base de datos.

### Invoice

- **Campos**: `customerId`, `jobId?`, `number` (`@unique`), `status: InvoiceStatus` (default
  `DRAFT`), `theme: InvoiceTheme` (default `STANDARD`), **`lineItems?: Json`**, `notes?`,
  `subtotal: Decimal(10,2)`, `tax: Decimal(10,2)` (default `0`), `total: Decimal(10,2)`,
  `pdfUrl?`, `sentAt?`, `paidAt?`.
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. `jobId -> Job`: **SetNull**
  (una invoice sobrevive al job que la originó).
- **Índices**: `@@index([status])`, `@@index([customerId])`, `@@index([createdAt])`.
- **Corrección respecto a la documentación anterior**: `lineItems` **no es una entidad
  separada** — es una columna `Json` con la lista de conceptos/montos, normalizada por
  `src/lib/invoices/line-items.ts`. No existe una tabla `InvoiceLineItem`.

### CustomerDocument

- **Campos**: `customerId`, `uploadedByUserId?`, `title`, `description?`, `category` (default
  `"GENERAL"`), `fileUrl`, `mimeType?`, `sizeBytes?`.
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. `uploadedByUserId -> User`
  (`CustomerDocumentUploader`): **SetNull**.
- **Índices**: `@@index([customerId, createdAt])`, `@@index([uploadedByUserId, createdAt])`.

### Notification

- **Campos**: `customerId?`, **`recipientUserId?`**, `recipientRole: Role` (default `CUSTOMER`),
  `channel: NotificationChannel` (default `EMAIL`), `eventType` (string libre, catálogo fijado en
  código, no en el schema), `severity: NotificationSeverity` (default `INFO`), `status:
  NotificationStatus` (default `QUEUED`), `attempts` (default `0`), `lastAttemptAt?`, `payload?:
  Json`, `sentAt?`, `readAt?`, `actorUserId?`. **No tiene `updatedAt`** (a diferencia de casi
  todos los demás modelos), solo `createdAt`.
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. `actorUserId -> User`
  (`NotificationActor`): **SetNull**.
- **Índices**: `@@index([recipientRole, createdAt])`, `@@index([customerId, createdAt])`,
  `@@index([recipientUserId, createdAt])`, `@@index([actorUserId])`.
- **Notas de diseño**:
  - `customerId` es opcional a propósito: una notificación `ADMIN` o `TECH` puede no estar ligada
    a ningún cliente.
  - `recipientUserId` se añadió en la migración `20260917000114_notification_recipient_column`
    (antes el destinatario TECH viajaba solo dentro de `payload.recipientUserId`); la migración
    hizo un backfill desde el JSON y hoy es la columna indexada que usa
    `src/lib/notifications/tech.ts`. El código (`src/lib/notifications/create.ts`) todavía
    escribe una copia en `payload.recipientUserId` "por compatibilidad con lectores anteriores"
    — es decir, el dato está duplicado (columna + JSON) de forma deliberada y temporal.
  - `PROCESSING` (valor de `NotificationStatus`) es el estado que usa
    `src/lib/worker/customer-notifications.ts` para reclamar un lote antes de enviarlo por
    correo; una fila `PROCESSING` de más de 10 minutos se considera huérfana (proceso caído a
    mitad de envío) y se recupera a `QUEUED` o se marca `FAILED` si ya agotó sus reintentos.

### NotificationPreference

- **Campos**: `userId`, `eventType`, `enabled` (default `true`).
- **Relaciones y onDelete**: `userId -> User`: **Cascade**.
- **Índices/únicos**: `@@unique([userId, eventType])` (upsert natural para el opt-out).

### TechDigest

- **Campos**: `technicianId`, `routeDate`, `window: DigestWindow`, `scheduledFor`, `status:
  NotificationStatus` (default `QUEUED`), `sentAt?`.
- **Relaciones y onDelete**: `technicianId -> Technician`: **Cascade**. Hijos: `items
  TechDigestItem[]` (`TechDigestItem.digestId` es **SetNull**), `emailLogs EmailLog[]`
  (`EmailLog.digestId` es **SetNull**).
- **Índices/únicos**: **`@@unique([technicianId, routeDate, window])`**, `@@index([technicianId,
  routeDate])`.
- **Nota de diseño**: la restricción única es la que impide enviar dos veces el mismo digest
  (plan diario o cambios) al mismo técnico el mismo día. Se agregó en la migración
  `20260917000011_tech_digest_unique`, que **antes** de crear el índice dedupe las filas
  existentes (reapunta `TechDigestItem`/`EmailLog` de los digests sobrantes al más reciente y
  borra los duplicados) — es decir, la unicidad no existía desde el inicio y hubo que limpiar
  datos para poder imponerla.

### TechDigestItem

- **Campos**: `technicianId`, `jobId`, `routeDate`, `changeType` (string libre:
  `ROUTE_ASSIGNED`/`JOB_ASSIGNED`/`JOB_UNASSIGNED`/`JOB_RESCHEDULED`/`ROUTE_REORDERED`), `payload?:
  Json`, `digestId?`. Solo `createdAt`, sin `updatedAt`.
- **Relaciones y onDelete**: `technicianId -> Technician`: **Cascade**. `jobId -> Job`:
  **Cascade**. `digestId -> TechDigest`: **SetNull** (un item puede existir antes de que se arme
  su digest).
- **Índices**: `@@index([technicianId, routeDate])`, `@@index([jobId])`.

### EmailLog

- **Campos**: `recipientEmail`, `recipientName?`, **`recipientRole: String`** (no es el enum
  `Role`; ver nota), `subject`, `bodyText`, `bodyHtml?`, `status: NotificationStatus` (default
  `QUEUED`), `attempts` (default `0`), `errorMessage?`, `sentAt?`, `customerId?`,
  `technicianId?`, `jobId?`, `digestId?`, `metadata?: Json`.
- **Relaciones y onDelete**: `customerId -> Customer`: **Cascade**. `technicianId ->
  Technician`: **SetNull**. `jobId -> Job`: **SetNull**. `digestId -> TechDigest`: **SetNull**.
- **Índices**: `@@index([createdAt])`, `@@index([customerId])`, `@@index([technicianId])`,
  `@@index([jobId])`.
- **Nota de diseño**: `recipientRole` es un `String` plano, no el enum `Role`, porque el código
  (`MailRecipientRole` en `src/lib/mail/transport.ts`) admite un cuarto valor, `"USER"`, para
  correos que no calzan con ningún rol de negocio (p. ej. un reseteo de contraseña antes de que
  el destinatario tenga sesión). `sendMailAndLog` escribe **una fila por cada intento de envío**,
  sea éxito o fallo — es el registro de auditoría de todo lo que salió (o intentó salir) por
  correo.

### AuditLog

- **Campos**: `userId?`, **`actorEmail?`**, **`actorName?`**, `action`, `entity`, `entityId?`,
  `metadata?: Json`.
- **Relaciones y onDelete**: `userId -> User`: **SetNull**.
- **Índices**: `@@index([createdAt])`, `@@index([userId, createdAt])`, `@@index([entity,
  entityId])`.
- **Nota de diseño**: `actorEmail`/`actorName` se añadieron junto con volver `userId` opcional
  (migración `on_delete_rules`) precisamente para que el registro de auditoría **sobreviva** al
  borrado del usuario que hizo la acción — `src/lib/audit/log.ts` los resuelve leyendo `User` en
  el momento de escribir si el llamador no los pasó explícitamente, y los deja en `null` si esa
  lectura falla. Es el único modelo del que `deleteCustomerWithRelations` explícitamente **no
  toca** ninguna fila.

### PasswordResetToken

- **Campos**: `userId`, `token` (`@unique`), `purpose: ResetTokenPurpose` (default
  `PASSWORD_RESET`), `expiresAt`, `usedAt?`.
- **Relaciones y onDelete**: `userId -> User`: **Cascade**.
- **Índices**: `@@index([userId, createdAt])`, `@@index([purpose, userId, createdAt])`,
  `@@index([expiresAt, usedAt])`.
- **Nota de diseño**: `token` guarda el **hash SHA-256** del token real (`src/lib/auth/reset-token.ts`),
  no el token en claro — eso es una convención de la aplicación, no algo que el schema exprese.

### RateLimitBucket

- **Campos**: `key` (`@id`, string natural — no `cuid()`), `count`, `resetAt`, `createdAt`
  (default `now()`), `updatedAt` (default `now()` **y** `@updatedAt` a la vez).
- **Relaciones**: ninguna; tabla independiente.
- **Índices**: `@@index([resetAt])`.
- **Nota de diseño**: la clave (`key`) codifica el ámbito del límite (p. ej.
  `auth:login:ip:203.0.113.4`), no es un id opaco. `updatedAt` con `@default(now())` además de
  `@updatedAt` es redundante (Prisma ya gestiona `@updatedAt` en cada escritura) pero inofensivo.

### SiteSettings

- **Campos**: `id` (`@id @default("default")`, fila única), `instagramUrl?`, `facebookUrl?`,
  `whatsappUrl?`, `xUrl?`, `youtubeUrl?`, `tiktokUrl?`, `landingYoutubeUrl?`,
  `landingPromoCopy?: Json`, `emailTemplates?: Json`, `invoiceTemplate?: Json`,
  `routeAssistantConfig?: Json`, `complianceContent?: Json`.
- **Relaciones**: ninguna.
- **Notas de diseño**: es el **CMS** de la aplicación — todo texto/plantilla editable desde
  `/admin/settings` vive aquí como JSON, leído con `unstable_cache` (`revalidate: 300`, tag
  `site-settings`) por `src/lib/site-settings.ts`. Ver §3 para el módulo que normaliza cada
  columna.

### PublicIntegrationResponse

- **Campos**: `token`, `clientName`, `clientEmail`, `companyName?`, `decision:
  PublicIntegrationDecision`, `acceptTerms` (default `false`), `comments?`, `signatureDataUrl`
  (`@db.Text`, dataURL de la firma dibujada), `userAgent?`, `ipAddress?`.
- **Relaciones**: ninguna (respuesta pública anónima, sin FK a `User`/`Customer`).
- **Índices/únicos**: `@@unique([token, clientEmail])`, `@@index([token, createdAt])`.
- **Nota de diseño**: `token` no es un FK a ninguna tabla — los tokens válidos son una constante
  en código (`src/lib/public-integrations.ts#ALLOWED_PUBLIC_INTEGRATION_TOKENS`), no filas en
  base de datos.

## 3. Columnas `Json` y qué módulo las normaliza

| Modelo.columna | Normalizador / consumidor |
| --- | --- |
| `Property.referencePhotos` | **Ninguno.** Presente desde la primera migración; no hay lectura ni escritura en `src/` hoy (columna sin uso en código de aplicación). |
| `Job.checklist` | `src/lib/service-tiers.ts#normalizeChecklist`, invocado desde `src/lib/jobs/materialize.ts` |
| `ServiceTier.checklist` | `src/lib/service-tiers.ts#normalizeChecklist` |
| `ServicePlan.checklist` | `src/lib/service-tiers.ts#normalizeChecklist` (snapshot tomado del `ServiceTier` al materializar el job) |
| `Invoice.lineItems` | `src/lib/invoices/line-items.ts` |
| `Notification.payload` | Sin schema fijo; lectura defensiva con `src/lib/worker/payload.ts` (`asRecord`/`readString`/`readDate`) y presentación con `src/lib/notifications/view.ts` |
| `TechDigestItem.payload` | Igual patrón; construido en `jobs/materialize.ts` / `jobs/lifecycle.ts`, leído por `src/lib/worker/tech-digest-content.ts` |
| `AuditLog.metadata` | Libre — cada llamador arma su propio objeto; `src/lib/audit/log.ts` solo lo persiste tal cual |
| `EmailLog.metadata` | Libre — `src/lib/mail/transport.ts#buildLogMetadata` añade `template`/`attempts` sobre lo que pase el llamador |
| `SiteSettings.landingPromoCopy` | `src/lib/landing-config.ts#normalizeLandingPromoCopy` |
| `SiteSettings.emailTemplates` | `src/lib/email-templates.ts#normalizeEmailTemplates` / `normalizeLocalizedEmailTemplates` |
| `SiteSettings.invoiceTemplate` | `src/lib/invoice-template.ts#normalizeInvoiceTemplateConfig` |
| `SiteSettings.routeAssistantConfig` | Función interna `normalizeRouteAssistantConfig` en `src/lib/site-settings.ts` (no exportada) |
| `SiteSettings.complianceContent` | `src/lib/compliance-config.ts#normalizeComplianceContent` / `normalizeComplianceDocContent` |

## 4. Mapa de referencias `onDelete` (vista rápida)

| Hijo.columna | Padre | Regla |
| --- | --- | --- |
| `Technician.userId` | `User` | Cascade |
| `Customer.userId` | `User` | SetNull |
| `Job.requestedByUserId` | `User` | SetNull |
| `AuditLog.userId` | `User` | SetNull |
| `PasswordResetToken.userId` | `User` | Cascade |
| `NotificationPreference.userId` | `User` | Cascade |
| `Notification.actorUserId` | `User` | SetNull |
| `CustomerDocument.uploadedByUserId` | `User` | SetNull |
| `JobPhoto.uploadedByUserId` | — | **Sin relación Prisma** (String suelto) |
| `Property.customerId` | `Customer` | Cascade |
| `Job.customerId` | `Customer` | Cascade |
| `ServicePlan.customerId` | `Customer` | Cascade |
| `Invoice.customerId` | `Customer` | Cascade |
| `CustomerDocument.customerId` | `Customer` | Cascade |
| `Notification.customerId` | `Customer` | Cascade |
| `EmailLog.customerId` | `Customer` | Cascade |
| `Job.propertyId` | `Property` | **Restrict** |
| `ServicePlan.propertyId` | `Property` | **Restrict** |
| `Job.technicianId` | `Technician` | SetNull |
| `ServicePlan.technicianId` | `Technician` | SetNull |
| `TechDigest.technicianId` | `Technician` | Cascade |
| `TechDigestItem.technicianId` | `Technician` | Cascade |
| `EmailLog.technicianId` | `Technician` | SetNull |
| `Job.serviceTierId` | `ServiceTier` | SetNull |
| `ServicePlan.serviceTierId` | `ServiceTier` | SetNull |
| `Job.planId` | `ServicePlan` | SetNull |
| `JobPhoto.jobId` | `Job` | Cascade |
| `Invoice.jobId` | `Job` | SetNull |
| `TechDigestItem.jobId` | `Job` | Cascade |
| `EmailLog.jobId` | `Job` | SetNull |
| `TechDigestItem.digestId` | `TechDigest` | SetNull |
| `EmailLog.digestId` | `TechDigest` | SetNull |

`Restrict` en `Property` es la razón por la que `src/lib/customers/delete-customer.ts` borra
`Job` y `ServicePlan` **a mano, antes** de borrar `Customer`: una cascada `Customer -> Property`
fallaría con esas dos tablas todavía apuntando a la propiedad.

## 5. Índices únicos, de un vistazo

| Modelo | Único |
| --- | --- |
| `User` | `email` |
| `Technician` | `userId` |
| `Customer` | `userId` (nulo permitido) |
| `Invoice` | `number` |
| `ServiceTier` | `name` |
| `NotificationPreference` | `(userId, eventType)` |
| `TechDigest` | `(technicianId, routeDate, window)` |
| `PasswordResetToken` | `token` |
| `RateLimitBucket` | `key` (es el `@id`) |
| `PublicIntegrationResponse` | `(token, clientEmail)` |

`Customer.email` **no** está en esta lista a propósito: solo tiene índice simple
(`@@index([email])`), no restricción de unicidad.
