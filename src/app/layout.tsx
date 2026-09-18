import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { createTranslator } from "@/i18n/core";
import { loadMessages } from "@/i18n/dictionaries";
import { getRequestLocale } from "@/i18n/server";
import PwaRegister from "@/components/pwa/PwaRegister";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AcostasPool Service Administration System",
  description:
    "Plataforma web para administrar servicios de mantenimiento de piscinas, rutas, evidencias e invoices.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-logo-512.png", sizes: "512x512", type: "image/png" },
      { url: "/newlogo.png", sizes: "512x512", type: "image/png" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/newlogo.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AcostasPool",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  // Necesario para que los env(safe-area-inset-*) de globals.css actúen en iPhone (notch / home bar).
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const messages = await loadMessages(locale);
  const t = createTranslator(messages);

  return (
    <html lang={locale}>
      <body
        className={`${manrope.variable} ${playfair.variable} ${jetbrains.variable} antialiased`}
      >
        {/* Saltar al contenido (WCAG 2.4.1): visible solo con foco de teclado; destino #main-content. */}
        <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
          {t("globalShell.skipToContent")}
        </a>
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
