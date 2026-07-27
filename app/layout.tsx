import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TecnoVerifiche",
  description: "Gestionale interno per verifiche di tarature",
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