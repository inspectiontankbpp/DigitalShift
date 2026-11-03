"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { useToast } from "@/contexts/toast-context"
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
import { Plus, Trash2, Save, Send, Loader2, CheckSquare, Layers, AlertCircle } from "lucide-react"
import { ResponsiveScale } from "@/components/responsive-scale"
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

const SHIFT_TIMES_FALLBACK: Record<string, { label: string; start: string; end: string }> = {
  regu1: { label: "06:00 s/d 14:00", start: "06:00", end: "14:00" },
  regu2: { label: "16:00 s/d 00:00", start: "16:00", end: "00:00" },
  regu3: { label: "22:00 s/d 06:00", start: "22:00", end: "06:00" },
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

export default function HandoverFormPage() {
  const router = useRouter()
  const { user, profile } = useUser()
  const toast = useToast()
  const supabase = createClient()

  const [selectedShift, setSelectedShift] = useState("")
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([])
  const [tanggal] = useState(new Date().toISOString().split("T")[0])
  const [kondisiOperasional] = useState("normal")
  const [submitting, setSubmitting] = useState(false)
  const [pendingHandover, setPendingHandover] = useState<{ id: string; form_number: string; status: string } | null>(null)
  const submittingRef = useRef(false)

  const [reguShift, setReguShift] = useState("Sore")
  const [jamShift, setJamShift] = useState("16:00 s/d 00:00")

  const [tankLevels, setTankLevels] = useState<TankLevel[]>([])
  const [tankProducts, setTankProducts] = useState<TankProduct[]>([])

  const [qcChecks, setQcChecks] = useState<QCCheck[]>([])

  const [criticalEquipment, setCriticalEquipment] = useState<CriticalEquipment[]>(DEFAULT_CRITICAL_EQUIPMENT)
  const [safetyTools, setSafetyTools] = useState<SafetyTool[]>(DEFAULT_SAFETY_TOOLS)

  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([])

  const [teams, setTeams] = useState<HandoverTeams>({
    yangMenyerahkan: { danru: profile?.full_name || "", anggota1: "", anggota2: "", anggota3: "" },
    yangMenerima: { danru: "", anggota1: "", anggota2: "", anggota3: "" },
    mengetahui: { spv: "" }
  })

  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    async function loadData() {
      const { data: shiftsData } = await supabase
        .from("shifts")
        .select("*")
        .eq("is_active", true)
        .order("start_time")
      if (shiftsData && shiftsData.length > 0) {
        setShiftOptions(shiftsData as ShiftOption[])
        const first = shiftsData[0] as ShiftOption
        setSelectedShift(first.id)
        setReguShift(first.name)
        setJamShift(formatShiftTime(first.start_time, first.end_time))
      }

      const { data: tankProductsData } = await supabase
        .from("tank_products")
        .select("no_tanki, produk")
        .eq("is_active", true)
        .order("sort_order")
      if (tankProductsData) setTankProducts(tankProductsData as TankProduct[])

      if (!user?.id) return
      const { data: latestData } = await supabase
        .from("handovers")
        .select("id, form_number, status")
        .in("status", ["submitted", "rejected", "reopened"])
        .order("created_at", { ascending: false })
        .limit(1)
      if (latestData && latestData.length > 0) {
        setPendingHandover(latestData[0] as { id: string; form_number: string; status: string })
      }
    }
    loadData()
  }, [supabase, user?.id])

  const addActivity = () => {
    setActivities([...activities, { waktu: getCurrentTimeValue(), aktivitas: "", subs: [""] }])
  }

  const removeActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index))
  }

  const updateActivity = (index: number, field: keyof Activity, value: string) => {
    const updated = [...activities]
    updated[index] = { ...updated[index], [field]: value }
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

  const addTankLevel = () => {
    setTankLevels([...tankLevels, { jam: getCurrentTimeValue(), produk: "", noTanki: "", level: "", water: "", keterangan: "" }])
  }

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

  const removeTankLevel = (idx: number) => {
    setTankLevels(tankLevels.filter((_, i) => i !== idx))
  }

  const addQcCheck = () => {
    setQcChecks([...qcChecks, { noSarfas: "", visual: "", density: "", temperatur: "", keterangan: "" }])
  }

  const updateQcCheck = (idx: number, field: keyof QCCheck, value: string) => {
    const updated = [...qcChecks]
    updated[idx] = { ...updated[idx], [field]: value }
    setQcChecks(updated)
  }

  const removeQcCheck = (idx: number) => {
    setQcChecks(qcChecks.filter((_, i) => i !== idx))
  }

  const updateCriticalEq = (idx: number, field: keyof CriticalEquipment, value: string) => {
    const updated = [...criticalEquipment]
    updated[idx] = { ...updated[idx], [field]: value }
    setCriticalEquipment(updated)
  }

  const addCriticalEq = (kategori: string) => {
    setCriticalEquipment([...criticalEquipment, { kategori: kategori as CriticalEquipment["kategori"], namaPeralatan: "", status: "OK", kondisi: "Berfungsi", keterangan: "" }])
  }

  const removeCriticalEq = (idx: number) => {
    setCriticalEquipment(criticalEquipment.filter((_, i) => i !== idx))
  }

  const updateSafetyTool = (idx: number, field: keyof SafetyTool, value: string) => {
    const updated = [...safetyTools]
    updated[idx] = { ...updated[idx], [field]: value }
    setSafetyTools(updated)
  }

  const addSafetyTool = () => {
    setSafetyTools([...safetyTools, { nama: "", status: "ADA", kondisi: "Berfungsi", keterangan: "" }])
  }

  const removeSafetyTool = (idx: number) => {
    setSafetyTools(safetyTools.filter((_, i) => i !== idx))
  }

  const addTransferRequest = () => {
    setTransferRequests([...transferRequests, { noTangki: "", namaProduk: "", estJumlahKL: "", estimasiJam: "", keterangan: "" }])
  }

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

  const removeTransferRequest = (idx: number) => {
    setTransferRequests(transferRequests.filter((_, i) => i !== idx))
  }

  const handleReguChange = (value: string) => {
    const shift = shiftOptions.find((s) => s.id === value)
    if (!shift) {
      const fallback = REGU_OPTIONS_FALLBACK.find((r) => r.id === value)
      const timeInfo = SHIFT_TIMES_FALLBACK[value]
      if (fallback) setReguShift(fallback.name)
      if (timeInfo) setJamShift(timeInfo.label)
      return
    }
    setSelectedShift(shift.id)
    setReguShift(shift.name)
    setJamShift(formatShiftTime(shift.start_time, shift.end_time))
  }

  const generateFormNumber = () => {
    const date = new Date()
    const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "")
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
    return `SH-${yyyymmdd}-${random}`
  }

  const handleSubmit = async (status: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    if (!user || !user.id || !selectedShift) { submittingRef.current = false; return }
    if (status === "submitted") {
      const { data: latestData } = await supabase
        .from("handovers")
        .select("id, form_number, status")
        .in("status", ["submitted", "rejected", "reopened"])
        .order("created_at", { ascending: false })
        .limit(1)
      if (latestData && latestData.length > 0) {
        submittingRef.current = false
        toast.error(`Laporan ${String(latestData[0].form_number)} belum dicek supervisor. Submit diblokir sampai laporan tersebut disetujui.`)
        return
      }
    }
    setSubmitting(true)

    try {
      const formNumber = generateFormNumber()
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

      const { data: handover, error: handoverError } = await supabase
        .from("handovers")
        .insert({
          form_number: formNumber,
          tanggal,
          shift_id: selectedShift,
          operator_id: user.id,
          kondisi_operasional: kondisiOperasional,
          status: "draft",
          operational_data: operationalData as unknown as Record<string, unknown>,
          submitted_at: null,
        })
        .select()
        .single()

      if (handoverError) {
        console.error("Supabase error:", JSON.stringify(handoverError, null, 2))
        toast.error(`Gagal ${status === "submitted" ? "submit" : "simpan"} handover: ${handoverError.message || "Unknown error"}`)
        throw handoverError
      }
      if (!handover) throw new Error("Failed to create handover")

      const handoverId = handover.id

      const activityRows = activities
        .filter((a) => a.aktivitas.trim() || a.subs.some((sub) => sub.trim()))
        .map((activity) => ({
          handover_id: handoverId,
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
        if (activityError) {
          await supabase.from("handovers").delete().eq("id", handoverId)
          throw activityError
        }
      }

      if (status === "submitted") {
        const { error: submitError } = await supabase
          .from("handovers")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", handoverId)
        if (submitError) {
          await supabase.from("handovers").delete().eq("id", handoverId)
          throw submitError
        }

        toast.success("Handover berhasil disubmit!")
        router.push(`/handover/${handoverId}`)
      } else {
        toast.success("Draft berhasil disimpan!")
        router.push(`/handover/${handoverId}`)
      }
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; hint?: string; code?: string }
      console.error("Error creating handover:", JSON.stringify(error) || error)
      toast.error(err?.message || err?.details || err?.hint || "Gagal membuat handover.")
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }

  const getHariName = (dateStr: string) => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
    const d = new Date(dateStr)
    return days[d.getDay()]
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Formulir Serah Terima Shift</h1>
          <p className="text-muted-foreground mt-1 text-sm">Lengkapi log aktifitas dan data operasional shift</p>
        </div>
      </div>

      {pendingHandover && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Submit diblokir: laporan sebelumnya belum dicek supervisor</p>
            <p>
              Laporan <span className="font-medium">{pendingHandover.form_number}</span> (status: {pendingHandover.status}) masih menunggu
              persetujuan supervisor. Laporan ini harus disetujui{" "}
              <Link href={`/handover/${pendingHandover.id}`} className="underline text-amber-800 font-medium">sebelum Anda membuat laporan baru</Link>.
            </p>
          </div>
        </div>
      )}

      <ResponsiveScale baseWidth={800}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit("submitted")
        }}
        className="space-y-6"
      >
        {/* Header - matches original form */}
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
                <Label htmlFor="reguShift">Regu Shift</Label>
                <Select value={selectedShift} onValueChange={handleReguChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih regu" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftOptions.length > 0 ? (
                      shiftOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))
                    ) : (
                      REGU_OPTIONS_FALLBACK.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="jamShift">Jam Shift</Label>
                <Input
                  id="jamShift"
                  value={jamShift}
                  onChange={(e) => setJamShift(e.target.value)}
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Detail Kegiatan */}
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
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Nama Aktivitas / Bab"
                        value={activity.aktivitas}
                        onChange={(e) => updateActivity(index, "aktivitas", e.target.value)}
                        className="h-8 text-xs font-medium"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeActivity(index)}
                      disabled={activities.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>

                  {activity.subs.map((sub, subIdx) => (
                    <div key={subIdx} className="flex gap-2 items-start pl-6 sm:pl-10">
                      <span className="text-xs text-muted-foreground pt-2 w-3">-</span>
                      <div className="flex-1 min-w-0">
                        <Input
                          placeholder="Detail sub aktivitas"
                          value={sub}
                          onChange={(e) => updateSub(index, subIdx, e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removeSub(index, subIdx)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2 pl-5 sm:pl-7">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => addSub(index)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Sub aktivitas
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Pengukuran Tangki & Quality Control */}
        <Card className="p-6 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Pengukuran Level Tangki & Quality Control
          </h2>

          {/* Table Level Tangki */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Pengukuran Manual Level & Water Tangki Timbun</h3>
              <Button type="button" variant="outline" size="sm" onClick={addTankLevel}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Tangki
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border px-2 py-1.5 text-left font-medium">JAM</th>
                    <th className="border px-2 py-1.5 text-left font-medium">PRODUK</th>
                    <th className="border px-2 py-1.5 text-left font-medium">No.Tanki</th>
                    <th className="border px-2 py-1.5 text-left font-medium">LEVEL</th>
                    <th className="border px-2 py-1.5 text-left font-medium">WATER</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                    <th className="border px-1 py-1.5 w-8"></th>
                  </tr>
                </thead>
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
                      <td className="border px-1 py-1 text-center">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTankLevel(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table QC Checks */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Pemeriksaan Quality Control</h3>
              <Button type="button" variant="outline" size="sm" onClick={addQcCheck}>
                <Plus className="h-3.5 w-3.5 mr-1" /> QC
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border px-2 py-1.5 text-left font-medium">No. Sarfas</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Visual</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Density</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Temperatur</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                    <th className="border px-1 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {qcChecks.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.noSarfas} onChange={(e) => updateQcCheck(idx, "noSarfas", e.target.value)} placeholder="T-3 (A-24)" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.visual} onChange={(e) => updateQcCheck(idx, "visual", e.target.value)} placeholder="Jernih, Kehijauan" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.density} onChange={(e) => updateQcCheck(idx, "density", e.target.value)} placeholder="0.7530" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.temperatur} onChange={(e) => updateQcCheck(idx, "temperatur", e.target.value)} placeholder="31°C" /></td>
                      <td className="border px-1 py-1"><Input className="h-7 text-xs" value={row.keterangan} onChange={(e) => updateQcCheck(idx, "keterangan", e.target.value)} placeholder="Sampel 5 menit" /></td>
                      <td className="border px-1 py-1 text-center">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQcCheck(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Critical Equipment & Safety Tools */}
        <Card className="p-6 space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Pemeriksaan Peralatan Operasi Kritikal
          </h2>

          <div className="space-y-6">
            {["Penerimaan", "Penimbunan", "Penyaluran"].map((area) => {
              const items = criticalEquipment.filter((e) => e.kategori === area)
              return (
                <div key={area}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm bg-muted/30 px-3 py-1.5 rounded">{area}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => addCriticalEq(area)}>
                      <Plus className="h-3 w-3 mr-1" /> Tambah
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border px-2 py-1.5 text-left font-medium">Nama Peralatan</th>
                          <th className="border px-2 py-1.5 text-left font-medium w-28">Status</th>
                          <th className="border px-2 py-1.5 text-left font-medium w-28">Kondisi</th>
                          <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                          <th className="border px-1 py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="border px-4 py-3 text-center text-muted-foreground">
                              Belum ada peralatan
                            </td>
                          </tr>
                        ) : (
                          items.map((eq, eqIdx) => {
                            const idx = criticalEquipment.indexOf(eq)
                            return (
                              <tr key={eq.id || `${area}-${eqIdx}`}>
                                <td className="border px-1 py-1">
                                  <Input className="h-7 text-xs" value={eq.namaPeralatan} onChange={(e) => updateCriticalEq(idx, "namaPeralatan", e.target.value)} placeholder="Nama peralatan..." />
                                </td>
                                <td className="border px-1 py-1">
                                  <Select value={eq.status} onValueChange={(v) => updateCriticalEq(idx, "status", v)}>
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
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
                                    <SelectTrigger className="h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Berfungsi">Berfungsi</SelectItem>
                                      <SelectItem value="Tidak Berfungsi">Tidak Berfungsi</SelectItem>
                                      <SelectItem value="Perlu Perbaikan">Perlu Perbaikan</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="border px-1 py-1">
                                  <Input className="h-7 text-xs" value={eq.keterangan} onChange={(e) => updateCriticalEq(idx, "keterangan", e.target.value)} placeholder="-" />
                                </td>
                                <td className="border px-1 py-1 text-center">
                                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCriticalEq(idx)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Pemeriksaan Perlengkapan Safety */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              Pemeriksaan Perlengkapan Safety
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={addSafetyTool}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border px-2 py-1.5 text-left font-medium">Nama Perlengkapan</th>
                  <th className="border px-2 py-1.5 text-left font-medium w-24">Status</th>
                  <th className="border px-2 py-1.5 text-left font-medium w-28">Kondisi</th>
                  <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                  <th className="border px-1 py-1.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {safetyTools.map((tool, idx) => (
                  <tr key={idx}>
                    <td className="border px-1 py-1">
                      <Input className="h-7 text-xs" value={tool.nama} onChange={(e) => updateSafetyTool(idx, "nama", e.target.value)} placeholder="Nama alat..." />
                    </td>
                    <td className="border px-1 py-1">
                      <Select value={tool.status} onValueChange={(v) => updateSafetyTool(idx, "status", v)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADA">Ada</SelectItem>
                          <SelectItem value="TIDAK ADA">Tidak Ada</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border px-1 py-1">
                      <Select value={tool.kondisi} onValueChange={(v) => updateSafetyTool(idx, "kondisi", v)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Berfungsi">Berfungsi</SelectItem>
                          <SelectItem value="Tidak Berfungsi">Tidak Berfungsi</SelectItem>
                          <SelectItem value="Rusak">Rusak</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="border px-1 py-1">
                      <Input className="h-7 text-xs" value={tool.keterangan} onChange={(e) => updateSafetyTool(idx, "keterangan", e.target.value)} placeholder="-" />
                    </td>
                    <td className="border px-1 py-1 text-center">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSafetyTool(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Permintaan Transfer Tangki */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Permintaan Transfer Tangki
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={addTransferRequest}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Transfer
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border px-2 py-1.5 text-left font-medium">No. Tangki</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Nama Produk</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Est.Jumlah (KL)</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Estimasi (Jam)</th>
                    <th className="border px-2 py-1.5 text-left font-medium">Keterangan</th>
                    <th className="border px-1 py-1.5 w-8"></th>
                  </tr>
                </thead>
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
                      <td className="border px-1 py-1 text-center">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeTransferRequest(idx)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Team Sign-off */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Tim Serah Terima</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-3">
              <h3 className="font-medium text-sm bg-primary/5 px-3 py-1.5 rounded text-center">Yang Menyerahkan</h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Pws / Danru Shift</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenyerahkan.danru} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, danru: e.target.value}})} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Anggota 1</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenyerahkan.anggota1} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, anggota1: e.target.value}})} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Anggota 2</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenyerahkan.anggota2} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, anggota2: e.target.value}})} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Anggota 3</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenyerahkan.anggota3} onChange={(e) => setTeams({...teams, yangMenyerahkan: {...teams.yangMenyerahkan, anggota3: e.target.value}})} />
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-medium text-sm bg-primary/5 px-3 py-1.5 rounded text-center">Yang Menerima</h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Pws / Danru Shift</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenerima.danru} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, danru: e.target.value}})} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Anggota 1</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenerima.anggota1} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, anggota1: e.target.value}})} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Anggota 2</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenerima.anggota2} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, anggota2: e.target.value}})} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <Label className="text-xs sm:w-24">Anggota 3</Label>
                  <Input className="h-8 text-xs" value={teams.yangMenerima.anggota3} onChange={(e) => setTeams({...teams, yangMenerima: {...teams.yangMenerima, anggota3: e.target.value}})} />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t pt-3 mt-3">
            <p className="font-medium text-sm mb-3 text-center">Mengetahui</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <Label className="text-xs sm:w-28 shrink-0">Danru</Label>
                <Input className="h-8 text-xs flex-1" readOnly value={teams.yangMenyerahkan.danru} />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <Label className="text-xs sm:w-28 shrink-0">Sr. Spv II Fuel & LPG RSD</Label>
                <Input className="h-8 text-xs flex-1" value={teams.mengetahui.spv} onChange={(e) => setTeams({...teams, mengetahui: {...teams.mengetahui, spv: e.target.value}})} placeholder="Nama" />
              </div>
            </div>
          </div>
        </Card>

        {/* Form Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => handleSubmit("draft")} disabled={submitting} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Simpan Draft
          </Button>
          <Button type="submit" disabled={submitting || !!pendingHandover} title={pendingHandover ? "Tunggu persetujuan supervisor untuk laporan sebelumnya" : undefined} className="w-full sm:w-auto">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Handover
              </>
            )}
          </Button>
        </div>
      </form>
      </ResponsiveScale>
    </div>
  )
}
