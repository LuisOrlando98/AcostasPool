# 0003 - Playwright para PDF de invoice, con fallback a pdf-lib

## Estado

Aceptada (en producción).

## Contexto

El PDF de invoice debe reflejar fielmente una plantilla HTML/CSS editable por el admin
(`SiteSettings.invoiceTemplate`, ver ADR 0004), con temas (`STANDARD`/`SPECIAL`/`ESTIMATE`,
incluida una marca de agua) y texto localizado (EN/ES). Renderizar ese HTML con fidelidad visual
alta requiere un motor de navegador real; pero Playwright/Chromium es una dependencia binaria
pesada que exige un paso de instalación explícito (`npx playwright install chromium`) y puede no
estar disponible en todos los entornos donde se genera un PDF.

## Decisión

`src/lib/invoices/pdf.ts#generateInvoicePdfBytes` intenta primero renderizar la plantilla HTML
(`src/lib/invoice-template.ts#renderInvoiceTemplateHtml`) con Chromium headless vía Playwright
(`page.setContent` + `page.pdf({ format: "A4", printBackground: true, ... })`). Si el `import`
dinámico de `"playwright"` falla o el navegador no lanza, el `catch` registra el error en
consola y regenera el mismo invoice con `generateInvoicePdfWithPdfLibBytes`, que dibuja el
documento a mano con primitivas de `pdf-lib` (fuentes estándar, rectángulos, texto posicionado,
marca de agua rotada para `ESTIMATE`). El resultado de cualquiera de los dos caminos se guarda
con la misma función (`storePublicAsset`) en la misma ruta
(`buildInvoicePdfAssetPath`). Un segundo generador de PDF, el acuerdo de servicio
(`src/lib/service-agreement-pdf.ts`), es **solo `pdf-lib`** y no participa de esta decisión (no
tiene una versión Playwright ni la necesita: su contenido es estático).

## Consecuencias

- Positivo: fidelidad visual alta en el camino feliz (HTML/CSS real); la operación de negocio
  (guardar o enviar el invoice) nunca falla solo porque Chromium no esté instalado — se degrada
  a un PDF más simple pero funcional, en vez de romper el flujo de facturación.
- Negativo: existen **dos implementaciones de layout independientes** (la plantilla HTML/CSS y el
  dibujo manual en `pdf-lib`) que pueden divergir visualmente con el tiempo si solo se actualiza
  una; probar el camino de fallback exige forzar el fallo de Chromium a propósito (no hay un
  test que lo ejercite automáticamente en el CI actual, que sí instala Chromium). Cualquier
  cambio de plantilla debe revisarse en ambos renderizadores si se quiere que el fallback siga
  siendo una aproximación razonable del PDF principal.
