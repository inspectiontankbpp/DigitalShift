"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useConfirm } from "@/contexts/confirm-context"
import { useToast } from "@/contexts/toast-context"
import { useUser } from "@/contexts/user-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabContent, TabList, TabTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, Save, Loader2, Users, Clock, Fuel } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useUser()
  const [activeTab, setActiveTab] = useState("users")
  const [saving, setSaving] = useState(false)
  const { confirm } = useConfirm()
  const toast = useToast()
  const [users, setUsers] = useState<Record<string, unknown>[]>([])
  const [shifts, setShifts] = useState<Record<string, unknown>[]>([])
  const [tanks, setTanks] = useState<Record<string, unknown>[]>([])
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const supabase = createClient()

  const getTableData = useCallback(async (type: string) => {
    if (type === "users") {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
      return data as Record<string, unknown>[] | null
    } else if (type === "shifts") {
      const { data } = await supabase.from("shifts").select("*").order("name")
      return data as Record<string, unknown>[] | null
    } else if (type === "tanks") {
      const { data } = await supabase.from("tank_products").select("*").order("sort_order")
      return data as Record<string, unknown>[] | null
    }
    return null
  }, [supabase])

  const applyData = (type: string, data: Record<string, unknown>[] | null) => {
    if (type === "users") setUsers(data ?? [])
    else if (type === "shifts") setShifts(data ?? [])
    else if (type === "tanks") setTanks(data ?? [])
  }

  useEffect(() => {
    let ignore = false
    getTableData(activeTab).then((data) => {
      if (!ignore) applyData(activeTab, data)
    })
    return () => {
      ignore = true
    }
  }, [activeTab, getTableData])

  const handleSave = async (type: string) => {
    if (type === "users") {
      if (!formData.full_name || String(formData.full_name).trim() === "") {
        toast.error("Nama wajib diisi.")
        return
      }
      if (!formData.role || String(formData.role) === "") {
        toast.error("Role wajib dipilih.")
        return
      }
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.email))) {
        toast.error("Format email tidak valid.")
        return
      }
    }
    if (type === "shifts" && (!formData.name || String(formData.name).trim() === "")) {
      toast.error("Nama shift wajib diisi.")
      return
    }
    if (type === "tanks") {
      if (!formData.no_tanki || String(formData.no_tanki).trim() === "") {
        toast.error("No. tangki wajib diisi.")
        return
      }
      if (!formData.produk || String(formData.produk).trim() === "") {
        toast.error("Produk wajib diisi.")
        return
      }
    }
    setSaving(true)
    try {
      const table = type === "users" ? "profiles" : type === "tanks" ? "tank_products" : type
      const keyField = type === "tanks" ? "no_tanki" : "id"
      const editKey = type === "tanks" ? editItem?.no_tanki : editItem?.id
      if (editKey) {
        const { error } = await supabase.from(table).update(formData).eq(keyField, String(editKey))
        if (error) throw error
      } else {
        const { error } = await supabase.from(table).insert(formData)
        if (error) throw error
      }
      setEditItem(null)
      setFormData({})
      applyData(type, await getTableData(type))
    } catch (error) {
      console.error("Error:", error)
      toast.error("Gagal menyimpan data.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (type: string, id: string) => {
    const label = type === "tanks" ? "tangki" : type
    const ok = await confirm("Hapus Data?", `Anda yakin ingin menghapus data ${label} ini?`, { confirmLabel: "Ya, Hapus", variant: "danger" })
    if (!ok) return
    setSaving(true)
    try {
      const table = type === "users" ? "profiles" : type === "tanks" ? "tank_products" : type
      const keyField = type === "tanks" ? "no_tanki" : "id"
      const { error } = await supabase.from(table).delete().eq(keyField, id)
      if (error) throw error
      applyData(type, await getTableData(type))
      toast.success("Data berhasil dihapus.")
    } catch (error) {
      console.error("Error:", error)
      const msg = (error as { message?: string })?.message || ""
      if (msg.includes("row-level security") || msg.includes("permission")) {
        toast.error("Tidak punya izin menghapus data ini.")
      } else if (msg.includes("violates foreign key")) {
        toast.error("Data ini masih dipakai oleh handover lain dan tidak bisa dihapus.")
      } else {
        toast.error(msg || "Gagal menghapus data.")
      }
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: "users", label: "Users", icon: Users },
    { id: "shifts", label: "Shifts", icon: Clock },
    { id: "tanks", label: "Tanks", icon: Fuel },
  ]

  const items = { users, shifts, tanks }

  if (authLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
  }
  if (profile?.role !== "supervisor") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground mt-1">Manage users, shifts, and tanks</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabList className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <TabTrigger
              key={tab.id}
              value={tab.id}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabTrigger>
          ))}
        </TabList>

        <TabContent value={activeTab} className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>{tabs.find((t) => t.id === activeTab)?.label}</CardTitle>
              <Button size="sm" onClick={() => { setEditItem({}); setFormData({}) }}>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {editItem !== null && (
                <Card className="mb-4 p-4 bg-muted/30">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {activeTab === "users" && (
                      <>
                        <div className="space-y-1">
                          <Label>Full Name</Label>
                          <Input
                            value={String(formData.full_name ?? "")}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Email</Label>
                          <Input
                            value={String(formData.email ?? "")}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            type="email"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Role</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={String(formData.role ?? "")}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          >
                            <option value="">Select role</option>
                            <option value="operator">Operator</option>
                            <option value="supervisor">Supervisor</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label>Phone</Label>
                          <Input
                            value={String(formData.phone ?? "")}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    {activeTab === "shifts" && (
                      <>
                        <div className="space-y-1">
                          <Label>Name</Label>
                          <Input
                            value={String(formData.name ?? "")}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    {activeTab === "tanks" && (
                      <>
                        <div className="space-y-1">
                          <Label>No. Tangki</Label>
                          <Input
                            value={String(formData.no_tanki ?? "")}
                            onChange={(e) => setFormData({ ...formData, no_tanki: e.target.value })}
                            placeholder="15"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Produk</Label>
                          <Input
                            value={String(formData.produk ?? "")}
                            onChange={(e) => setFormData({ ...formData, produk: e.target.value })}
                            placeholder="Pertamax"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Urutan</Label>
                          <Input
                            type="number"
                            min={0}
                            value={String(formData.sort_order ?? 0)}
                            onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={String(formData.is_active ?? true)}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })}
                          >
                            <option value="true">Aktif</option>
                            <option value="false">Nonaktif</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" onClick={() => handleSave(activeTab)} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditItem(null); setFormData({}) }}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}

              <div className="space-y-2">
                {items[activeTab as keyof typeof items].map((item: Record<string, unknown>) => {
                  const rowKey = activeTab === "tanks" ? String(item.no_tanki ?? "") : String(item.id ?? "")
                  const title = activeTab === "tanks"
                    ? `${String(item.no_tanki ?? "")} — ${String(item.produk ?? "")}`
                    : String(item.name || item.email || "")
                  return (
                    <div key={rowKey} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                      <div>
                        <p className="font-medium">{title}</p>
                        {activeTab === "tanks" ? (
                          <p className="text-sm text-muted-foreground">Urutan: {String(item.sort_order ?? 0)}</p>
                        ) : null}
                        {item.code ? <p className="text-sm text-muted-foreground">Code: {String(item.code)}</p> : null}
                        {activeTab === "tanks" ? (
                          <Badge variant={item.is_active ? "outline" : "secondary"} className="mt-1">
                            {item.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        ) : item.role ? (
                          <Badge variant="outline" className="mt-1">{String(item.role)}</Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditItem(item); setFormData(item) }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(activeTab, rowKey)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  )
}
