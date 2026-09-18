# Backlog V1 (Epics)

> **Estado a 18 sep 2026**: los 7 epics de abajo están implementados. Se sumó trabajo no listado
> aquí: planes recurrentes con materialización automática (worker cron), asistente de rutas con
> geocodificación persistida, digests de técnico y notificaciones en tiempo real (Pusher con
> fallback SSE), PWA instalable, i18n EN/ES, portal de cliente ampliado (repositorio de
> documentos, disponibilidad on-demand) y auditoría (`AuditLog`) de acciones administrativas. Ver
> `docs/Architecture.md` y `docs/DataModel.md` para el detalle técnico actual.

## Epic 1: Autenticacion y roles
- Login con usuario y contrasena
- Roles: admin, tecnico, cliente
- Proteccion de rutas

## Epic 2: Administracion de clientes
- CRUD de clientes
- Perfil del cliente y propiedades
- Estado de cuenta

## Epic 3: Gestion de rutas y trabajos
- Crear rutas por tecnico
- Reordenar clientes
- Estados y timestamps de trabajos

## Epic 4: Evidencias fotograficas
- Subida obligatoria al completar trabajo
- Historial visual por trabajo

## Epic 5: Portal del cliente
- Historial de servicios
- Evidencias y documentos
- Invoices y estados
- Solicitud de servicio rapido (on-demand)

## Epic 6: Invoices
- Crear invoice y PDF
- Enviar por email
- Historial por cliente

## Epic 7: Notificaciones
- Email al completar trabajo
- Registro de envio
