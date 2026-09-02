import type { Metadata, Viewport } from "next";
import { baseUrl } from "@/lib/url";
import "./globals.css";

export const metadata: Metadata = {
  // Necesario para que las URLs de Open Graph salgan absolutas (A2).
  metadataBase: new URL(baseUrl()),
  title: "Arreglamo",
  description: "Dividí los gastos de la juntada sin instalar nada.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Diseñado para una mano, de pie, con apuro: que no se pueda romper el layout con un
  // doble tap, pero sin bloquear el zoom de accesibilidad.
  maximumScale: 5,
  themeColor: "#1c1917",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
