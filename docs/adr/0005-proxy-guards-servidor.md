# 0005 - Proxy de rutas + guards en servidor

## Estado

Aceptada (en producción).

## Contexto

Next.js necesita decidir lo antes posible si una petición a `/admin`, `/tech` o `/client` debe
redirigir a `/login`, pero la única fuente de verdad real sobre permisos (`User.isActive`,
`User.role` vigente, `User.isDeveloper` combinado con la allowlist de
`src/lib/auth/developer.ts`) vive en Postgres, no en la cookie de sesión.

## Decisión

Separar la protección de rutas en dos capas independientes:

1. **`src/proxy.ts`** (runtime Node, Next.js 16 renombró `middleware.ts` a `proxy.ts`), con
   `matcher: ["/admin/:path*", "/tech/:path*", "/client/:path*"]`. Decodifica y verifica la firma
   del JWT de la cookie `ap_session` (`verifySessionToken`) y compara `session.role` contra el
   prefijo de la URL. **Nunca consulta la base de datos.**
2. **`src/lib/auth/guards.ts`** (`requireAuth`, `requireRole(role)`, `requireDeveloper`),
   invocado al inicio de cada Server Component de página **y de nuevo dentro de cada Server
   Action** del mismo archivo (una Server Action es un endpoint público en sí misma, alcanzable
   aunque la página ya esté cargada). Llama a `getSession()`
   (`src/lib/auth/session.ts`), que sí lee `User` desde Prisma para confirmar `isActive` y
   recalcular `isDeveloper` en cada invocación.

## Consecuencias

- Positivo: el caso común (sin cookie, o rol equivocado para la sección) se resuelve con una
  redirección barata sin abrir conexión a la base de datos. La autorización real nunca depende
  solo del contenido de un JWT de hasta 7 días de antigüedad: desactivar una cuenta
  (`isActive = false`) surte efecto de inmediato en el siguiente guard, aunque el token siga
  siendo criptográficamente válido.
- Negativo: mantenimiento duplicado — una sección nueva bajo `/admin`, `/tech` o `/client`
  necesita entrar en el `matcher` de `src/proxy.ts` **y** cada página/Server Action/Route
  Handler debe llamar al guard correspondiente explícitamente; `src/proxy.ts` no protege una
  Server Action ni un Route Handler por sí solo. Olvidar el guard en un handler nuevo lo deja
  expuesto aunque el proxy redirija correctamente la navegación de página.
