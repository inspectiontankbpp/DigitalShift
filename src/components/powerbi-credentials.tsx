"use client"

import { useState } from "react"
import { Check, Copy, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface PowerBiCredentialsProps {
  host: string
  port: string
  database: string
  username: string
  password: string
}

export function PowerBiCredentials({ host, port, database, username, password }: PowerBiCredentialsProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const configured = password.length > 0

  const rows = [
    { key: "host", label: "Server", value: host },
    { key: "port", label: "Port", value: port },
    { key: "database", label: "Database", value: database },
    { key: "username", label: "Username", value: username },
    { key: "password", label: "Password", value: configured ? password : "Belum dikonfigurasi" },
    { key: "ssl", label: "SSL", value: "require" },
  ]

  const allCredentials = [
    `Server: ${host}`,
    `Port: ${port}`,
    `Database: ${database}`,
    `Username: ${username}`,
    `Password: ${configured ? password : ""}`,
    "SSL: require",
  ].join("\n")

  const copy = async (key: string, value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = value
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Kredensial koneksi Power BI</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gunakan detail ini saat Power BI Desktop meminta kredensial PostgreSQL. Salin dan kirimkan hanya kepada
                pihak yang berwenang.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copy("all", allCredentials)}
              disabled={!configured}
              className="shrink-0"
            >
              {copied === "all" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied === "all" ? "Tersalin" : "Salin semua"}
            </Button>
          </div>

          {!configured ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              Password belum dikonfigurasi. Admin perlu mengisi variabel{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5">POWERBI_DB_PASSWORD</code>.
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-lg border">
            {rows.map((row) => {
              const isPassword = row.key === "password"
              const displayValue = isPassword && configured && !showPassword ? "••••••••••••" : row.value
              return (
                <div
                  key={row.key}
                  className="flex flex-col gap-1 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-xs font-medium text-muted-foreground sm:w-24">{row.label}</span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{displayValue}</code>
                    {isPassword && configured ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPassword((value) => !value)}
                        className="h-7 shrink-0 px-2 text-xs"
                      >
                        {showPassword ? "Sembunyikan" : "Tampilkan"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copy(row.key, row.value)}
                      disabled={!configured}
                      aria-label={`Salin ${row.label}`}
                      className="h-7 w-7 shrink-0"
                    >
                      {copied === row.key ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}
