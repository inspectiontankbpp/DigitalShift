"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { Plus, Trash2, Save, Send, Loader2, ArrowLeft, CheckSquare, Layers, AlertCircle } from "lucide-react"
import { ResponsiveScale } from "@/components/responsive-scale"
import { useToast } from "@/contexts/toast-context"
import { useUser } from "@/contexts/user-context"
import {
  DEFAULT_SAFETY_TOOLS,
  DEFAULT_CRITICAL_EQUIPMENT,
  getCurrentTimeValue,
  getTankProduct,
  normalizeActivityTime,
  TankLevel,
  TankProduct,
  QCCheck,
  CriticalEquipment,
  SafetyTool,
  TransferRequest,
  HandoverTeams,
  OperationalData
} from "@/lib/handover-types"

interface Activity {
  id?: string
  waktu: string
  aktivitas: string
  subs: string[]
}

const REGU_OPTIONS_FALLBACK = [
  { id: "regu1", name: "Pagi" },
  { id: "regu2", name: "Sore" },
  { id: "regu3", name: "Malam" },
]

const SHIFT_TIMES_FALLBACK: Record<string, { label: string }> = {
  regu1: { label: "06:00 s/d 14:00" },
  regu2: { label: "16:00 s/d 00:00" },
  regu3: { label: "22:00 s/d 06:00" },
}

interface ShiftOption {
  id: string
  name: string
  start_time: string
  end_time: string
}

function formatShiftTime(start: string, end: string) {
  const s = (start || "").slice(0, 5)
  const e = (end || "").slice(0, 5)
  return `${s} s/d ${e}`
}

export default function EditHandoverPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const { user, profile } = useUser()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0])
  const [reguShift, setReguShift] = useState("Sore")
  const [jamShift, setJamShift] = useState("16:00 s/d 00:00")
  const [selectedShift, setSelectedShift] = useState("")
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])

  const [tankLevels, setTankLevels] = useState<TankLevel[]>([])
  const [tankProducts, setTankProducts] = useState<TankProduct[]>([])
  const [qcChecks, setQcChecks] = useState<QCCheck[]>([])
  const [criticalEquipment, setCriticalEquipment] = useState<CriticalEquipment[]>(DEFAULT_CRITICAL_EQUIPMENT)
  const [safetyTools, setSafetyTools] = useState<SafetyTool[]>(DEFAULT_SAFETY_TOOLS)
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])
  const [teams, setTeams] = useState<HandoverTeams>({
    yangMenyerahkan: { danru: "", anggota1: "", anggota2: "", anggota3: "" },
    yangMenerima: { danru: "", anggota1: "", anggota2: "", anggota3: "" },
    mengetahui: { spv: "" }
  })
  const [activities, setActivities] = useState<Activity[]>([])
  const [pendingHandover, setPendingHandover] = useState<{ id: string; form_number: string; status: string } | null>(null)
  const [handoverStatus, setHandoverStatus] = useState("")
  const savingRef = useRef(false)

  useEffect(() => {
    async function fetchData() {
      if (!params.id) return
      setLoading(true)

      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("*")
        .eq("is_active", true)
        .order("start_time")
      if (shiftsData?.length) setShiftOptions(shiftsData as ShiftOption[])

      const { data: tankProductsData } = await supabase
        .from("tank_products")
        .select("no_tanki, produk")
        .eq("is_active", true)
        .order("sort_order")
      if (tankProductsData) setTankProducts(tankProductsData as TankProduct[])

      const { data: handoverData } = await supabase
        .from("handovers")
        .select("*")
        .eq("id", params.id)
        .single()

      if (!handoverData) {
        router.push("/dashboard")
        return
      }
      setHandoverStatus(String(handoverData.status || ""))
      if (user?.id && profile?.role === "operator") {
        const isOwner = String(handoverData.operator_id || "") === String(user.id)
        const editable = ["draft", "reopened"].includes(String(handoverData.status || ""))
        if (!isOwner || !editable) {
          toast.error("Handover ini hanya dapat diedit oleh operator pemilik setelah dibuka kembali supervisor.")
          router.push(`/handover/${params.id}`)
          return
        }
      }
      if (handoverData.shift_id) setSelectedShift(String(handoverData.shift_id))

      const op: OperationalData = handoverData.operational_data || {}
      if (handoverData.tanggal) setTanggal(String(handoverData.tanggal).split("T")[0])
      if (op.reguShift) setReguShift(op.reguShift)
      if (op.jamShift) setJamShift(op.jamShift)
      if (op.tankLevels?.length) {
        setTankLevels(
          op.tankLevels.map((row) => ({
            ...row,
            jam: normalizeActivityTime(row.jam || "")?.slice(0, 5) ?? "",
          }))
        )
      }
      if (op.qcChecks?.length) setQcChecks(op.qcChecks)
      if (op.criticalEquipment?.length) setCriticalEquipment(op.criticalEquipment)
      if (op.safetyTools?.length) setSafetyTools(op.safetyTools)
      if (op.transferRequests?.length) {
        const products = (tankProductsData as TankProduct[] | null) ?? []
        setTransferRequests(
          op.transferRequests.map((req) => ({
            ...req,
            namaProduk: req.namaProduk || getTankProduct(products, req.noTangki),
            estimasiJam: normalizeActivityTime(req.estimasiJam || "")?.slice(0, 5) ?? "",
          }))
        )
      }
      if (op.teams) setTeams(op.teams)

      // Fallback: if no shift_id stored, match by shift name
      if (!handoverData.shift_id && op.reguShift && shiftsData?.length) {
        const match = (shiftsData as ShiftOption[]).find((s) => s.name === op.reguShift)
        if (match) {
          setSelectedShift(match.id)
          setReguShift(match.name)
          setJamShift(formatShiftTime(match.start_time, match.end_time))
        }
      }

      const { data: activitiesData } = await supabase
        .from("handover_activities")
        .select("*")
        .eq("handover_id", params.id)
        .order("waktu")

      if (activitiesData?.length) {
        setActivities(activitiesData.map((a: Record<string, unknown>) => ({
          waktu: String(a.waktu || "").slice(0, 5),
          aktivitas: String(a.aktivitas || ""),
          subs: String(a.deskripsi || "").split(". ").filter((s: string) => s.trim() && s.trim() !== String(a.aktivitas || "")),
        })))
      }

      const { data: latestData } = await supabase
        .from("handovers")
        .select("id, form_number, status")
        .neq("id", params.id)
        .in("status", ["submitted", "rejected", "reopened"])
        .order("created_at", { ascending: false })
        .limit(1)
      if (latestData && latestData.length > 0) {
        setPendingHandover(latestData[0] as { id: string; form_number: string; status: string })
      }

      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, router, supabase, user?.id, profile?.role])

  const handleReguChange = (value: string) => {
    const shift = shiftOptions.find((s) => s.id === value)
    if (shift) {
      setSelectedShift(shift.id)
      setReguShift(shift.name)
      setJamShift(formatShiftTime(shift.start_time, shift.end_time))
      return
    }
    const fallback = REGU_OPTIONS_FALLBACK.find((r) => r.id === value)
    const timeInfo = SHIFT_TIMES_FALLBACK[value]
    if (fallback) setReguShift(fallback.name)
    if (timeInfo) setJamShift(timeInfo.label)
  }

  const handleSave = async (status: string) => {
    if (savingRef.current) return
    savingRef.current = true
    if (!user || !user.id) { savingRef.current = false; return }
    if (handoverStatus === "approved") {
      savingRef.current = false
      toast.error("Handover ini sudah disetujui dan tidak dapat diubah. Gunakan tombol Reopen oleh supervisor jika ingin merevisi.")
      return
    }
    if (profile?.role === "operator" && !["draft", "reopened"].includes(handoverStatus)) {
      savingRef.current = false
      toast.error("Handover ini hanya dapat diedit setelah dibuka kembali supervisor.")
      return
    }
    if (status === "submitted") {
      const { data: latestData } = await supabase
        .from("handovers")
        .select("id, form_number, status")
        .neq("id", params.id)
        .in("status", ["submitted", "rejected", "reopened"])
        .order("created_at", { ascending: false })
        .limit(1)
      if (latestData && latestData.length > 0) {
        savingRef.current = false
        toast.info(`Laporan ${String(latestData[0].form_number)} belum dicek supervisor. Submit diblokir sampai laporan tersebut disetujui.`)
        return
      }
    }
    setSaving(true)
    if (status === "submitted") setSubmitting(true)

    try {
      const operationalData: OperationalData = {
        reguShift,
        shiftName: reguShift,
        jamShift,
        tankLevels,
        qcChecks,
        criticalEquipment,
        safetyTools,
        transferRequests,
        teams,
      }

      const { error: handoverError } = await supabase
        .from("handovers")
        .update({
          shift_id: selectedShift || null,
          operational_data: operationalData as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
          ...(handoverStatus !== "draft"
            ? { status: "draft", submitted_at: null }
            : {}),
        })
        .eq("id", params.id)

      if (handoverError) throw handoverError

      const { error: deleteError } = await supabase
        .from("handover_activities")
        .delete()
        .eq("handover_id", params.id)
      if (deleteError) throw deleteError

      const activityRows = activities
        .filter((a) => a.aktivitas.trim() || a.subs.some((sub) => sub.trim()))
        .map((activity) => ({
          handover_id: params.id,
          waktu: normalizeActivityTime(activity.waktu),
          aktivitas: activity.aktivitas,
          deskripsi: [activity.aktivitas, ...activity.subs]
            .map((item) => item.trim())
            .filter(Boolean)
            .join(". "),
          status: "completed",
        }))

      if (activityRows.length > 0) {
        const { error: activityError } = await supabase
          .from("handover_activities")
          .insert(activityRows)
        if (activityError) throw activityError
      }

      if (status === "submitted") {
        const { error: submitError } = await supabase
          .from("handovers")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", params.id)
        if (submitError) throw submitError
      }

      router.push(`/handover/${params.id}`)
    } catch (error) {
      console.error("Error saving handover:", error)
      const message = (error as { message?: string })?.message
      toast.error(message || "Gagal menyimpan perubahan.")
    } finally {
      setSaving(false)
      setSubmitting(false)
      savingRef.current = false
    }
  }

  const addTankLevel = () => setTankLevels([...tankLevels, { jam: getCurrentTimeValue(), produk: "", noTanki: "", level: "", water: "", keterangan: "" }])
  const updateTankLevel = (idx: number, field: keyof TankLevel, value: string) => {
    const updated = [...tankLevels]
    updated[idx] = { ...updated[idx], [field]: value }
    setTankLevels(updated)
  }
  const updateTankNumber = (idx: number, value: string) => {
    const updated = [...tankLevels]
    updated[idx] = {
      ...updated[idx],
      noTanki: value,
      produk: value ? getTankProduct(tankProducts, value) || updated[idx].produk : "",
    }
    setTankLevels(updated)
  }
  const removeTankLevel = (idx: number) => setTankLevels(tankLevels.filter((_, i) => i !== idx))

  const addQcCheck = () => setQcChecks([...qcChecks, { noSarfas: "", visual: "", density: "", temperatur: "", keterangan: "" }])
  const updateQcCheck = (idx: number, field: keyof QCCheck, value: string) => {
    const updated = [...qcChecks]
    updated[idx] = { ...updated[idx], [field]: value }
    setQcChecks(updated)
  }
  const removeQcCheck = (idx: number) => setQcChecks(qcChecks.filter((_, i) => i !== idx))

  const updateCriticalEq = (idx: number, field: keyof CriticalEquipment, value: string) => {
    const updated = [...criticalEquipment]
    updated[idx] = { ...updated[idx], [field]: value }
    setCriticalEquipment(updated)
  }
  const addCriticalEq = (kategori: string) => {
    setCriticalEquipment([...criticalEquipment, { kategori: kategori as "Penerimaan" | "Penimbunan" | "Penyaluran", namaPeralatan: "", status: "OK", kondisi: "Berfungsi", keterangan: "" }])
  }
  const removeCriticalEq = (idx: number) => setCriticalEquipment(criticalEquipment.filter((_, i) => i !== idx))

  const updateSafetyTool = (idx: number, field: keyof SafetyTool, value: string) => {
    const updated = [...safetyTools]
    updated[idx] = { ...updated[idx], [field]: value }
    setSafetyTools(updated)
  }
  const addSafetyTool = () => setSafetyTools([...safetyTools, { nama: "", status: "ADA", kondisi: "Berfungsi", keterangan: "" }])
  const removeSafetyTool = (idx: number) => setSafetyTools(safetyTools.filter((_, i) => i !== idx))

  const addTransferRequest = () => setTransferRequests([...transferRequests, { noTangki: "", namaProduk: "", estJumlahKL: "", estimasiJam: "", keterangan: "" }])
  const updateTransferRequest = (idx: number, field: keyof TransferRequest, value: string) => {
    const updated = [...transferRequests]
    updated[idx] = { ...updated[idx], [field]: value }
    setTransferRequests(updated)
  }
  const updateTransferTankNumber = (idx: number, value: string) => {
    const updated = [...transferRequests]
    updated[idx] = {
      ...updated[idx],
      noTangki: value,
      namaProduk: value ? getTankProduct(tankProducts, value) || updated[idx].namaProduk : "",
    }
    setTransferRequests(updated)
  }
  const removeTransferRequest = (idx: number) => setTransferRequests(transferRequests.filter((_, i) => i !== idx))

  const addActivity = () => setActivities([...activities, { waktu: getCurrentTimeValue(), aktivitas: "", subs: [""] }])
  const removeActivity = (idx: number) => setActivities(activities.filter((_, i) => i !== idx))
  const updateActivity = (idx: number, field: keyof Activity, value: string) => {
    const updated = [...activities]
    updated[idx] = { ...updated[idx], [field]: value }
    setActivities(updated)
  }
  const updateSub = (actIdx: number, subIdx: number, value: string) => {
    const updated = [...activities]
    const subs = [...updated[actIdx].subs]
    subs[subIdx] = value
    updated[actIdx] = { ...updated[actIdx], subs }
    setActivities(updated)
  }
  const addSub = (actIdx: number) => {
    const updated = [...activities]
    updated[actIdx] = { ...updated[actIdx], subs: [...updated[actIdx].subs, ""] }
    setActivities(updated)
  }
  const removeSub = (actIdx: number, subIdx: number) => {
    const updated = [...activities]
    updated[actIdx] = { ...updated[actIdx], subs: updated[actIdx].subs.filter((_, i) => i !== subIdx) }
    setActivities(updated)
  }

  const getHariName = (dateStr: string) => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    const d = new Date(dateStr)
    return days[d.getDay()]
  }
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.push(`/handover/${params.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Shift Handover</h1>
          <p className="text-muted-foreground mt-1">Perbarui data operasional dan log kegiatan</p>
        </div>
      </div>

      {pendingHandover && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="space-y-1">
            <span className="font-semibold block">Submit diblokir: laporan sebelumnya belum dicek supervisor</span>
            Laporan <span className="font-medium">{pendingHandover.form_number}</span> (status: {pendingHandover.status}) masih menunggu
            persetujuan supervisor. Anda hanya bisa menyimpan draft sampai laporan tersebut disetujui.
          </p>
        </div>
      )}

      <ResponsiveScale baseWidth={800}>
      <form onSubmit={(e) => { e.preventDefault(); handleSave("submitted") }} className="space-y-6">
        <Card className="p-0 overflow-hidden">
          <div className="bg-primary/5 p-4 border-b">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hari / Tanggal</Label>
                <div className="text-sm font-medium">
                  {tanggal ? `${getHariName(tanggal)} / ${formatDate(tanggal)}` : "-"}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Regu Shift</Label>
                <Select value={selectedShift} onValueChange={handleReguChange}>
                  <SelectTrigger><SelectValue placeholder="Pilih regu" /></SelectTrigger>
                  <SelectContent>
                    {shiftOptions.length > 0 ? (
                      shiftOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))
                    ) : (
                      REGU_OPTIONS_FALLBACK.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Jam Shift</Label>
                <Input value={jamShift} onChange={(e) => setJamShift(e.target.value)} readOnly />
              </div>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide">Detail Kegiatan / Aktifitas</h2>
              <Button type="button" variant="outline" size="sm" onClick={addActivity}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
              </Button>
            </div>

            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={index} className="space-y-1.5 p-3 rounded-lg border bg-muted/10">
                  <div className="flex gap-2 items-start">
                    <div className="w-24 sm:w-28 shrink-0">
                      <Input
                        type="time"
                        step="60"
                        aria-label="Jam aktivitas"
                        value={activity.waktu}
                        onChange={(e) => updateActivity(index, "waktu", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <Input placeholder="Nama Aktivitas / Bab" value={activity.aktivitas} onChange={(e) => updateActivity(index, "aktivitas", e.target.value)} className="h-8 text-xs font-medium" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeActivity(index)} disabled={activities.length === 1}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {activity.subs.map((sub, subIdx) => (
                    <div key={subIdx} className="flex gap-2 items-start pl-10">
                      <span className="text-xs text-muted-foreground pt-2 w-3">-</span>
                      <div className="flex-1">
                        <Input placeholder="Detail sub aktivitas" value={sub} onChange={(e) => updateSub(index, subIdx, e.target.value)} className="h-7 text-xs" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSub(index, subIdx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2 pl-7">
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => addSub(index)}>
                      <Plus className="h-3 w-3 mr-1" /> Sub aktivitas
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Pengukuran Level Tangki & Quality Control
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Pengukuran Manual Level & Water Tangki Timbun</h3>
              <Button type="button" variant="outline" size="sm" onClick={addTankLevel}><Plus className="h-3.5 w-3.5 mr-1" /> Tangki</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-muted/50">
                  <th className="border px-2 py-1.5 text-left font-medium">JAM</th>
                  <th className="border px-2 py-1.5 text-left font-medium">PRODUK</th>
                  <th className="border px-2 py-1.5 text-left font-medium">No.Tanki</th>
                  <th className="border px-2 py-1.5 text-left font-medium">LEVEL</th>
                  <th className="border px-2 py-1.5 text-left font-medium">WATER</th>
                  <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                  <th className="border px-1 py-1.5 w-8"></th>
                </tr></thead>
                <tbody>
                  {tankLevels.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border px-1 py-1">
                        <Input
                          type="time"
                          step="60"
                          aria-label="Jam pengukuran"
                          className="h-7 text-xs"
                          value={row.jam}
                          onChange={(e) => updateTankLevel(idx, "jam", e.target.value)}
                        />
                      </td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.produk} onChange={(e) => updateTankLevel(idx, "produk", e.target.value)} placeholder="Otomatis" /></td>
                      <td className="border px-1 py-1">
                        <select
                          aria-label="No. Tangki"
                          className="h-7 w-full rounded-md border border-input bg-background px-1 text-xs"
                          value={row.noTanki}
                          onChange={(e) => updateTankNumber(idx, e.target.value)}
                        >
                          <option value="">Pilih</option>
                          {tankProducts.map((product) => (
                            <option key={product.no_tanki} value={product.no_tanki}>
                              {product.no_tanki}
                            </option>
                          ))}
                          {row.noTanki && !tankProducts.some((product) => product.no_tanki === row.noTanki) && (
                            <option value={row.noTanki}>{row.noTanki}</option>
                          )}
                        </select>
                      </td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.level} onChange={(e) => updateTankLevel(idx, "level", e.target.value)} placeholder="400 mm" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.water} onChange={(e) => updateTankLevel(idx, "water", e.target.value)} placeholder="0 mm" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.keterangan} onChange={(e) => updateTankLevel(idx, "keterangan", e.target.value)} placeholder="Temp 28.75°C" /></td>
                      <td className="border px-1 py-1 text-center"><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTankLevel(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Pemeriksaan Quality Control</h3>
              <Button type="button" variant="outline" size="sm" onClick={addQcCheck}><Plus className="h-3.5 w-3.5 mr-1" /> QC</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-muted/50">
                  <th className="border px-2 py-1.5 text-left font-medium">No. Sarfas</th>
                  <th className="border px-2 py-1.5 text-left font-medium">Visual</th>
                  <th className="border px-2 py-1.5 text-left font-medium">Density</th>
                  <th className="border px-2 py-1.5 text-left font-medium">Temperatur</th>
                  <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                  <th className="border px-1 py-1.5 w-8"></th>
                </tr></thead>
                <tbody>
                  {qcChecks.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.noSarfas} onChange={(e) => updateQcCheck(idx, "noSarfas", e.target.value)} placeholder="T-3 (A-24)" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.visual} onChange={(e) => updateQcCheck(idx, "visual", e.target.value)} placeholder="Jernih, Kehijauan" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.density} onChange={(e) => updateQcCheck(idx, "density", e.target.value)} placeholder="0.7530" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.temperatur} onChange={(e) => updateQcCheck(idx, "temperatur", e.target.value)} placeholder="31°C" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.keterangan} onChange={(e) => updateQcCheck(idx, "keterangan", e.target.value)} placeholder="Sampel 5 menit" /></td>
                      <td className="border px-1 py-1 text-center"><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQcCheck(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" />Pemeriksaan Peralatan Operasi Kritikal</h2>
          <div className="space-y-6">
            {["Penerimaan", "Penimbunan", "Penyaluran"].map((area) => {
              const items = criticalEquipment.filter((e) => e.kategori === area)
              return (
                <div key={area}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm bg-muted/30 px-3 py-1.5 rounded">{area}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => addCriticalEq(area)}><Plus className="h-3 w-3 mr-1" /> Tambah</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-muted/50">
                        <th className="border px-2 py-1.5 text-left font-medium">Nama Peralatan</th>
                        <th className="border px-2 py-1.5 text-left font-medium w-28">Status</th>
                        <th className="border px-2 py-1.5 text-left font-medium w-28">Kondisi</th>
                        <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                        <th className="border px-1 py-1.5 w-8"></th>
                      </tr></thead>
                      <tbody>
                        {items.map((eq) => {
                          const idx = criticalEquipment.indexOf(eq)
                          return (
                            <tr key={eq.id || `${area}-${criticalEquipment.indexOf(eq)}`}>
                              <td className="border px-1 py-1"><Input className="h-7 text-xs" value={eq.namaPeralatan} onChange={(e) => updateCriticalEq(idx, "namaPeralatan", e.target.value)} placeholder="Nama peralatan..." /></td>
                              <td className="border px-1 py-1">
                                <Select value={eq.status} onValueChange={(v) => updateCriticalEq(idx, "status", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="OK">OK</SelectItem>
                                    <SelectItem value="Tidak OK">Tidak OK</SelectItem>
                                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                                    <SelectItem value="Tidak Digunakan">Tidak Digunakan</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border px-1 py-1">
                                <Select value={eq.kondisi} onValueChange={(v) => updateCriticalEq(idx, "kondisi", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Berfungsi">Berfungsi</SelectItem>
                                    <SelectItem value="Tidak Berfungsi">Tidak Berfungsi</SelectItem>
                                    <SelectItem value="Perlu Perbaikan">Perlu Perbaikan</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="border px-1 py-1"><Input className="h-7 text-xs" value={eq.keterangan} onChange={(e) => updateCriticalEq(idx, "keterangan", e.target.value)} placeholder="-" /></td>
                              <td className="border px-1 py-1 text-center"><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCriticalEq(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary" />Pemeriksaan Perlengkapan Safety</h2>
            <Button type="button" variant="outline" size="sm" onClick={addSafetyTool}><Plus className="h-3.5 w-3.5 mr-1" /> Tambah</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-muted/50">
                <th className="border px-2 py-1.5 text-left font-medium">Nama Perlengkapan</th>
                <th className="border px-2 py-1.5 text-left font-medium w-24">Status</th>
                <th className="border px-2 py-1.5 text-left font-medium w-28">Kondisi</th>
                <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                <th className="border px-1 py-1.5 w-8"></th>
              </tr></thead>
              <tbody>
                {safetyTools.map((tool, idx) => (
                  <tr key={idx}>
                    <td className="border px-1 py-1"><Input className="h-7 text-xs" value={tool.nama} onChange={(e) => updateSafetyTool(idx, "nama", e.target.value)} placeholder="Nama alat..." /></td>
                    <td className="border px-1 py-1">
                      <Select value={tool.status} onValueChange={(v) => updateSafetyTool(idx, "status", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="ADA">Ada</SelectItem><SelectItem value="TIDAK ADA">Tidak Ada</SelectItem></SelectContent>
                      </Select>
                    </td>
                    <td className="border px-1 py-1">
                      <Select value={tool.kondisi} onValueChange={(v) => updateSafetyTool(idx, "kondisi", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Berfungsi">Berfungsi</SelectItem><SelectItem value="Tidak Berfungsi">Tidak Berfungsi</SelectItem><SelectItem value="Rusak">Rusak</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem></SelectContent>
                      </Select>
                    </td>
                    <td className="border px-1 py-1"><Input className="h-7 text-xs" value={tool.keterangan} onChange={(e) => updateSafetyTool(idx, "keterangan", e.target.value)} placeholder="-" /></td>
                    <td className="border px-1 py-1 text-center"><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSafetyTool(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Permintaan Transfer Tangki</h2>
            <Button type="button" variant="outline" size="sm" onClick={addTransferRequest}><Plus className="h-3.5 w-3.5 mr-1" /> Transfer</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-muted/50">
                <th className="border px-2 py-1.5 text-left font-medium">No. Tangki</th>
                <th className="border px-2 py-1.5 text-left font-medium">Nama Produk</th>
                <th className="border px-2 py-1.5 text-left font-medium">Est.Jumlah (KL)</th>
                <th className="border px-2 py-1.5 text-left font-medium">Estimasi (Jam)</th>
                <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                <th className="border px-1 py-1.5 w-8"></th>
              </tr></thead>
              <tbody>
                {transferRequests.map((req, idx) => (
                  <tr key={idx}>
                    <td className="border px-1 py-1">
                      <select
                        aria-label="No. Tangki"
                        className="h-7 w-full rounded-md border border-input bg-background px-1 text-xs"
                        value={req.noTangki}
                        onChange={(e) => updateTransferTankNumber(idx, e.target.value)}
                      >
                        <option value="">Pilih</option>
                        {tankProducts.map((product) => (
                          <option key={product.no_tanki} value={product.no_tanki}>
                            {product.no_tanki}
                          </option>
                        ))}
                        {req.noTangki && !tankProducts.some((product) => product.no_tanki === req.noTangki) && (
                          <option value={req.noTangki}>{req.noTangki}</option>
                        )}
                      </select>
                    </td>
                    <td className="border px-1 py-1"><Input className="h-7 text-xs" value={req.namaProduk} onChange={(e) => updateTransferRequest(idx, "namaProduk", e.target.value)} placeholder="Otomatis" /></td>
                    <td className="border px-1 py-1"><Input className="h-7 text-xs" value={req.estJumlahKL} onChange={(e) => updateTransferRequest(idx, "estJumlahKL", e.target.value)} placeholder="300" /></td>
                    <td className="border px-1 py-1">
                      <Input
                        type="time"
                        step="60"
                        aria-label="Estimasi jam transfer"
                        className="h-7 text-xs"
                        value={req.estimasiJam}
                        onChange={(e) => updateTransferRequest(idx, "estimasiJam", e.target.value)}
                      />
                    </td>
                    <td className="border px-1 py-1"><Input className="h-7 text-xs" value={req.keterangan} onChange={(e) => updateTransferRequest(idx, "keterangan", e.target.value)} placeholder="Roas KPI 0288" /></td>
                    <td className="border px-1 py-1 text-center"><Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTransferRequest(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Tim Serah Terima</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-medium text-sm bg-primary/5 px-3 py-1.5 rounded text-center">Yang Menyerahkan</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Pws / Danru Shift</Label><Input className="h-8 text-xs" value={teams.yangMenyerahkan.danru} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, danru: e.target.value}})} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Anggota 1</Label><Input className="h-8 text-xs" value={teams.yangMenyerahkan.anggota1} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, anggota1: e.target.value}})} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Anggota 2</Label><Input className="h-8 text-xs" value={teams.yangMenyerahkan.anggota2} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, anggota2: e.target.value}})} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Anggota 3</Label><Input className="h-8 text-xs" value={teams.yangMenyerahkan.anggota3} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, anggota3: e.target.value}})} /></div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium text-sm bg-primary/5 px-3 py-1.5 rounded text-center">Yang Menerima</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Pws / Danru Shift</Label><Input className="h-8 text-xs" value={teams.yangMenerima.danru} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, danru: e.target.value}})} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Anggota 1</Label><Input className="h-8 text-xs" value={teams.yangMenerima.anggota1} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, anggota1: e.target.value}})} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Anggota 2</Label><Input className="h-8 text-xs" value={teams.yangMenerima.anggota2} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, anggota2: e.target.value}})} /></div>
                <div className="flex items-center gap-2"><Label className="text-xs w-24">Anggota 3</Label><Input className="h-8 text-xs" value={teams.yangMenerima.anggota3} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, anggota3: e.target.value}})} /></div>
              </div>
            </div>
          </div>
          <div className="border-t pt-3 mt-3">
            <p className="font-medium text-sm mb-3 text-center">Mengetahui</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2"><Label className="text-xs w-28 shrink-0">Danru</Label><Input className="h-8 text-xs flex-1" readOnly value={teams.yangMenyerahkan.danru} /></div>
              <div className="flex items-center gap-2"><Label className="text-xs w-28 shrink-0">Sr. Spv II Fuel & LPG RSD</Label><Input className="h-8 text-xs flex-1" value={teams.mengetahui.spv} onChange={(e) => setTeams({...teams, mengetahui: {...teams.mengetahui, spv: e.target.value}})} placeholder="Nama" /></div>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push(`/handover/${params.id}`)} disabled={saving}>Batal</Button>
          <Button type="button" variant="outline" onClick={() => handleSave("draft")} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />Simpan Draft
          </Button>
          <Button type="submit" disabled={saving || !!pendingHandover} title={pendingHandover ? "Tunggu persetujuan supervisor untuk laporan sebelumnya" : undefined}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : <><Send className="h-4 w-4 mr-2" />Simpan & Submit</>}
          </Button>
        </div>
      </form>
      </ResponsiveScale>
    </div>
  )
}
