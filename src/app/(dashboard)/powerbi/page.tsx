import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen, Database, Download, FileSpreadsheet, LayoutDashboard, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"

const BUCKET = "powerbi"
const FILE_NAME = "ShiftHandover.pbix"

export default async function PowerBiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role === "operator") redirect("/handover")

  const { data: files } = await supabase.storage.from(BUCKET).list("", {
    search: FILE_NAME,
    limit: 1,
  })
  const file = files?.find((item) => item.name === FILE_NAME)
  const available = Boolean(file)
  const fileSize = typeof file?.metadata?.size === "number" ? formatBytes(file.metadata.size) : null
  const updatedAt = file?.updated_at ?? file?.created_at
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <div className="space-y-4 px-2 sm:space-y-6 sm:px-0">
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">Power BI</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Unduh laporan interaktif untuk supervisor: ringkasan operasional, tangki penerimaan, approval, dan aset &amp;
          keselamatan. Data mengikuti database saat laporan dibuka atau di-refresh.
        </p>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">Shift Handover Report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {available
                  ? `File .pbix siap diunduh${fileSize ? ` (${fileSize})` : ""}${updatedLabel ? `, diperbarui ${updatedLabel}` : ""}. Buka dengan Power BI Desktop, lalu klik Refresh untuk mengambil data terbaru.`
                  : "File .pbix belum tersedia. Hubungi admin untuk mengunggah ShiftHandover.pbix ke bucket powerbi."}
              </p>
            </div>
          </div>
          {available ? (
            <a
              href="/api/powerbi/download"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" />
              Download .pbix
            </a>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-lg border bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
              Belum tersedia
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Database className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Data live</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Laporan memakai DirectQuery ke view reporting Supabase. Data operasional mengikuti database saat laporan
            dibuka atau di-refresh.
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">4 halaman</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Ringkasan Operasional, Tangki Penerimaan, Approval &amp; Kepatuhan, serta Aset &amp; Keselamatan.
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">Akses supervisor</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            File disimpan di bucket private dan hanya bisa diunduh oleh supervisor.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Cara membuka laporan</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                Install <span className="font-medium text-foreground">Power BI Desktop</span> di Windows.
              </li>
              <li>
                Install CA Supabase ke Trusted Root Windows (sekali saja). Panduan ada di{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/integrasi-power-bi.md</code>.
              </li>
              <li>
                Klik <span className="font-medium text-foreground">Download .pbix</span>, lalu buka file tersebut.
              </li>
              <li>
                Saat diminta kredensial, gunakan detail koneksi yang diberikan admin melalui password manager.
                Kredensial tidak ditampilkan di aplikasi.
              </li>
              <li>
                Klik <span className="font-medium text-foreground">Refresh</span> untuk mengambil data terbaru.
              </li>
            </ol>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">Jika refresh gagal:</span> buka{" "}
              <span className="font-medium">
                File &gt; Options and settings &gt; Options &gt; Current File &gt; DirectQuery
              </span>
              , set <span className="font-medium">Maximum connections per data source</span> = 1, lalu nonaktifkan{" "}
              <span className="font-medium">Enable parallel loading of tables</span>.
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              File .pbix diperbarui manual oleh admin. Jika halaman Tangki Penerimaan belum muncul, minta admin
              mengunggah versi terbaru.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
