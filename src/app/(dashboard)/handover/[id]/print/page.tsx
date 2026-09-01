"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ShiftHandoverDocument } from "@/components/handover/shift-handover-document"
import { ResponsiveScale } from "@/components/responsive-scale"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Loader2 } from "lucide-react"

export default function HandoverPrintPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [handover, setHandover] = useState<Record<string, unknown> | null>(null)
  const [activities, setActivities] = useState<Record<string, unknown>[]>([])

  useEffect(() => {
    async function fetchData() {
      if (!params.id) return
      setLoading(true)

      const { data: handoverData } = await supabase
        .from("handovers")
        .select("*, shifts(name, start_time, end_time), profiles:operator_id(full_name)")
        .eq("id", params.id)
        .single()

      if (handoverData) {
        setHandover(handoverData)

        const { data: activitiesData } = await supabase
          .from("handover_activities")
          .select("*")
          .eq("handover_id", params.id)
          .order("waktu")

        if (activitiesData) setActivities(activitiesData)
      }

      setLoading(false)

      if (searchParams.get("auto") === "true") {
        setTimeout(() => {
          window.print()
        }, 500)
      }
    }

    fetchData()
  }, [supabase, params.id, searchParams])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground text-sm">Menyiapkan dokumen formulir...</p>
      </div>
    )
  }

  if (!handover) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-destructive font-semibold mb-4">Dokumen Handover tidak ditemukan.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="print:bg-white">
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.push(`/handover/${params.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Detail
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Cetak / Export PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto print:max-w-none">
        <ResponsiveScale baseWidth={800} className="print:!overflow-visible print:!block">
          <ShiftHandoverDocument handover={handover} activities={activities} />
        </ResponsiveScale>
      </div>
    </div>
  )
}
