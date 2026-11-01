"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileText, Download, Filter, Loader2, FileDown } from "lucide-react"

interface Handover {
  id: string
  form_number: string
  tanggal: string
  status: string
  kondisi_operasional: string
  submitted_at: string | null
  shifts: { name: string } | null
  profiles: { full_name: string } | null
}

import { useUser } from "@/contexts/user-context"

export default function ReportsPage() {
  const { loading: authLoading } = useUser()
  const supabase = createClient()
  const [handovers, setHandovers] = useState<Handover[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [filterDate, setFilterDate] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const from = page * pageSize
      const to = from + pageSize - 1

      let query = supabase
        .from("handovers")
        .select("*, shifts(name), profiles:operator_id(full_name)", { count: "exact" })
        .order("tanggal", { ascending: false })
        .range(from, to)

      if (filterDate) query = query.eq("tanggal", filterDate)
      if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus)

      const { data, count } = await query
      if (data) setHandovers(data as Handover[])
      if (count !== null) setTotalCount(count)
      setLoading(false)
    }
    fetchData()
  }, [filterDate, filterStatus, page, supabase])

  const sanitize = (v: string) => v && /^[=+\-@]/.test(v) ? "\t" + v : v

  const handleExport = async () => {
    setExporting(true)
    try {
      let query = supabase
        .from("handovers")
        .select("*, shifts(name), profiles:operator_id(full_name)")
        .order("tanggal", { ascending: false })
      if (filterDate) query = query.eq("tanggal", filterDate)
      if (filterStatus && filterStatus !== "all") query = query.eq("status", filterStatus)
      const { data } = await query
      if (!data?.length) { setExporting(false); return }

      const headers = ["Form Number", "Date", "Shift", "Operator", "Status", "Condition", "Submitted At"]
      const rows = data.map((h) => [
        h.form_number,
        new Date(h.tanggal).toLocaleDateString(),
        h.shifts?.name || "",
        h.profiles?.full_name || "",
        h.status,
        h.kondisi_operasional,
        h.submitted_at ? new Date(h.submitted_at).toLocaleString() : "",
      ].map(sanitize))

      const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `shift-report-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export error:", error)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = () => {
    const params = new URLSearchParams()
    if (filterDate) params.set("date", filterDate)
    if (filterStatus) params.set("status", filterStatus)
    const url = `/reports/print${params.toString() ? "?" + params.toString() : ""}`
    window.open(url, "_blank")
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      draft: "bg-blue-100 text-blue-800",
      submitted: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    }
    return variants[status] || "bg-gray-100 text-gray-800"
  }

  if (authLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Export and view shift reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportPDF} disabled={handovers.length === 0} variant="outline" size="sm">
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button onClick={handleExport} disabled={exporting || handovers.length === 0} size="sm">
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            CSV
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>&nbsp;</Label>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterDate("")
                  setFilterStatus("")
                  setPage(0)
                }}
                className="w-full"
              >
                Reset Filters
              </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : handovers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-50" />
            <p>No reports found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Form Number</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Shift</th>
                    <th className="px-4 py-3 text-left font-medium">Operator</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {handovers.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        <a href={`/handover/${h.id}`} className="text-primary hover:underline">
                          {h.form_number}
                        </a>
                      </td>
                      <td className="px-4 py-3">{new Date(h.tanggal).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{h.shifts?.name}</td>
                      <td className="px-4 py-3">{h.profiles?.full_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(h.status)}`}>
                          {h.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {h.submitted_at ? new Date(h.submitted_at).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y">
              {handovers.map((h) => (
                <a key={h.id} href={`/handover/${h.id}`} className="block p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{h.form_number}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(h.status)}`}>
                      {h.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{h.shifts?.name} &middot; {h.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(h.tanggal).toLocaleDateString()}
                    {h.submitted_at ? ` &middot; ${new Date(h.submitted_at).toLocaleString()}` : ""}
                  </p>
                </a>
              ))}
            </div>
          </>
        )}
      </Card>

      {!loading && handovers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} dari {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              {page + 1}/{Math.ceil(totalCount / pageSize)}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * pageSize >= totalCount}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
