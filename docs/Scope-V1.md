# Alcance Funcional V1

> **Estado a 18 sep 2026**: los módulos y estados listados abajo siguen vigentes y ya están
> implementados en producción (Render, no solo local). Se ampliaron con prioridad de trabajo
> (`JobPriority`), niveles de servicio (`ServiceTier`) y planes recurrentes materializados
> automáticamente por el worker cron; asistente de rutas con geocodificación persistida;
> notificaciones en tiempo real (Pusher/SSE) y digests de técnico además del email; PWA
> instalable e i18n EN/ES. Ver `docs/Architecture.md` y `docs/adr/` para el detalle.

## Modulos
- Autenticacion y roles
- Administracion de clientes
- Registro de clientes (auto-registro e invitacion)
- Administracion de tecnicos
- Gestion de rutas diarias
- Gestion de trabajos y estados
- Evidencias fotograficas
- Invoices y envio por correo
- Portal del cliente
- Solicitud de servicios rapidos (on-demand)
- Notificaciones por email
- Auditoria basica de acciones

## Estados de trabajo
- `scheduled`: trabajo programado para otro dia
- `pending`: trabajo del dia, no es el siguiente en ruta
- `on_the_way`: proximo cliente en la ruta
- `in_progress`: trabajo iniciado
- `completed`: trabajo finalizado con foto obligatoria

## Tipos de trabajo
- `ROUTINE`: servicio programado
- `ON_DEMAND`: solicitud rapida del cliente

## Estados de invoice
- `draft`
- `sent`
- `paid`
- `overdue`

## Canales de notificacion
- Email (V1)
