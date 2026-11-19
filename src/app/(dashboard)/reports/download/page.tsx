"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, FileText, Archive, Filter } from "lucide-react"
import type { OperationalData } from "@/lib/handover-types"
import { formatDateId, sanitizeFileName } from "@/lib/format"
import { useToast } from "@/contexts/toast-context"

interface Handover {
  id: string
  form_number: string
  tanggal: string
  status: string
  kondisi_operasional: string
  submitted_at: string | null
  catatan?: string
  operational_data?: OperationalData
  shifts: { name: string; start_time?: string; end_time?: string } | null
  profiles: { full_name: string } | null
}

interface ActivityRow {
  handover_id: string
  waktu: string
  aktivitas: string
  deskripsi: string
  status: string
}

type FilterMode = "all" | "range" | "month" | "year" | "week"

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  reopened: "Reopened",
}

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function computeRange(
  mode: FilterMode,
  fromDate: string,
  toDate: string,
  monthValue: string,
  yearValue: string,
  weekValue: string
): { start?: string; end?: string } {
  if (mode === "all") return {}
  if (mode === "month" && monthValue) {
    const [year, month] = monthValue.split("-").map(Number)
    if (year && month) {
      return {
        start: toInputDate(new Date(year, month - 1, 1)),
        end: toInputDate(new Date(year, month, 0)),
      }
    }
  }
  if (mode === "year" && /^\d{4}$/.test(yearValue)) {
    return { start: `${yearValue}-01-01`, end: `${yearValue}-12-31` }
  }
  if (mode === "week") {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekValue)
    if (match) {
      const year = Number(match[1])
      const week = Number(match[2])
      const jan4 = new Date(year, 0, 4)
      const jan4Day = jan4.getDay() || 7
      const monday = new Date(jan4)
      monday.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { start: toInputDate(monday), end: toInputDate(sunday) }
    }
  }
  return { start: fromDate || undefined, end: toDate || undefined }
}

export default function ReportsDownloadPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const { error: toastError, success: toastSuccess } = useToast()

  const initialDate = searchParams.get("date") || ""
  const initialStatus = searchParams.get("status") || ""

  const [loading, setLoading] = useState(true)
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [activitiesByHandover, setActivitiesByHandover] = useState<Record<string, ActivityRow[]>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zipping, setZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 })

  const [mode, setMode] = useState<FilterMode>("range")
  const [fromDate, setFromDate] = useState(initialDate)
  const [toDate, setToDate] = useState(initialDate)
  const [monthValue, setMonthValue] = useState("")
  const [yearValue, setYearValue] = useState("")
  const [weekValue, setWeekValue] = useState("")
  const [filterStatus, setFilterStatus] = useState(initialStatus)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { start, end } = computeRange(mode, fromDate, toDate, monthValue, yearValue, weekValue)

    let query = supabase
      .from("handovers")
      .select("*, shifts(name, start_time, end_time), profiles:operator_id(full_name)")
      .order("tanggal", { ascending: false })
      .order("form_number", { ascending: true })

    if (start) query = query.gte("tanggal", start)
    if (end) query = query.lte("tanggal", end)
    if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus)

    const { data, error } = await query
    if (error) {
      toastError(error.message || "Gagal memuat berkas handover.")
      setHandovers([])
      setSelectedIds(new Set())
      setLoading(false)
      return
    }

    const rows = (data as Handover[] | null) ?? []
    setHandovers(rows)
    setSelectedIds(new Set(rows.map((h) => h.id)))

    if (rows.length > 0) {
      const ids = rows.map((h) => h.id)
      const { data: activitiesData } = await supabase
        .from("handover_activities")
        .select("handover_id, waktu, aktivitas, deskripsi, status")
        .in("handover_id", ids)
        .order("waktu")

      const grouped: Record<string, ActivityRow[]> = {}
      ;((activitiesData as ActivityRow[] | null) ?? []).forEach((a) => {
        if (!grouped[a.handover_id]) grouped[a.handover_id] = []
        grouped[a.handover_id].push(a)
      })
      setActivitiesByHandover(grouped)
    } else {
      setActivitiesByHandover({})
    }

    setLoading(false)
  }, [supabase, mode, fromDate, toDate, monthValue, yearValue, weekValue, filterStatus, toastError])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  const selectedHandovers = handovers.filter((h) => selectedIds.has(h.id))
  const allSelected = handovers.length > 0 && selectedHandovers.length === handovers.length

  const toggleOne = (id: string) => {
    if (zipping) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (zipping) return
    setSelectedIds(allSelected ? new Set() : new Set(handovers.map((h) => h.id)))
  }

  const folderNameFor = (h: Handover) =>
    sanitizeFileName(`${h.form_number} - ${formatDateId(h.tanggal)} - ${STATUS_LABEL[h.status] || h.status}`)

  const rangeLabel = () => {
    if (mode === "all") return "Semua Data"
    if (mode === "month" && monthValue) return monthValue
    if (mode === "year" && yearValue) return yearValue
    if (mode === "week" && weekValue) return weekValue
    if (fromDate || toDate) return `${fromDate || "awal"} s.d ${toDate || "akhir"}`
    return "semua-tanggal"
  }

  const rootFolderName = () =>
    sanitizeFileName(
      `Handover - ${rangeLabel()} - ${filterStatus && filterStatus !== "all" ? STATUS_LABEL[filterStatus] || filterStatus : "Semua Status"}`
    )

  const handleDownloadZip = async () => {
    if (selectedHandovers.length === 0 || zipping) return
    setZipping(true)
    setZipProgress({ current: 0, total: selectedHandovers.length })

    try {
      const [{ default: JSZip }, { buildHandoverPdf }] = await Promise.all([
        import("jszip"),
        import("@/lib/handover-pdf"),
      ])

      const zip = new JSZip()
      const rootName = rootFolderName()
      const root = zip.folder(rootName) ?? zip

      for (let index = 0; index < selectedHandovers.length; index++) {
        const h = selectedHandovers[index]
        const folderName = folderNameFor(h)
        const folder = root.folder(folderName) ?? root

        const pdf = await buildHandoverPdf(
          {
            ...h,
            shifts: h.shifts ?? undefined,
            profiles: h.profiles ?? undefined,
          },
          activitiesByHandover[h.id] ?? []
        )

        folder.file(`${folderName}.pdf`, pdf.output("blob"))
        setZipProgress({ current: index + 1, total: selectedHandovers.length })
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      })

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${rootName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toastSuccess(`${selectedHandovers.length} berkas PDF berhasil diunduh.`)
    } catch (error) {
      console.error("ZIP export error:", error)
      toastError("Gagal membuat berkas ZIP. Coba kurangi jumlah data atau ulangi.")
    } finally {
      setZipping(false)
      setZipProgress({ current: 0, total: 0 })
    }
  }

  const resetFilters = () => {
    setMode("range")
    setFromDate("")
    setToDate("")
    setMonthValue("")
    setYearValue("")
    setWeekValue("")
    setFilterStatus("")
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-blue-100 text-blue-800",
      submitted: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      reopened: "bg-orange-100 text-orange-800",
    }
    return variants[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push("/reports")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Unduh Berkas Handover</h1>
            <p className="text-muted-foreground text-sm">Pilih berkas lalu unduh sebagai ZIP berisi PDF handover</p>
          </div>
        </div>
        <Button onClick={handleDownloadZip} disabled={selectedHandovers.length === 0 || zipping}>
          {zipping ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {zipProgress.current}/{zipProgress.total}
            </>
          ) : (
            <>
              <Archive className="h-4 w-4 mr-2" />
              Unduh {selectedHandovers.length} Berkas (ZIP)
            </>
          )}
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Periode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as FilterMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Data</SelectItem>
                <SelectItem value="range">Rentang Tanggal</SelectItem>
                <SelectItem value="month">Bulan</SelectItem>
                <SelectItem value="year">Tahun</SelectItem>
                <SelectItem value="week">Minggu</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "range" && (
            <>
              <div className="space-y-2">
                <Label>Dari Tanggal</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sampai Tanggal</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </>
          )}

          {mode === "month" && (
            <div className="space-y-2">
              <Label>Bulan</Label>
              <Input type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
            </div>
          )}

          {mode === "year" && (
            <div className="space-y-2">
              <Label>Tahun</Label>
              <Input
                type="number"
                min={2000}
                max={2100}
                placeholder="2026"
                value={yearValue}
                onChange={(e) => setYearValue(e.target.value)}
              />
            </div>
          )}

          {mode === "week" && (
            <div className="space-y-2">
              <Label>Minggu</Label>
              <Input type="week" value={weekValue} onChange={(e) => setWeekValue(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filterStatus || "all"} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="reopened">Reopened</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>&nbsp;</Label>
            <Button variant="outline" className="w-full" onClick={resetFilters}>
              Reset Filter
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label="Pilih semua"
              checked={allSelected}
              onChange={toggleAll}
              disabled={handovers.length === 0 || zipping}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm">
              <span className="font-medium">{selectedHandovers.length}</span> dari {handovers.length} berkas dipilih
            </span>
          </div>
          {zipping && (
            <span className="text-xs text-muted-foreground">
              Memproses {zipProgress.current}/{zipProgress.total}...
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : handovers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>Tidak ada berkas handover untuk filter ini</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 w-10"></th>
                    <th className="px-4 py-3 text-left font-medium">Form Number</th>
                    <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                    <th className="px-4 py-3 text-left font-medium">Shift</th>
                    <th className="px-4 py-3 text-left font-medium">Operator</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {handovers.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleOne(h.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${h.form_number}`}
                          checked={selectedIds.has(h.id)}
                          onChange={() => toggleOne(h.id)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={zipping}
                          className="h-4 w-4 rounded border-input"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{h.form_number}</td>
                      <td className="px-4 py-3">{formatDateId(h.tanggal)}</td>
                      <td className="px-4 py-3">{h.shifts?.name || "-"}</td>
                      <td className="px-4 py-3">{h.profiles?.full_name || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(h.status)}`}>
                          {STATUS_LABEL[h.status] || h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {handovers.map((h) => (
                <label key={h.id} className="flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(h.id)}
                    onChange={() => toggleOne(h.id)}
                    disabled={zipping}
                    className="h-4 w-4 mt-0.5 rounded border-input"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{h.form_number}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(h.status)}`}>
                        {STATUS_LABEL[h.status] || h.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{h.shifts?.name || "-"} &middot; {h.profiles?.full_name || "-"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDateId(h.tanggal)}</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
