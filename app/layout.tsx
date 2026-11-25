import type { Metadata } from "next";
import "./globals.css";
import "./suite.css";

export const metadata: Metadata = {
  title: "Tecnocontrolli · Gestionale Metrologico",
  description:
    "Sistema integrato per la gestione delle Tarature interne, delle Verifiche Interne e delle Tarature LAT.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
