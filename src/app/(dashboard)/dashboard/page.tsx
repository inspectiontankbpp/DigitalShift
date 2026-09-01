import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Clock, AlertCircle, ClipboardList, Hourglass, TrendingUp, Plus, CheckSquare, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "operator") redirect("/handover")

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isoToday = today.toISOString()

  const { data: handovers } = await supabase.from("handovers").select("*").gte("tanggal", isoToday)

  const { data: outstandingJobs } = await supabase.from("outstanding_jobs").select("*").in("status", ["pending", "in_progress"])

  const { data: pendingApprovals } = await supabase.from("handovers").select("*").in("status", ["submitted"])

  const stats = {
    totalShiftsToday: handovers?.length || 0,
    outstandingJobs: outstandingJobs?.length || 0,
    pendingHandovers: handovers?.filter((h: Record<string, unknown>) => String(h.status || "") === "draft" || String(h.status || "") === "submitted").length || 0,
    pendingApprovals: pendingApprovals?.length || 0,
  }

  const perShift = {
    pagi: handovers?.filter((h: Record<string, unknown>) => {
      const od = h.operational_data as Record<string, unknown> | null
      return (od?.reguShift === "regu1")
    }).length || 0,
    sore: handovers?.filter((h: Record<string, unknown>) => {
      const od = h.operational_data as Record<string, unknown> | null
      return (od?.reguShift === "regu2")
    }).length || 0,
    malam: handovers?.filter((h: Record<string, unknown>) => {
      const od = h.operational_data as Record<string, unknown> | null
      return (od?.reguShift === "regu3")
    }).length || 0,
  }

  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const { data: allWeekHandovers } = await supabase
    .from("handovers")
    .select("id, form_number, status, tanggal, operational_data, created_at, shifts(name), profiles:operator_id(full_name)")
    .gte("tanggal", weekAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(50)

  const weeklyData = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const dayStart = d.toISOString()
    const dayEnd = new Date(d.getTime() + 86400000).toISOString()
    const count = (allWeekHandovers ?? []).filter((h: Record<string, unknown>) => {
      const t = String(h.tanggal || "")
      return t >= dayStart && t < dayEnd
    }).length
    weeklyData.push({
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      date: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      count,
    })
  }

  const maxWeekly = Math.max(...weeklyData.map((d) => d.count), 1)

  const { data: recentHandovers } = await supabase.from("handovers").select("id, form_number, status, created_at, shifts(name), profiles:operator_id(full_name)").order("created_at", { ascending: false }).limit(8)

  const weekHandovers = allWeekHandovers

  const statusMeta = [
    { key: "approved", label: "Disetujui", color: "bg-green-500" },
    { key: "submitted", label: "Menunggu", color: "bg-yellow-500" },
    { key: "draft", label: "Draft", color: "bg-blue-500" },
    { key: "rejected", label: "Ditolak", color: "bg-red-500" },
    { key: "reopened", label: "Dibuka Kembali", color: "bg-orange-500" },
  ]

  const statusCounts: Record<string, number> = {}
  for (const m of statusMeta) statusCounts[m.key] = 0
  for (const h of (weekHandovers ?? []) as Record<string, unknown>[]) {
    const s = String(h.status || "")
    if (statusCounts[s] !== undefined) statusCounts[s]++
  }

  const totalWeek = weekHandovers?.length || 0
  const approvalRate = totalWeek > 0 ? Math.round((statusCounts.approved / totalWeek) * 100) : 0

  const getStatusBadge = (status: string) => {
    const v: Record<string, string> = {
      draft: "bg-blue-100 text-blue-800",
      submitted: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      reopened: "bg-orange-100 text-orange-800",
    }
    return v[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Ringkasan operasional shift hari ini</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-muted-foreground">{today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Link href="/handover" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="h-4 w-4" />
          Buat Handover Baru
        </Link>
        <Link href="/approvals" className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors shadow-sm">
          <CheckSquare className="h-4 w-4" />
          Approvals
          {stats.pendingApprovals > 0 && (
            <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{stats.pendingApprovals}</span>
          )}
        </Link>
        <Link href="/reports" className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors shadow-sm">
          <TrendingUp className="h-4 w-4" />
          Laporan & Export
        </Link>
      </div>

      {/* Grid: Weekly Trend + Per Shift + Safety */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Trend Chart */}
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4">Tren Handover 7 Hari</h2>
          <div className="flex items-end gap-2 h-40">
            {weeklyData.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-muted-foreground">{d.count}</span>
                <div
                  className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors min-h-[4px]"
                  style={{ height: `${(d.count / maxWeekly) * 100}%` }}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
                <span className="text-[10px] text-muted-foreground">{d.date}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Per Shift + Ringkasan Column */}
        <div className="space-y-4">
          {/* Per Shift Breakdown */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3">Per Regu Shift</h2>
            <div className="space-y-2">
              <ShiftBar label="Pagi" count={perShift.pagi} total={stats.totalShiftsToday || 1} color="bg-amber-500" />
              <ShiftBar label="Sore" count={perShift.sore} total={stats.totalShiftsToday || 1} color="bg-orange-500" />
              <ShiftBar label="Malam" count={perShift.malam} total={stats.totalShiftsToday || 1} color="bg-indigo-500" />
            </div>
          </Card>

          {/* Status Handover 7 Hari */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Status 7 Hari Terakhir</h2>
              <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                {approvalRate}% disetujui
              </span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted mb-4">
              {statusMeta.map((m) => (
                <div
                  key={m.key}
                  className={`${m.color} h-full transition-all`}
                  style={{ width: `${totalWeek ? Math.round((statusCounts[m.key] / totalWeek) * 100) : 0}%` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {statusMeta.map((m) => (
                <div key={m.key} className="flex items-center gap-2 text-xs">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${m.color}`} />
                  <span className="text-muted-foreground flex-1">{m.label}</span>
                  <span className="font-semibold">{statusCounts[m.key]}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aktivitas Terbaru</h2>
          <Link href="/approvals" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            Lihat Semua <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <Card className="overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block w-full overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Aktivitas terbaru handover</caption>
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">No. Form</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Operator</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Shift</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {!recentHandovers?.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Belum ada form handover.
                    </td>
                  </tr>
                ) : (
                  recentHandovers.map((h: Record<string, unknown>) => (
                    <tr key={String(h.id)} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/handover/${h.id}`} className="text-primary hover:underline">
                          {String(h.form_number || "")}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {String((h.profiles as Record<string, unknown>)?.full_name || "-")}
                      </td>
                      <td className="px-4 py-3">{(h.shifts as Record<string, unknown>)?.name ? String((h.shifts as Record<string, unknown>).name) : "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(String(h.status || ""))}`}>
                          {String(h.status || "")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/handover/${h.id}`} className="text-xs text-primary hover:underline">
                          Detail →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y">
            {!recentHandovers?.length ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                Belum ada form handover.
              </div>
            ) : (
              recentHandovers.map((h: Record<string, unknown>) => (
                <Link key={String(h.id)} href={`/handover/${h.id}`} className="block p-4 hover:bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{String(h.form_number || "")}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(String(h.status || ""))}`}>
                      {String(h.status || "")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {String((h.profiles as Record<string, unknown>)?.full_name || "-")} &middot;{" "}
                    {(h.shifts as Record<string, unknown>)?.name ? String((h.shifts as Record<string, unknown>).name) : "-"}
                  </p>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function IconBox({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    orange: "bg-orange-50 text-orange-600",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
  }
  return <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colors[color] || colors.blue}`}>{children}</div>
}

function ShiftBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.round((count / total) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
