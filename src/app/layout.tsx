import type { Metadata, Viewport } from "next";
import { Manrope, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { getMessages } from "@/i18n/translate";
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
      { url: "/newlogo.png", type: "image/png" },
      { url: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/newlogo.png"],
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AcostasPool",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);

  return (
    <html lang={locale}>
      <body
        className={`${manrope.variable} ${playfair.variable} ${jetbrains.variable} antialiased`}
      >
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
