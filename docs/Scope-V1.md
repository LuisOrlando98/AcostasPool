# Alcance Funcional V1

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
