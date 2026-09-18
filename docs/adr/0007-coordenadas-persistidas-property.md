# 0007 - Coordenadas persistidas en Property

## Estado

Aceptada (en producción).

## Contexto

El asistente de rutas (`src/lib/routing/planner.ts`) necesita coordenadas para estimar
distancias y tiempos de viaje entre paradas. Geocodificar una dirección en cada solicitud de plan
es lento (una llamada de red por dirección sin geocodificar) y consume cuota de la API de
Geocoding de Google; recalcularlo en cada plan del día es trabajo repetido sobre datos que casi
nunca cambian (la dirección de una propiedad rara vez se edita).

## Decisión

Persistir `lat`, `lng` y `geocodedAt` directamente en `Property` (migración
`20260917000211_property_geocode`). `src/lib/routing/geo.ts#geocodeProperties` reutiliza esas
coordenadas mientras `geocodedAt` tenga menos de `PERSISTED_COORDINATES_MAX_AGE_MS` (365 días);
solo geocodifica las propiedades sin coordenadas vigentes, usando la API de Google
(`GOOGLE_MAPS_SERVER_API_KEY`) con **Nominatim/OpenStreetMap como respaldo** cuando no hay API key
de servidor configurada, y guarda los aciertos nuevos de vuelta en `Property` de forma
best-effort (un fallo al persistir se registra pero no interrumpe el plan en curso). Un caché en
memoria acotado (`GEOCODE_CACHE_MAX_ENTRIES = 2000`) evita golpear la base de datos o la API
externa dos veces por la misma dirección dentro del mismo proceso.

## Consecuencias

- Positivo: los planes de ruta son rápidos en el caso común (la mayoría de propiedades ya
  georreferenciadas de una corrida anterior); menor consumo de cuota de la API de Google; el
  asistente sigue funcionando (con Nominatim) incluso sin API key de servidor configurada, en vez
  de quedar inutilizable.
- Negativo: editar la dirección de una propiedad no revalida sus coordenadas de inmediato —
  quedan potencialmente desactualizadas hasta el próximo re-geocode manual o hasta cumplir los
  365 días. El caché en memoria del proceso se pierde en cada restart/deploy, así que el primer
  plan de rutas tras un despliegue paga el costo completo de geocodificación de lo que aún no
  esté persistido en `Property`.
