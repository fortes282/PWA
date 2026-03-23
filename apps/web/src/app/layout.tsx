import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/app/components/Toast";
import SWRegister from "@/components/SWRegister";
import OfflineBanner from "@/components/OfflineBanner";
import AnimatedPages from "@/components/AnimatedPages";

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
    statusBarStyle: "black-translucent",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0ea5e9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c4a6e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        {/* Prevent FOUC: apply dark class before React hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("pristav-theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
            {/* Skip to main content link for keyboard/screen reader users */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white dark:focus:bg-gray-800 focus:px-4 focus:py-2 focus:text-primary-700 dark:focus:text-primary-400 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-primary-500"
            >
              Přejít na obsah
            </a>
            <OfflineBanner />
            <SWRegister />
            <AnimatedPages>{children}</AnimatedPages>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
