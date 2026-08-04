import type { Metadata, Viewport } from "next";
import { Fraunces, Sora, Kantumruy_Pro } from "next/font/google";
import "./globals.css";

// Modern sans for UI (Techo side).
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Elegant serif for display titles (Rumduol side).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

// Khmer-capable partner for bilingual text.
const kantumruy = Kantumruy_Pro({
  subsets: ["khmer", "latin"],
  variable: "--font-khmer",
  display: "swap",
});

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
  themeColor: "#0E2A5E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sora.variable} ${fraunces.variable} ${kantumruy.variable}`}
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
