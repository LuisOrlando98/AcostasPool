# AcostasPool Service Administration System - V1

## Objetivo
Centralizar la operacion del negocio de servicios a piscinas: rutas de trabajo, evidencias fotograficas e invoices en una plataforma web moderna y organizada.

## Usuarios
- Administrador
- Tecnicos
- Clientes

## Problema que resuelve
- Falta de control centralizado de rutas, estados y evidencias.
- Dificultad para mostrar historial y facturacion a clientes.
- Proceso manual y disperso de notificaciones e invoices.

## Alcance V1
- Plataforma web responsiva (movil, tablet, desktop).
- Rutas diarias por tecnico con estados operativos.
- Evidencias fotograficas obligatorias al completar servicio.
- Portal de cliente con historial y facturacion.
- Solicitud de servicio rapido (on-demand) desde el portal del cliente.
- Notificaciones por email cuando se complete un trabajo.
- Generacion de invoices en PDF y envio por correo.
- Roles y permisos basicos (admin, tecnico, cliente).
- Registro del cliente por auto-registro o invitacion del admin.

## Fuera de alcance V1
- Visualizacion de mapas dentro del sistema.
- Pagos automaticos en linea.
- Integraciones externas complejas (ERP/CRM).

## Metricas de exito
- 100% de servicios con evidencia fotografica.
- Reduccion de errores operativos diarios.
- Clientes pueden consultar historial sin intervencion del admin.

## Supuestos
- Operacion inicial 100% local.
- Emails se envian por SMTP de Microsoft 365.
- Almacenamiento local de fotos en desarrollo.
