# 0002 - Pusher con fallback SSE en memoria

## Estado

Aceptada (en producción).

## Contexto

Admin, técnicos y clientes necesitan recibir notificaciones (`Notification`) en tiempo real en
el navegador sin recargar la página, pero el proyecto no puede exigir credenciales de un
proveedor externo configuradas desde el primer despliegue o en cada entorno de desarrollo/CI.

## Decisión

`src/lib/notifications/realtime.ts#publishNotification` intenta primero **Pusher**: si
`PUSHER_APP_ID`/`PUSHER_KEY`/`PUSHER_SECRET`/`PUSHER_CLUSTER` están configuradas, resuelve el o
los destinatarios (admins activos, el `User` del `Customer`, o `Notification.recipientUserId`
para TECH) y dispara un evento al canal privado `private-user-{userId}`, autorizado por
`src/app/api/notifications/pusher-auth/route.ts` (que solo deja a una sesión autorizar su propio
canal). Si Pusher no está configurado, cae automáticamente a
`src/lib/notifications/bus.ts#broadcastNotification`, un `Map` de suscriptores en memoria del
propio proceso, consumido por el endpoint SSE `src/app/api/notifications/stream/route.ts`.

## Consecuencias

- Positivo: funciona sin configuración adicional en desarrollo, CI o una demo rápida; degrada con
  gracia en vez de romper (`src/lib/config/env.ts` solo emite una advertencia `[env]`, nunca
  bloquea el arranque). El cliente del navegador (`src/lib/notifications/client-alert.ts`) no
  necesita saber cuál de los dos canales está activo.
- Negativo: el bus en memoria es **por instancia de proceso** — con más de una instancia del
  servicio web (o tras un simple restart), un evento publicado en una instancia no llega a los
  navegadores conectados por SSE a otra. Es una limitación conocida, no un error: escalar el
  servicio web horizontalmente sin configurar Pusher degradaría notificaciones en tiempo real de
  forma silenciosa (sin ningún error visible, solo eventos que nunca llegan a ciertos clientes).
