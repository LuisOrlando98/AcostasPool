import path from "path";

/**
 * Política de seguridad de contenido, por ahora solo en modo report-only: los
 * orígenes salen de un repaso del código (Google Maps JS, Pusher por WebSocket,
 * embeds de YouTube sin cookies y de OpenStreetMap). Las fuentes se sirven desde
 * el propio dominio vía `next/font`, pero se dejan los orígenes de Google Fonts
 * por si se añade una hoja remota. `unsafe-inline`/`unsafe-eval` siguen aquí
 * porque Next inyecta scripts de hidratación sin nonce.
 */
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
  "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com wss://*.pusherapp.com https://maps.googleapis.com https://maps.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com https://www.google.com https://www.openstreetmap.org",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /**
   * Compatibilidad con los archivos históricos que ya están dentro de `public/`
   * (`public/uploads`, `public/invoices`): se reescriben a la API autenticada
   * antes de consultar el sistema de archivos, de modo que un enlace directo
   * antiguo siga funcionando pero deje de ser una descarga anónima. Los avatares
   * siguen siendo públicos a propósito.
   */
  rewrites: async () => ({
    beforeFiles: [
      { source: "/uploads/:path*", destination: "/api/files/uploads/:path*" },
      { source: "/invoices/:path*", destination: "/api/files/invoices/:path*" },
    ],
    afterFiles: [],
    fallback: [],
  }),
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Content-Security-Policy-Report-Only",
          value: contentSecurityPolicyReportOnly,
        },
        ...(process.env.NODE_ENV === "production"
          ? [
              {
                key: "Strict-Transport-Security",
                value: "max-age=31536000; includeSubDomains; preload",
              },
            ]
          : []),
      ],
    },
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, no-cache, must-revalidate",
        },
      ],
    },
    {
      // Facturas, documentos, fotos y repositorio se sirven por `/api/files`
      // tras autorizar: ninguna capa intermedia debe guardar copia.
      source: "/uploads/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store",
        },
      ],
    },
    {
      source: "/invoices/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store",
        },
      ],
    },
    {
      source: "/api/files/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-store",
        },
      ],
    },
    {
      // Los avatares siguen siendo públicos e inmutables (baja sensibilidad).
      source: "/avatars/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/_next/static/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/_next/image",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400, stale-while-revalidate=604800",
        },
      ],
    },
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(process.cwd(), "src"),
    };
    return config;
  },
};

export default nextConfig;
