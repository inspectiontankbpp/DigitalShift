import { type ReactNode } from "react"
import { Header } from "@/components/header"
import { RealtimeSubscriber } from "@/components/realtime-subscriber"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <Header />
      <RealtimeSubscriber />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 print:max-w-none print:px-0 print:py-0">{children}</main>
    </div>
  )
}
