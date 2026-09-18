-- Ajuste de integración: aplica al esquema introducido por preview (contratos, Stripe,
-- membresías, token de pago de factura) las dos reglas transversales de fix/revision-2026-09:
--
--  1. TIMESTAMPTZ(3) en todas las columnas DateTime. Igual que en 20260917000426_timestamptz,
--     los valores existentes son instantes UTC escritos por la app, así que cada conversión
--     lleva USING "col" AT TIME ZONE 'UTC'; sin él PostgreSQL los reinterpretaría en la zona
--     de la sesión y desplazaría cada instante.
--  2. onDelete explícito en el esquema, sin cambiar ninguna FK. ServiceContract,
--     Payment y Membership se quedan en RESTRICT sobre Customer, igual que en
--     producción: un cliente con historial financiero o contractual no debe poder
--     borrarse en cascada, el borrado debe fallar y tratarse a mano. Las FKs
--     opcionales (propertyId, invoiceId, membershipId) ya eran SET NULL.
--
-- No se toca el índice único parcial "Membership_active_customer_property_key": Prisma no
-- puede representarlo en el esquema, pero sigue siendo la garantía de que un cliente no tenga
-- dos membresías ACTIVE sobre la misma propiedad.

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "paymentTokenExpiresAt" SET DATA TYPE TIMESTAMPTZ(3) USING "paymentTokenExpiresAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "currentPeriodStart" SET DATA TYPE TIMESTAMPTZ(3) USING "currentPeriodStart" AT TIME ZONE 'UTC',
ALTER COLUMN "currentPeriodEnd" SET DATA TYPE TIMESTAMPTZ(3) USING "currentPeriodEnd" AT TIME ZONE 'UTC',
ALTER COLUMN "canceledAt" SET DATA TYPE TIMESTAMPTZ(3) USING "canceledAt" AT TIME ZONE 'UTC',
ALTER COLUMN "authorizedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "authorizedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "paidAt" SET DATA TYPE TIMESTAMPTZ(3) USING "paidAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "ServiceContract" ALTER COLUMN "periodMonth" SET DATA TYPE TIMESTAMPTZ(3) USING "periodMonth" AT TIME ZONE 'UTC',
ALTER COLUMN "sentAt" SET DATA TYPE TIMESTAMPTZ(3) USING "sentAt" AT TIME ZONE 'UTC',
ALTER COLUMN "clientSignedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "clientSignedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "StripeWebhookEvent" ALTER COLUMN "receivedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "receivedAt" AT TIME ZONE 'UTC',
ALTER COLUMN "processedAt" SET DATA TYPE TIMESTAMPTZ(3) USING "processedAt" AT TIME ZONE 'UTC';
