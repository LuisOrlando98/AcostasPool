# Modelo de Datos (V1)

## Entidades principales
- User: credenciales, rol y estado.
- Technician: perfil del tecnico (relacion 1:1 con User).
- Customer: perfil del cliente y preferencias.
- Property: datos de piscina y ubicacion.
- Job: visita de servicio, estado, tipo (routine/on-demand) y timestamps.
- JobPhoto: evidencias fotograficas del trabajo.
- Invoice: facturacion en PDF y estados.
- Invoice.lineItems: conceptos y montos.
- Notification: registro de envios y resultado.
- AuditLog: auditoria de acciones clave.

## Relaciones clave
- Customer 1:N Property
- Customer 1:N Job
- Job 1:N JobPhoto
- Customer 1:N Invoice
- User 1:1 Technician (si aplica)
- User 1:1 Customer (si aplica)

## Campos criticos
- Job.scheduledDate
- Job.status
- Job.type
- JobPhoto.url
- Invoice.number, Invoice.status, Invoice.total

## Datos generales de piscina (Property)
- Direccion
- Tipo de piscina
- Volumen (galones)
- Tipo de agua (cloro/sal)
- Superficie
- Filtro, bomba y calentador
- Spa (si/no)
- Sanitizacion
