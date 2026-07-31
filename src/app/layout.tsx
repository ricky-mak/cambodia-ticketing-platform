import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Ticketing",
  description: "Cambodia event ticketing system",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Check-in", statusBarStyle: "default" },
  // Stop mobile browsers from auto-linking phone/email/date/address, which
  // mutates the server HTML before hydration and causes mismatch warnings.
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
