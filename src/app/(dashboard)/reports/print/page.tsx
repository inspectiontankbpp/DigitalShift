"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Loader2 } from "lucide-react"

interface Handover {
  id: string
  form_number: string
  tanggal: string
  status: string
  kondisi_operasional: string
  submitted_at: string | null
  approved_at: string | null
  shifts: { name: string } | null
  profiles: { full_name: string } | null
}

export default function ReportsPrintPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [filterDate, setFilterDate] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  const fetchData = useCallback(async () => {
    setLoading(true)
    const date = searchParams.get("date") || ""
    const status = searchParams.get("status") || ""
    setFilterDate(date)
    setFilterStatus(status)

    let query = supabase
      .from("handovers")
      .select("*, shifts(name), profiles:operator_id(full_name)")
      .order("tanggal", { ascending: false })

    if (date) query = query.eq("tanggal", date)
    if (status && status !== "all") query = query.eq("status", status)

    const { data } = await query
    if (data) setHandovers(data as Handover[])
    setLoading(false)
  }, [supabase, searchParams])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!loading && handovers.length > 0) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
  }, [loading, handovers])

  const getStatusLabel = (status: string) => {
    const v: Record<string, string> = {
      draft: "Draft",
      submitted: "Menunggu",
      approved: "Disetujui",
      rejected: "Ditolak",
      reopened: "Dibuka Kembali",
    }
    return v[status] || status
  }

  const today = new Date()
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
  const reportDate = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`

  const filterLabel = []
  if (filterDate) {
    const d = new Date(filterDate)
    filterLabel.push(`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`)
  }
  if (filterStatus && filterStatus !== "all") filterLabel.push(`Status: ${getStatusLabel(filterStatus)}`)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground text-sm">Menyiapkan laporan...</p>
      </div>
    )
  }

  return (
    <div className="print:bg-white">
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden px-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/reports")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Kembali ke Laporan
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Cetak / Export PDF
        </Button>
      </div>

      <div className="w-full max-w-5xl mx-auto bg-white text-black font-sans p-6 border shadow-sm print:shadow-none print:p-4 print:border-none print:max-w-none print:mx-0 text-xs sm:text-sm">
        {/* Header with Logos */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-2">
          <div className="w-24 sm:w-28 shrink-0 flex justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pertamina.png" alt="Pertamina" className="max-h-14 sm:max-h-16 object-contain" />
          </div>
          <div className="flex-1 text-center">
            <div className="font-bold text-base sm:text-lg uppercase tracking-wide">Laporan Shift Handover</div>
            <div className="text-xs text-gray-500 mt-1">Dicetak: {reportDate}</div>
          </div>
          <div className="w-24 sm:w-28 shrink-0 flex justify-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/danantara.png" alt="Danantara" className="max-h-14 sm:max-h-16 object-contain" />
          </div>
        </div>

        {/* Filter Info */}
        {filterLabel.length > 0 && (
          <div className="mb-3 text-xs bg-gray-100 border border-black p-2">
            <span className="font-bold">Filter: </span>{filterLabel.join(" | ")}
          </div>
        )}

        {/* Summary */}
        <div className="mb-3 text-xs border border-black p-2">
          <span className="font-bold">Total Records: </span>{handovers.length}
        </div>

        {/* Main Table */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-200 font-bold text-center">
              <th className="border border-black p-1.5 w-8">No</th>
              <th className="border border-black p-1.5 text-left">No. Form</th>
              <th className="border border-black p-1.5">Tanggal</th>
              <th className="border border-black p-1.5">Shift</th>
              <th className="border border-black p-1.5 text-left">Operator</th>
              <th className="border border-black p-1.5">Status</th>
              <th className="border border-black p-1.5">Submit</th>
            </tr>
          </thead>
          <tbody>
            {handovers.length > 0 ? (
              handovers.map((h, idx) => (
                <tr key={h.id}>
                  <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                  <td className="border border-black p-1.5 font-medium">{h.form_number}</td>
                  <td className="border border-black p-1.5 text-center">
                    {new Date(h.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="border border-black p-1.5 text-center">{h.shifts?.name || "-"}</td>
                  <td className="border border-black p-1.5">{h.profiles?.full_name || "-"}</td>
                  <td className="border border-black p-1.5 text-center font-semibold">{getStatusLabel(h.status)}</td>
                  <td className="border border-black p-1.5 text-center">
                    {h.submitted_at ? new Date(h.submitted_at).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="border border-black p-4 text-center text-gray-400 italic">
                  Tidak ada data laporan
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 text-[10px] text-gray-500 italic text-center print:block">
          * Dokumen ini dicetak secara otomatis dari sistem Digital Shift Handover
        </div>
      </div>
    </div>
  )
}
