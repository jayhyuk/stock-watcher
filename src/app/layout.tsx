import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Check — Watchlist",
  description: "Manage your stock watchlist and load live quotes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
