"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, RotateCcw, Loader2, Printer, FileText, Trash2 } from "lucide-react"
import { useToast } from "@/contexts/toast-context"
import { useConfirm } from "@/contexts/confirm-context"
import { useUser } from "@/contexts/user-context"
import { ShiftHandoverDocument } from "@/components/handover/shift-handover-document"
import { ResponsiveScale } from "@/components/responsive-scale"

export default function HandoverDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const { confirm } = useConfirm()
  const { user, profile } = useUser()
  const supabase = createClient()
  const isSupervisor = profile?.role === "supervisor"
  const [loading, setLoading] = useState(true)
  const [handover, setHandover] = useState<Record<string, unknown> | null>(null)
  const [activities, setActivities] = useState<Record<string, unknown>[]>([])
  const [reopening, setReopening] = useState(false)

  const handleReopen = async () => {
    const ok = await confirm("Buka Kembali Handover?", `Anda yakin ingin membuka kembali ${String(handover?.form_number || "")} untuk diedit?`, { confirmLabel: "Buka Lagi", variant: "warning" })
    if (!ok) return
    setReopening(true)
    try {
      const { error } = await supabase
        .from("handovers")
        .update({ status: "reopened", reopened_at: new Date().toISOString() })
        .eq("id", params.id)
      if (error) throw error
      setHandover({ ...handover, status: "reopened" })
      toast.info("Handover dibuka kembali untuk edit.")
      router.push(`/handover/${params.id}/edit`)
    } catch (error) {
      console.error("Error:", error)
      toast.error("Gagal membuka kembali handover.")
    } finally {
      setReopening(false)
    }
  }

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
    }
    fetchData()
  }, [params.id, supabase])

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

  const handleDelete = async () => {
    if (String(handover?.status || "") === "approved") {
      toast.error("Handover yang sudah disetujui tidak dapat dihapus.")
      return
    }
    const ok = await confirm("Hapus Handover?", `Anda yakin ingin menghapus ${String(handover?.form_number || "")}? Seluruh data terkait (log kegiatan, persetujuan, dan lainnya) ikut terhapus. Tindakan ini tidak dapat dibatalkan.`, { confirmLabel: "Ya, Hapus", variant: "danger" })
    if (!ok) return
    try {
      const { error } = await supabase.from("handovers").delete().eq("id", params.id)
      if (error) throw error
      toast.success("Handover berhasil dihapus.")
      router.push("/approvals")
    } catch (error) {
      console.error("Error deleting:", error)
      toast.error("Gagal menghapus handover.")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground mt-2">Loading handover details...</p>
        </div>
      </div>
    )
  }

  if (!handover) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-lg font-semibold">Handover not found</h2>
        <Button variant="outline" onClick={() => router.push(isSupervisor ? "/dashboard" : "/handover")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {isSupervisor ? "Back to Dashboard" : "Back to Handover"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push(isSupervisor ? "/dashboard" : "/handover")} className="shrink-0 self-start">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">{String(handover.form_number || "")}</h1>
            <Badge className={getStatusBadge(String(handover.status || ""))}>{String(handover.status)}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {String((handover.shifts as Record<string, unknown> | null)?.name || "")} &middot;{" "}
            {new Date(String(handover.tanggal || "")).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={() => router.push(`/handover/${params.id}/print`)}>
            <Printer className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Cetak PDF</span>
            <span className="sm:hidden">Cetak</span>
          </Button>
          {handover
            && ["draft", "reopened"].includes(String(handover.status || ""))
            && (isSupervisor || String(handover.operator_id || "") === String(user?.id || "")) && (
            <Button size="sm" onClick={() => router.push(`/handover/${params.id}/edit`)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isSupervisor && handover && ["approved", "rejected", "submitted"].includes(String(handover.status || "")) && (
            <Button variant="outline" size="sm" onClick={handleReopen} disabled={reopening}>
              {reopening ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Reopen
            </Button>
          )}
          {isSupervisor && (
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive" aria-label="Hapus handover">
              <Trash2 className="h-4 w-4 mr-1" />
              Hapus
            </Button>
          )}
        </div>
      </div>

      <div className="bg-muted/30 p-2 sm:p-4 rounded-xl border">
        <ResponsiveScale baseWidth={800}>
          <ShiftHandoverDocument handover={handover} activities={activities} />
        </ResponsiveScale>
      </div>
    </div>
  )
}
