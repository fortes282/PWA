import type { Metadata, Viewport } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/app/components/Toast";
import SWRegister from "@/components/SWRegister";
import OfflineBanner from "@/components/OfflineBanner";
import SplashScreen from "@/components/SplashScreen";
import NativePageTransition from "@/components/NativePageTransition";

const lexend = Lexend({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  applicationName: "Přístav Radosti",
  title: {
    default: "Přístav Radosti",
    template: "%s | Přístav Radosti",
  },
  description: "Neurorehabilitační centrum — klientský portál pro správu terapií, rezervace a zdravotní záznamy.",
  keywords: ["neurorehabilitace", "fyzioterapie", "klientský portál", "rezervace termínů"],
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
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
    { media: "(prefers-color-scheme: light)", color: "#242B61" },
    { media: "(prefers-color-scheme: dark)", color: "#0D144B" },
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
      <body className={lexend.className}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
            {/* Skip to main content link for keyboard/screen reader users */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white dark:focus:bg-gray-800 focus:px-4 focus:py-2 focus:text-primary dark:focus:text-primary-300 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-primary"
            >
              Přejít na obsah
            </a>
            <OfflineBanner />
            <SWRegister />
            <SplashScreen>
              <NativePageTransition>{children}</NativePageTransition>
            </SplashScreen>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
