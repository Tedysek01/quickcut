import type { Metadata } from "next";
import { Syne, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n-context";
import { Toaster } from "sonner";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "QuickCut — AI Video Editor for Creators",
  description:
    "Transform raw footage into polished, viral-ready short-form content. AI-powered cuts, zooms, captions, and sound design in minutes.",
  openGraph: {
    title: "QuickCut — AI Video Editor for Creators",
    description: "Edit your shorts in 2 minutes, not 2 hours.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${outfit.variable} font-sans antialiased noise`}
        style={{ background: "var(--bg-root)", color: "var(--text-primary)" }}
      >
        <I18nProvider>
        <AuthProvider>
          {children}
          <Toaster
            richColors
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              },
            }}
          />
        </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
