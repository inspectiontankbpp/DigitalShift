"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { useCallback, useEffect, useState } from "react"
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
} from "lucide-react"
import { GuideModal } from "@/components/guide-modal"

const allNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["supervisor"] },
  { href: "/handover", label: "Shift Handover", icon: ClipboardList, roles: ["operator", "supervisor"] },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, roles: ["operator", "supervisor"] },
  { href: "/reports", label: "Reports", icon: FileText, roles: ["operator", "supervisor"] },
  { href: "/powerbi", label: "Power BI", icon: BarChart3, roles: ["supervisor"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["supervisor"] },
]

export function Header() {
  const { user, profile, signOut } = useUser()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    if (!user?.id || !profile?.role) return
    const key = `shiftapp-guide-seen:${user.id}`
    if (localStorage.getItem(key) === "1") return

    const timer = window.setTimeout(() => setGuideOpen(true), 0)
    return () => window.clearTimeout(timer)
  }, [user?.id, profile?.role])

  const closeGuide = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(`shiftapp-guide-seen:${user.id}`, "1")
    }
    setGuideOpen(false)
  }, [user])

  const navItems = allNavItems.filter((item) => item.roles.includes(profile?.role || ""))

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm print:hidden">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
            </div>
            <span className="font-semibold text-lg hidden sm:inline">Digital Shift</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex flex-col items-end">
            <span className="max-w-[220px] truncate text-sm font-medium">{user?.email}</span>
            <span className="text-xs text-muted-foreground capitalize">{profile?.role || ""}</span>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Buka panduan penggunaan"
            title="Panduan penggunaan"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Panduan</span>
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={mobileOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-card p-4">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      )}
      </header>
      <GuideModal open={guideOpen} onClose={closeGuide} role={profile?.role} />
    </>
  )
}
