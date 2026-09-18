# 0004 - SiteSettings como CMS en columnas JSON

## Estado

Aceptada (en producción).

## Contexto

Varios contenidos deben poder cambiar sin un deploy: textos de invoice, plantillas de email
(`EMAIL_TEMPLATE_IDS`), copy de la landing (EN/ES), contenido legal/de cumplimiento, la bandera
`dailyAutoOptimizeEnabled` del asistente de rutas, y enlaces de redes sociales. Ninguno de estos
dominios justifica, por separado, una tabla propia con su propio ciclo de migraciones — son
config editable por el admin, no entidades de negocio con relaciones.

## Decisión

Un único modelo `SiteSettings` con **una fila fija** (`id @default("default")`) y una columna
`Json` por dominio (`landingPromoCopy`, `emailTemplates`, `invoiceTemplate`,
`routeAssistantConfig`, `complianceContent`), más columnas simples para enlaces sociales. Cada
columna `Json` tiene un módulo normalizador dedicado y puro (`src/lib/landing-config.ts`,
`email-templates.ts`, `invoice-template.ts`, `compliance-config.ts`, y una función interna para
`routeAssistantConfig` en `src/lib/site-settings.ts`) que aplica valores por defecto y sanea la
forma del JSON antes de usarlo, de modo que un documento parcial, viejo o corrupto nunca rompe el
render. La lectura pasa por `unstable_cache` (`revalidate: 300`, tag `site-settings`); cada
guardado invalida esa caché con `revalidateTag`.

## Consecuencias

- Positivo: un solo lugar para todo el contenido editable, sin migraciones nuevas por cada campo
  de texto nuevo; los normalizadores hacen que agregar un campo a una plantilla sea seguro incluso
  contra filas antiguas que no lo tienen todavía. El worker reutiliza el mismo patrón de
  normalización (`src/lib/worker/email-templates.ts`) leyendo la fila directamente (sin
  `unstable_cache`, que no funciona fuera del runtime de Next) con su propia caché por TTL.
- Negativo: no hay esquema de base de datos que valide la forma del JSON — el normalizador en
  código es la única red de seguridad; un bug ahí puede pasar desapercibido hasta el render. No
  queda historial de versiones anteriores del contenido (guardar sobrescribe); si se necesitara
  auditar "quién cambió qué plantilla y cuándo" habría que añadirlo explícitamente (hoy no está).
