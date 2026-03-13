import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import SWRegister from "@/components/SWRegister";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: {
    default: "Přístav Radosti",
    template: "%s | Přístav Radosti",
  },
  description: "Neurorehabilitační centrum — klientský portál pro správu terapií, rezervace a zdravotní záznamy.",
  keywords: ["neurorehabilitace", "fyzioterapie", "klientský portál", "rezervace termínů"],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Přístav Radosti",
  },
  openGraph: {
    title: "Přístav Radosti",
    description: "Neurorehabilitační centrum — klientský portál",
    type: "website",
    locale: "cs_CZ",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className={inter.className}>
        <AuthProvider>
          <SWRegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
