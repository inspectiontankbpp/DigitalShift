import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { UserProvider } from "@/contexts/user-context"
import { ToastProvider } from "@/contexts/toast-context"
import { ConfirmProvider } from "@/contexts/confirm-context"
import { PwaRegister } from "@/components/pwa-register"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Digital Shift Handover",
  description: "Digital Shift Handover & Operation Logbook System",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShiftApp",
  },
}

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-gray-50 text-gray-900" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-white focus:text-primary">
          Lewati ke konten utama
        </a>
        <PwaRegister />
        <UserProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  )
}
