"use client"

import { useEffect, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardList,
  FileText,
  Info,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TabContent, TabList, TabTrigger, Tabs } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type GuideStep = {
  title: string
  description: string
  icon: LucideIcon
}

type GuideContent = {
  title: string
  subtitle: string
  steps: GuideStep[]
  tips: string[]
}

const operatorGuide: GuideContent = {
  title: "Panduan Operator",
  subtitle: "Alur kerja operator dalam membuat, mengirim, dan memantau laporan shift.",
  steps: [
    {
      title: "Buat handover",
      description:
        "Buka menu Shift Handover, lalu isi regu, jam shift, level tank, QC, peralatan kritis, safety tools, transfer request, dan aktivitas.",
      icon: ClipboardList,
    },
    {
      title: "Simpan draft",
      description:
        "Gunakan Simpan Draft jika laporan belum selesai. Draft dapat dilanjutkan kapan saja sebelum dikirim.",
      icon: Save,
    },
    {
      title: "Kirim ke supervisor",
      description:
        "Klik Submit setelah data lengkap. Submit diblokir jika masih ada handover lain yang menunggu review supervisor.",
      icon: Send,
    },
    {
      title: "Pantau status",
      description:
        "Status berubah dari Draft ke Submitted, lalu Approved atau Rejected. Jika ditolak atau dibuka kembali, perbaiki laporan lalu submit ulang.",
      icon: RefreshCw,
    },
    {
      title: "Lihat dan ekspor laporan",
      description:
        "Menu Reports menampilkan riwayat handover. Gunakan filter tanggal atau status, lalu ekspor ke CSV atau PDF.",
      icon: FileText,
    },
  ],
  tips: [
    "Lengkapi data operasional sebelum menekan Submit.",
    "Tombol Edit hanya tersedia untuk handover berstatus Draft atau Reopened.",
    "Handover yang sudah Approved tidak dapat diubah tanpa Reopen dari supervisor.",
  ],
}

const supervisorGuide: GuideContent = {
  title: "Panduan Supervisor",
  subtitle: "Alur kerja supervisor dalam memantau, menyetujui, dan mengelola handover.",
  steps: [
    {
      title: "Pantau dashboard",
      description:
        "Lihat KPI, tren 7 hari, status handover, beban shift, kesiapan peralatan, dan level tank dalam satu halaman.",
      icon: LayoutDashboard,
    },
    {
      title: "Review handover",
      description:
        "Buka menu Approvals, periksa detail laporan, lalu pilih Setujui atau Tolak. Approval membuka izin submit untuk handover berikutnya.",
      icon: CheckSquare,
    },
    {
      title: "Buka kembali untuk revisi",
      description:
        "Gunakan Reopen jika laporan perlu diperbaiki. Operator dapat mengedit handover setelah statusnya menjadi Reopened.",
      icon: RotateCcw,
    },
    {
      title: "Kelola pengguna dan shift",
      description:
        "Menu Settings digunakan untuk mengatur pengguna, role, dan shift. Ubah role hanya jika memang diperlukan.",
      icon: Settings,
    },
    {
      title: "Akses Power BI",
      description:
        "Menu Power BI menyediakan unduhan file ShiftHandover.pbix untuk analisis dan pelaporan lanjutan.",
      icon: BarChart3,
    },
    {
      title: "Laporan dan ekspor",
      description:
        "Menu Reports membantu memfilter, mencetak, dan mengekspor data handover sesuai kebutuhan.",
      icon: FileText,
    },
  ],
  tips: [
    "Approval membuka izin submit untuk handover berikutnya.",
    "Handover yang sudah Approved tidak dapat dihapus.",
    "Gunakan Reopen untuk revisi, bukan membuat laporan baru.",
  ],
}

function GuideBody({ guide }: { guide: GuideContent }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-semibold">{guide.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{guide.subtitle}</p>
      </div>

      <div className="space-y-3">
        {guide.steps.map((step, index) => (
          <div key={step.title} className="flex gap-3 rounded-lg border p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-sm font-semibold">{step.title}</h3>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <Info className="h-4 w-4" />
          <p className="text-sm font-semibold">Catatan penting</p>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-amber-900/80">
          {guide.tips.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-sm font-semibold">Alur status handover</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="info">Draft</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="warning">Submitted</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="success">Approved</Badge>
          <span className="text-muted-foreground">atau</span>
          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
            Rejected
          </Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
            Reopened
          </Badge>
        </div>
      </div>
    </div>
  )
}

interface GuideModalProps {
  open: boolean
  onClose: () => void
  role?: string | null
}

export function GuideModal({ open, onClose, role }: GuideModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return <GuideDialog key={role === "supervisor" ? "supervisor" : "operator"} role={role} onClose={onClose} />
}

function GuideDialog({ role, onClose }: { role?: string | null; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(role === "supervisor" ? "supervisor" : "operator")

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 print:hidden">
      <div className="fade-in fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-description"
        className="dialog-in relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="guide-title" className="text-lg font-semibold">
                Panduan Penggunaan
              </h2>
              <p id="guide-description" className="mt-1 text-sm text-muted-foreground">
                Pelajari alur kerja sistem untuk operator dan supervisor.
              </p>
              <Badge variant="secondary" className="mt-2 capitalize">
                {role === "supervisor" ? "Supervisor" : "Operator"}
              </Badge>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Tutup panduan"
            className="-mr-2 -mt-2 shrink-0"
            autoFocus
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabList className="mb-5 flex gap-1 rounded-lg bg-muted p-1">
              <TabTrigger
                value="operator"
                aria-pressed={activeTab === "operator"}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === "operator"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Operator
              </TabTrigger>
              <TabTrigger
                value="supervisor"
                aria-pressed={activeTab === "supervisor"}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === "supervisor"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Supervisor
              </TabTrigger>
            </TabList>

            <TabContent value="operator">
              <GuideBody guide={operatorGuide} />
            </TabContent>
            <TabContent value="supervisor">
              <GuideBody guide={supervisorGuide} />
            </TabContent>
          </Tabs>
        </div>

        <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-xs text-muted-foreground">
            Panduan ini bisa dibuka lagi lewat tombol <span className="font-medium">Panduan</span> di header.
          </p>
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            Mengerti
          </Button>
        </div>
      </div>
    </div>
  )
}
