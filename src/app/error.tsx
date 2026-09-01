"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  const router = useRouter()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
      <h2 className="text-xl font-semibold mb-2">Terjadi Kesalahan</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        {error.message || "Sistem mengalami gangguan. Silakan coba lagi atau kembali ke dashboard."}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Dashboard
        </Button>
        <Button onClick={reset}>Coba Lagi</Button>
      </div>
    </div>
  )
}
