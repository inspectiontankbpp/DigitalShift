"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/contexts/user-context"
import { useToast } from "@/contexts/toast-context"
import { useConfirm } from "@/contexts/confirm-context"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, X, FileText, RotateCcw, Trash2, RefreshCw } from "lucide-react"

interface Handover {
  id: string
  form_number: string
  tanggal: string
  status: string
  kondisi_operasional: string
  kendala: string | null
  safety_issue: string | null
  catatan: string | null
  submitted_at: string | null
  approved_at: string | null
  shifts: { name: string } | null
  profiles: { full_name: string } | null
}

export default function ApprovalsPage() {
  const { user, profile, loading: authLoading } = useUser()
  const router = useRouter()
  const toast = useToast()
  const { confirm: confirmDialog } = useConfirm()
  const supabase = createClient()
  const isSupervisor = profile?.role === "supervisor"
  const [activeTab, setActiveTab] = useState<"review" | "riwayat">("review")
  const [pendingHandovers, setPendingHandovers] = useState<Handover[]>([])
  const [historyHandovers, setHistoryHandovers] = useState<Handover[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: pending } = await supabase
      .from("handovers")
      .select("*, shifts(name), profiles:operator_id(full_name)")
      .in("status", ["submitted", "reopened"])
      .order("submitted_at", { ascending: false })
    if (pending) setPendingHandovers(pending as Handover[])

    const { data: history } = await supabase
      .from("handovers")
      .select("*, shifts(name), profiles:operator_id(full_name)")
      .in("status", ["approved", "rejected"])
      .order("approved_at", { ascending: false })
      .limit(50)
    if (history) setHistoryHandovers(history as Handover[])
  }, [supabase])

  // Initial fetch + realtime subscription
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (authLoading) return
    fetchData()

    const channel = supabase
      .channel("approvals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "handovers" }, () => {
        fetchData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, authLoading, fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    if (!user || profile?.role !== "supervisor") return
    const list = activeTab === "review" ? pendingHandovers : historyHandovers
    const target = list.find((h) => h.id === id)
    const form = target?.form_number || "handover ini"
    const ok = await confirmDialog(
      action === "approved" ? "Setujui Handover?" : "Tolak Handover?",
      action === "approved"
        ? `Anda yakin ingin menyetujui ${form}? Setelah disetujui, operator diizinkan membuat laporan berikutnya.`
        : `Anda yakin ingin menolak ${form}? Laporan akan ditandai ditolak dan tidak bisa dilanjutkan sampai diperbaiki.`,
      action === "approved"
        ? { confirmLabel: "Ya, Setujui", variant: "success" }
        : { confirmLabel: "Ya, Tolak", variant: "danger" }
    )
    if (!ok) return
    setActionLoading(id)

    try {
      const { error: handoverError } = await supabase
        .from("handovers")
        .update({
          status: action === "approved" ? "approved" : "rejected",
          supervisor_id: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()

      if (handoverError) throw handoverError

      await supabase.from("approvals").insert({
        handover_id: id,
        supervisor_id: user.id,
        status: action,
        approved_at: new Date().toISOString(),
      })

      setPendingHandovers((prev) => prev.filter((h) => h.id !== id))
      setHistoryHandovers((prev) => prev.filter((h) => h.id !== id))
      toast.success(action === "approved" ? "Handover berhasil disetujui!" : "Handover berhasil ditolak.")
    } catch (error) {
      console.error("Error:", error)
      toast.error(`Gagal ${action === "approved" ? "menyetujui" : "menolak"} handover.`)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReopen = async (id: string) => {
    const list = activeTab === "review" ? pendingHandovers : historyHandovers
    const target = list.find((h) => h.id === id)
    const form = target?.form_number || "handover ini"
    const ok = await confirmDialog(
      "Buka Kembali Handover?",
      `Anda yakin ingin membuka kembali ${form} untuk diedit?`,
      { confirmLabel: "Buka Lagi", variant: "warning" }
    )
    if (!ok) return
    setActionLoading(id)
    try {
      const { error } = await supabase
        .from("handovers")
        .update({ status: "reopened", reopened_at: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
      setPendingHandovers((prev) => prev.filter((h) => h.id !== id))
      setHistoryHandovers((prev) => prev.filter((h) => h.id !== id))
      toast.info("Handover dibuka kembali untuk edit.")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Gagal membuka kembali handover.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    const list = activeTab === "review" ? pendingHandovers : historyHandovers
    const target = list.find((h) => h.id === id)
    const form = target?.form_number || "handover ini"
    const ok = await confirmDialog(
      "Hapus Handover?",
      `Anda yakin ingin menghapus ${form}? Seluruh data terkait ikut terhapus.`,
      { confirmLabel: "Ya, Hapus", variant: "danger" }
    )
    if (!ok) return
    setActionLoading(id)
    try {
      const { error } = await supabase.from("handovers").delete().eq("id", id)
      if (error) throw error
      setPendingHandovers((prev) => prev.filter((h) => h.id !== id))
      setHistoryHandovers((prev) => prev.filter((h) => h.id !== id))
      toast.success("Handover berhasil dihapus.")
    } catch (error) {
      console.error("Error:", error)
      toast.error("Gagal menghapus handover.")
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const v: Record<string, "warning" | "success" | "outline" | "info" | "default"> = {
      submitted: "warning",
      approved: "success",
      rejected: "default",
      reopened: "info",
    }
    return v[status] || "outline"
  }

  const getStatusLabel = (status: string) => {
    const v: Record<string, string> = {
      submitted: "Menunggu",
      approved: "Disetujui",
      rejected: "Ditolak",
      reopened: "Dibuka Kembali",
    }
    return v[status] || status
  }

  const currentHandovers = activeTab === "review" ? pendingHandovers : historyHandovers

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Approvals</h1>
            <p className="text-muted-foreground mt-1 text-sm">Review dan persetujuan form shift handover</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => { setRefreshing(true); await fetchData(); setRefreshing(false) }}
            disabled={refreshing}
            className="self-start"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("review")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "review"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Perlu Review
          {pendingHandovers.length > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-xs">
              {pendingHandovers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("riwayat")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "riwayat"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Riwayat
        </button>
      </div>

      <div className="space-y-4">
        {currentHandovers.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{activeTab === "review" ? "Tidak ada handover yang perlu direview" : "Belum ada riwayat approval"}</p>
          </Card>
        ) : (
          currentHandovers.map((handover) => (
            <Card
              key={handover.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/handover/${handover.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  router.push(`/handover/${handover.id}`)
                }
              }}
              className="p-3 sm:p-4 cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm sm:text-base">{handover.form_number}</span>
                    <Badge variant={getStatusBadge(handover.status)}
                      className={handover.status === "rejected" ? "bg-red-600 text-white border-red-700 hover:bg-red-700" : ""}
                    >
                      {getStatusLabel(handover.status)}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {handover.shifts?.name} &middot;{" "}
                    {new Date(handover.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Operator: {handover.profiles?.full_name}
                  </p>
                  {handover.status === "approved" && (
                    <div className="mt-2 flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 text-xs font-medium">
                      <Check className="h-3 w-3" />
                      Disetujui &middot; {new Date(handover.approved_at || "").toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  {handover.status === "rejected" && (
                    <div className="mt-2 flex items-center gap-1.5 text-white bg-red-600 border border-red-700 rounded px-2 py-1 text-xs font-medium">
                      <X className="h-3 w-3" />
                      Ditolak &middot; {new Date(handover.approved_at || "").toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  {handover.safety_issue && (
                    <div className="mt-2 p-2 rounded bg-red-50 border border-red-200 text-xs">
                      <span className="text-red-600 font-medium">Safety: </span>
                      <span className="text-red-600">{handover.safety_issue}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {handover.submitted_at
                      ? new Date(handover.submitted_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "-"}
                  </span>
                </div>
              </div>

              <div
                className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/handover/${handover.id}`)}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Detail
                </Button>

                {isSupervisor && (
                  <>
                  {activeTab === "review" && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAction(handover.id, "approved")}
                        disabled={actionLoading === handover.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Setujui
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAction(handover.id, "rejected")}
                        disabled={actionLoading === handover.id}
                        className="text-white"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Tolak
                      </Button>
                    </>
                  )}

                  {activeTab === "riwayat" && (
                    <>
                      {handover.status === "approved" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReopen(handover.id)}
                          disabled={actionLoading === handover.id}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Reopen
                        </Button>
                      )}
                      {handover.status === "rejected" && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAction(handover.id, "approved")}
                            disabled={actionLoading === handover.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            Setujui
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReopen(handover.id)}
                            disabled={actionLoading === handover.id}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Reopen
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(handover.id)}
                        disabled={actionLoading === handover.id || handover.status === "approved"}
                        className="text-destructive hover:text-destructive"
                        aria-label="Hapus handover"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Hapus
                      </Button>
                    </>
                  )}
                  </>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
