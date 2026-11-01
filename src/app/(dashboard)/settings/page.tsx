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
import { Plus, Edit, Trash2, Save, Loader2, Users, Clock } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useUser()
  const [activeTab, setActiveTab] = useState("users")
  const [saving, setSaving] = useState(false)
  const { confirm } = useConfirm()
  const toast = useToast()
  const [users, setUsers] = useState<Record<string, unknown>[]>([])
  const [shifts, setShifts] = useState<Record<string, unknown>[]>([])
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const supabase = createClient()

  const getTableData = useCallback(async (type: string) => {
    if (type === "users") {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })
      return data as Record<string, unknown>[] | null
    } else if (type === "shifts") {
      const { data } = await supabase.from("shifts").select("*").order("start_time")
      return data as Record<string, unknown>[] | null
    }
    return null
  }, [supabase])

  const applyData = (type: string, data: Record<string, unknown>[] | null) => {
    if (type === "users") setUsers(data ?? [])
    else if (type === "shifts") setShifts(data ?? [])
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
    if (type === "shifts" && (!formData.name || !formData.start_time || !formData.end_time)) {
      toast.error("Semua field shift wajib diisi.")
      return
    }
    setSaving(true)
    try {
      const table = type === "users" ? "profiles" : type
      if (editItem?.id) {
        const { error } = await supabase.from(table).update(formData).eq("id", editItem.id)
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
    const ok = await confirm("Hapus Data?", `Anda yakin ingin menghapus data ${type} ini?`, { confirmLabel: "Ya, Hapus", variant: "danger" })
    if (!ok) return
    setSaving(true)
    try {
      const table = type === "users" ? "profiles" : type
      const { error } = await supabase.from(table).delete().eq("id", id)
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
  ]

  const items = { users, shifts }

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
        <p className="text-muted-foreground mt-1">Manage users and shifts</p>
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
              <Button size="sm" onClick={() => setEditItem({})}>
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
                        <div className="space-y-1">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={String(formData.start_time ?? "")}
                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={String(formData.end_time ?? "")}
                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                          />
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
                {items[activeTab as keyof typeof items].map((item: Record<string, unknown>) => (
                  <div key={String(item.id)} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                    <div>
                      <p className="font-medium">{String(item.name || item.email || "")}</p>
                      {item.code ? <p className="text-sm text-muted-foreground">Code: {String(item.code)}</p> : null}
                      {item.start_time ? (
                        <p className="text-sm text-muted-foreground">{String(item.start_time)} - {String(item.end_time)}</p>
                      ) : null}
                      {item.role ? (
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
                        onClick={() => handleDelete(activeTab, String(item.id))}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  )
}
