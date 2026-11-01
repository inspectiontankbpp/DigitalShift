import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock,
  Droplets,
  Gauge,
  ListChecks,
  Plus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { EmptyState, ShiftBars, StatCard, StatusDonut, TankLevelChart, TrendChart } from "@/components/dashboard/charts"
import type { TankDatum } from "@/components/dashboard/charts"
import type { OperationalData } from "@/lib/handover-types"

type HandoverRow = {
  id: string
  form_number: string | null
  status: string | null
  tanggal: string | null
  created_at: string | null
  submitted_at: string | null
  approved_at: string | null
  kendala: string | null
  safety_issue: string | null
  operational_data: OperationalData | null
  shifts: { name: string | null } | null
  profiles: { full_name: string | null } | null
}

type RecentHandover = {
  id: string
  form_number: string | null
  status: string | null
  tanggal: string | null
  created_at: string | null
  shifts: { name: string | null } | null
  profiles: { full_name: string | null } | null
}

type TodayHandover = {
  id: string
  status: string | null
  kendala: string | null
  safety_issue: string | null
  approved_at: string | null
}

type OutstandingJob = {
  id: string
  judul: string
  prioritas: string | null
  status: string | null
  deadline: string | null
  handover_id: string
}

type ShiftKey = "pagi" | "siang" | "malam" | "lainnya"

const statusMeta = [
  { key: "approved", label: "Disetujui", color: "#10b981", className: "bg-emerald-500" },
  { key: "submitted", label: "Menunggu", color: "#f59e0b", className: "bg-amber-500" },
  { key: "draft", label: "Draft", color: "#0ea5e9", className: "bg-sky-500" },
  { key: "rejected", label: "Ditolak", color: "#ef4444", className: "bg-red-500" },
  { key: "reopened", label: "Dibuka Kembali", color: "#f97316", className: "bg-orange-500" },
] as const

const statusStyles: Record<string, { label: string; className: string; dot: string }> = {
  draft: { label: "Draft", className: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  submitted: { label: "Menunggu", className: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  approved: { label: "Disetujui", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  rejected: { label: "Ditolak", className: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500" },
  reopened: { label: "Dibuka Kembali", className: "border-orange-200 bg-orange-50 text-orange-700", dot: "bg-orange-500" },
}

const fallbackStatus = statusStyles.draft

const priorityStyles: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "border-red-200 bg-red-50 text-red-700" },
  high: { label: "High", className: "border-orange-200 bg-orange-50 text-orange-700" },
  medium: { label: "Medium", className: "border-amber-200 bg-amber-50 text-amber-700" },
  low: { label: "Low", className: "border-slate-200 bg-slate-50 text-slate-600" },
}

const fallbackPriority = priorityStyles.medium

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "operator") redirect("/handover")

  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const todayKey = toDateKey(today)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 6)
  const weekStartKey = toDateKey(weekStart)

  const [todayResult, pendingResult, jobsResult, weekResult, recentResult] = await Promise.all([
    supabase
      .from("handovers")
      .select("id, status, kendala, safety_issue, approved_at")
      .eq("tanggal", todayKey),
    supabase
      .from("handovers")
      .select("id")
      .eq("status", "submitted"),
    supabase
      .from("outstanding_jobs")
      .select("id, judul, prioritas, status, deadline, handover_id")
      .in("status", ["pending", "in_progress"])
      .order("deadline", { ascending: true })
      .limit(5),
    supabase
      .from("handovers")
      .select("id, form_number, status, tanggal, created_at, submitted_at, approved_at, kendala, safety_issue, operational_data, shifts(name), profiles:operator_id(full_name)")
      .gte("tanggal", weekStartKey)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("handovers")
      .select("id, form_number, status, tanggal, created_at, shifts(name), profiles:operator_id(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const todayHandovers = (todayResult.data ?? []) as unknown as TodayHandover[]
  const pendingApprovals = pendingResult.data?.length ?? 0
  const outstandingJobs = (jobsResult.data ?? []) as unknown as OutstandingJob[]
  const weekHandovers = (weekResult.data ?? []) as unknown as HandoverRow[]
  const recentHandovers = (recentResult.data ?? []) as unknown as RecentHandover[]

  const todayCount = todayHandovers.length
  const approvedToday = todayHandovers.filter((handover) => handover.status === "approved").length
  const urgentJobs = outstandingJobs.filter((job) => job.prioritas === "urgent" || job.prioritas === "high").length

  const statusCounts: Record<string, number> = Object.fromEntries(statusMeta.map((item) => [item.key, 0]))
  for (const handover of weekHandovers) {
    const status = String(handover.status || "")
    if (statusCounts[status] !== undefined) statusCounts[status] += 1
  }

  const totalWeek = weekHandovers.length
  const approvedWeek = statusCounts.approved
  const approvalRate = totalWeek > 0 ? Math.round((approvedWeek / totalWeek) * 100) : 0
  const donutData = statusMeta.map((item) => ({
    label: item.label,
    value: statusCounts[item.key],
    color: item.color,
    className: item.className,
  }))

  const weeklyData = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today)
    day.setDate(today.getDate() - (6 - index))
    const key = toDateKey(day)
    const dayHandovers = weekHandovers.filter((handover) => String(handover.tanggal || "") === key)
    return {
      label: day.toLocaleDateString("id-ID", { weekday: "short" }),
      date: day.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      total: dayHandovers.length,
      approved: dayHandovers.filter((handover) => handover.status === "approved").length,
    }
  })

  const yesterdayTotal = weeklyData[5]?.total ?? 0
  const todayDelta = todayCount - yesterdayTotal
  const todayDeltaLabel = todayDelta === 0 ? "sama vs kemarin" : `${todayDelta > 0 ? "+" : ""}${todayDelta} vs kemarin`

  const shiftCounts: Record<ShiftKey, number> = { pagi: 0, siang: 0, malam: 0, lainnya: 0 }
  for (const handover of weekHandovers) {
    shiftCounts[getShiftKey(handover.operational_data)] += 1
  }
  const shiftData = [
    { label: "Pagi", value: shiftCounts.pagi, color: "bg-amber-500" },
    { label: "Siang", value: shiftCounts.siang, color: "bg-sky-500" },
    { label: "Malam", value: shiftCounts.malam, color: "bg-indigo-500" },
    ...(shiftCounts.lainnya > 0 ? [{ label: "Lainnya", value: shiftCounts.lainnya, color: "bg-slate-400" }] : []),
  ]

  const completeCount = weekHandovers.filter((handover) => (handover.operational_data?.tankLevels?.length ?? 0) > 0).length
  const dataCompleteness = totalWeek > 0 ? Math.round((completeCount / totalWeek) * 100) : 0

  const approvalDurations = weekHandovers
    .filter((handover) => handover.status === "approved" && handover.submitted_at && handover.approved_at)
    .map((handover) => (new Date(handover.approved_at as string).getTime() - new Date(handover.submitted_at as string).getTime()) / 3600000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0)
  const averageApprovalHours = approvalDurations.length > 0
    ? approvalDurations.reduce((total, hours) => total + hours, 0) / approvalDurations.length
    : null
  const averageApprovalLabel = averageApprovalHours === null
    ? "—"
    : averageApprovalHours < 1
      ? `${Math.round(averageApprovalHours * 60)} mnt`
      : `${averageApprovalHours.toFixed(1)} jam`

  let criticalOk = 0
  let criticalTotal = 0
  let safetyOk = 0
  let safetyTotal = 0
  const equipmentIssues: { name: string; form: string; note: string }[] = []

  for (const handover of weekHandovers) {
    const operational = handover.operational_data
    for (const item of operational?.criticalEquipment ?? []) {
      criticalTotal += 1
      if (isReady(item.status, item.kondisi, "OK")) {
        criticalOk += 1
      } else {
        equipmentIssues.push({
          name: item.namaPeralatan || "Critical equipment",
          form: handover.form_number || "-",
          note: item.keterangan || item.kondisi || "Tidak siap",
        })
      }
    }
    for (const item of operational?.safetyTools ?? []) {
      safetyTotal += 1
      if (isReady(item.status, item.kondisi, "ADA")) {
        safetyOk += 1
      } else {
        equipmentIssues.push({
          name: item.nama || "Safety tool",
          form: handover.form_number || "-",
          note: item.keterangan || item.kondisi || "Tidak siap",
        })
      }
    }
  }

  const readinessTotal = criticalTotal + safetyTotal
  const readinessPct = readinessTotal > 0 ? Math.round(((criticalOk + safetyOk) / readinessTotal) * 100) : 0

  const tankMap = new Map<string, TankDatum>()
  for (const handover of weekHandovers) {
    for (const tank of handover.operational_data?.tankLevels ?? []) {
      const label = String(tank.noTanki || "").trim()
      const level = toNumber(tank.level)
      if (!label || level === null) continue
      const key = label.replace(/[^0-9a-z]/gi, "").toUpperCase()
      if (!key || tankMap.has(key)) continue
      tankMap.set(key, {
        tank: label,
        product: String(tank.produk || "").trim(),
        level,
        water: toNumber(tank.water) ?? 0,
      })
    }
  }
  const tankData = Array.from(tankMap.values()).slice(0, 8)

  const attentionHandovers = weekHandovers.filter((handover) =>
    Boolean(String(handover.kendala || "").trim() || String(handover.safety_issue || "").trim())
  )
  const attentionCount = attentionHandovers.length
  const heroAttentionCount = attentionCount + outstandingJobs.length + pendingApprovals

  return (
    <div className="space-y-4 px-2 sm:space-y-6 sm:px-0">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-50 shadow-sm sm:p-6">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live operations
              <span className="text-slate-600">/</span>
              {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard Supervisor</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
              Pantau handover, approval, dan kesiapan operasional dalam satu tampilan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                heroAttentionCount > 0
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${heroAttentionCount > 0 ? "bg-amber-400" : "bg-emerald-400"}`} />
              {heroAttentionCount > 0 ? `${heroAttentionCount} item perlu perhatian` : "Operasional normal"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              <Clock className="h-3.5 w-3.5" />
              Update {now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Handover Hari Ini"
          value={todayCount}
          helper={`${approvedToday} disetujui · ${todayDeltaLabel}`}
          icon={ClipboardList}
          accent="bg-sky-50 text-sky-600"
          bar="bg-sky-500"
        />
        <StatCard
          label="Menunggu Approval"
          value={pendingApprovals}
          helper={pendingApprovals > 0 ? "Perlu tindakan supervisor" : "Tidak ada antrean"}
          icon={Clock}
          accent="bg-amber-50 text-amber-600"
          bar="bg-amber-500"
        />
        <StatCard
          label="Approval Rate"
          value={`${approvalRate}%`}
          helper={`${approvedWeek}/${totalWeek} disetujui (7 hari)`}
          icon={CheckCircle2}
          accent="bg-emerald-50 text-emerald-600"
          bar="bg-emerald-500"
        />
        <StatCard
          label="Outstanding Job"
          value={outstandingJobs.length}
          helper={outstandingJobs.length > 0 ? `${urgentJobs} prioritas tinggi` : "Tidak ada job terbuka"}
          icon={ListChecks}
          accent="bg-rose-50 text-rose-600"
          bar="bg-rose-500"
        />
        <StatCard
          label="Kesiapan Alat"
          value={readinessTotal > 0 ? `${readinessPct}%` : "—"}
          helper={readinessTotal > 0 ? `${criticalOk + safetyOk}/${readinessTotal} item siap` : "Belum ada data peralatan"}
          icon={ShieldCheck}
          accent="bg-indigo-50 text-indigo-600"
          bar="bg-indigo-500"
        />
        <StatCard
          label="Kelengkapan Data"
          value={`${dataCompleteness}%`}
          helper={`${completeCount}/${totalWeek} handover punya level tank`}
          icon={Gauge}
          accent="bg-cyan-50 text-cyan-600"
          bar="bg-cyan-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/handover"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Buat Handover
        </Link>
        <Link
          href="/approvals"
          className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted/50"
        >
          <CheckSquare className="h-4 w-4" />
          Approvals
          {pendingApprovals > 0 && (
            <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              {pendingApprovals}
            </span>
          )}
        </Link>
        <Link
          href="/reports"
          className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted/50"
        >
          <TrendingUp className="h-4 w-4" />
          Laporan & Export
        </Link>
        <Link
          href="/powerbi"
          className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted/50"
        >
          <BarChart3 className="h-4 w-4" />
          Power BI
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 overflow-hidden p-4 sm:p-5 lg:col-span-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Tren Handover 7 Hari</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Total handover dan yang disetujui</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-900" /> Total
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Disetujui
              </span>
            </div>
          </div>
          <TrendChart data={weeklyData} />
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Status Handover</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">7 hari terakhir</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
              {approvalRate}% disetujui
            </span>
          </div>
          <StatusDonut data={donutData} total={totalWeek} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold">Beban per Regu Shift</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Distribusi handover 7 hari</p>
          </div>
          <ShiftBars data={shiftData} total={totalWeek} />
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Kesiapan Peralatan</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Critical equipment & safety tools · 7 hari</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                readinessTotal > 0 && readinessPct === 100
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {readinessTotal > 0 ? `${readinessPct}% siap` : "Belum ada data"}
            </span>
          </div>
          <div className="space-y-4">
            <ReadinessRow label="Critical equipment" ok={criticalOk} total={criticalTotal} color="bg-indigo-500" />
            <ReadinessRow label="Safety tools" ok={safetyOk} total={safetyTotal} color="bg-emerald-500" />
          </div>
          {equipmentIssues.length > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" /> {equipmentIssues.length} temuan
              </p>
              <ul className="mt-1.5 space-y-1">
                {equipmentIssues.slice(0, 2).map((issue, index) => (
                  <li key={`${issue.form}-${issue.name}-${index}`} className="truncate text-[11px] text-amber-800/80">
                    {issue.name} · {issue.form}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Semua item siap
            </p>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden p-4 sm:p-5 md:col-span-2 xl:col-span-1">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Level Tank Terbaru</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Pembacaan terakhir per tangki</p>
            </div>
            <Droplets className="h-4 w-4 text-sky-500" />
          </div>
          <TankLevelChart data={tankData} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-sm font-semibold">Aktivitas Terbaru</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">8 handover terakhir</p>
            </div>
            <Link href="/approvals" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Lihat semua <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Aktivitas terbaru handover</caption>
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-medium">No. Form</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Operator</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Shift</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Tanggal</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentHandovers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Belum ada form handover.
                    </td>
                  </tr>
                ) : (
                  recentHandovers.map((handover) => {
                    const status = getStatusStyle(handover.status)
                    return (
                      <tr key={handover.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">
                          <Link href={`/handover/${handover.id}`} className="text-primary hover:underline">
                            {handover.form_number || "-"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{handover.profiles?.full_name || "-"}</td>
                        <td className="px-4 py-3">{handover.shifts?.name || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(handover.tanggal)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${status.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/handover/${handover.id}`} className="text-xs font-medium text-primary hover:underline">
                            Detail
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y md:hidden">
            {recentHandovers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada form handover.</div>
            ) : (
              recentHandovers.map((handover) => {
                const status = getStatusStyle(handover.status)
                return (
                  <Link key={handover.id} href={`/handover/${handover.id}`} className="block p-4 transition-colors hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{handover.form_number || "-"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {handover.profiles?.full_name || "-"} · {handover.shifts?.name || "-"}
                        </p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{formatDate(handover.tanggal)}</p>
                  </Link>
                )
              })
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Outstanding Job</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Pekerjaan terbuka</p>
              </div>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                {outstandingJobs.length}
              </span>
            </div>
            {outstandingJobs.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {outstandingJobs.slice(0, 3).map((job) => {
                  const priority = getPriorityStyle(job.prioritas)
                  return (
                    <li key={job.id} className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-xs font-medium leading-snug">{job.judul}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${priority.className}`}>
                          {priority.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {job.status === "in_progress" ? "Sedang dikerjakan" : "Menunggu"}
                        {job.deadline ? ` · ${formatDate(job.deadline)}` : ""}
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState text="Tidak ada outstanding job." />
              </div>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Perlu Perhatian</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Kendala & safety issue</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                {attentionCount}
              </span>
            </div>
            {attentionHandovers.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {attentionHandovers.slice(0, 3).map((handover) => (
                  <li key={handover.id} className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/handover/${handover.id}`} className="text-xs font-medium text-primary hover:underline">
                        {handover.form_number || "-"}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">{formatDate(handover.tanggal)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {handover.safety_issue || handover.kendala}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState text="Tidak ada kendala tercatat." />
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Rata-rata approval</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{averageApprovalLabel}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kelengkapan data</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">{dataCompleteness}%</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ReadinessRow({ label, ok, total, color }: { label: string; ok: number; total: number; color: string }) {
  const percentage = total > 0 ? Math.round((ok / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{ok}/{total}</span> siap
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function getStatusStyle(status: string | null) {
  return statusStyles[status || ""] ?? fallbackStatus
}

function getPriorityStyle(priority: string | null) {
  return priorityStyles[priority || "medium"] ?? fallbackPriority
}

function getShiftKey(operational: OperationalData | null): ShiftKey {
  const raw = `${operational?.reguShift ?? ""} ${operational?.shiftName ?? ""}`.toLowerCase()
  if (raw.includes("pagi") || raw.includes("regu1") || raw.includes("regu 1")) return "pagi"
  if (raw.includes("siang") || raw.includes("sore") || raw.includes("regu2") || raw.includes("regu 2")) return "siang"
  if (raw.includes("malam") || raw.includes("regu3") || raw.includes("regu 3")) return "malam"
  return "lainnya"
}

function isReady(status: string | null | undefined, kondisi: string | null | undefined, expectedStatus: string) {
  const statusValue = String(status || "").trim().toUpperCase()
  const condition = String(kondisi || "").trim().toLowerCase()
  if (statusValue !== expectedStatus) return false
  if (!condition) return true
  if (condition.includes("tidak") || condition.includes("rusak") || condition.includes("hilang")) return false
  return (
    condition.includes("berfungsi") ||
    condition.includes("baik") ||
    condition.includes("lengkap") ||
    condition.includes("normal") ||
    condition.includes("ada")
  )
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  let normalized = raw.replace(/[^\d,.-]/g, "")
  if (!normalized) return null
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".")
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "")
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const date = dateOnly ? new Date(`${value}T00:00:00`) : new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}
