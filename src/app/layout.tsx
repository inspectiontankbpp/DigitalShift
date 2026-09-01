import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { UserProvider } from "@/contexts/user-context"
import { ToastProvider } from "@/contexts/toast-context"
import { ConfirmProvider } from "@/contexts/confirm-context"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Digital Shift Handover",
  description: "Digital Shift Handover & Operation Logbook System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShiftApp",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-gray-50 text-gray-900" suppressHydrationWarning>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-white focus:text-primary">
          Lewati ke konten utama
        </a>
        <UserProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  )
}
