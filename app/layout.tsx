import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/pwa-register";
import PwaInstallPrompt from "@/components/pwa-install-prompt";
import "./globals.css";
import "./visual-v3.css";

export const metadata: Metadata = {
  title: "NEYVIX",
  description: "Uma identidade. Uma inteligência. Um universo digital.",
  applicationName: "NEYVIX",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/neyvix-icon.svg",
    apple: "/neyvix-icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "NEYVIX",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#00a8ff",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        <PwaInstallPrompt />
        {children}
      </body>
    </html>
  );
}
