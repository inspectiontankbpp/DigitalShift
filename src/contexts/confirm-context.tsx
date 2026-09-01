"use client"

import { useState, useCallback, createContext, useContext, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react"

export type ConfirmVariant = "danger" | "success" | "warning"

interface ConfirmOptions {
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

interface ConfirmState {
  open: boolean
  title: string
  message: string
  options: ConfirmOptions
  onConfirm: () => void
}

interface ConfirmContextType {
  confirm: (title: string, message: string, options?: ConfirmOptions) => Promise<boolean>
}

const variantStyles: Record<
  ConfirmVariant,
  { Icon: typeof AlertTriangle; iconWrap: string; iconColor: string; buttonClass: string }
> = {
  danger: {
    Icon: AlertTriangle,
    iconWrap: "bg-red-100",
    iconColor: "text-red-600",
    buttonClass: "bg-destructive hover:bg-destructive/90 text-white",
  },
  success: {
    Icon: CheckCircle2,
    iconWrap: "bg-green-100",
    iconColor: "text-green-600",
    buttonClass: "bg-green-600 hover:bg-green-700 text-white",
  },
  warning: {
    Icon: AlertCircle,
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-600",
    buttonClass: "bg-amber-500 hover:bg-amber-600 text-white",
  },
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
    options: {},
    onConfirm: () => {},
  })

  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((title: string, message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title,
        message,
        options,
        onConfirm: () => {
          setState((prev) => ({ ...prev, open: false }))
          resolve(true)
        },
      })
      setResolver(() => resolve)
    })
  }, [])

  const handleCancel = () => {
    setState((prev) => ({ ...prev, open: false }))
    resolver?.(false)
  }

  const variant = state.options.variant || "danger"
  const styles = variantStyles[variant]
  const Icon = styles.Icon
  const confirmLabel = state.options.confirmLabel || "Konfirmasi"
  const cancelLabel = state.options.cancelLabel || "Batal"

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fade-in fixed inset-0 bg-black/50" onClick={handleCancel} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            className="dialog-in relative bg-card rounded-xl shadow-xl border p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconWrap}`}>
                <Icon className={`h-5 w-5 ${styles.iconColor}`} />
              </div>
              <div>
                <h3 id="confirm-title" className="font-semibold text-sm">{state.title}</h3>
                <p id="confirm-message" className="text-sm text-muted-foreground mt-1">{state.message}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel} className="h-9 px-4">
                {cancelLabel}
              </Button>
              <Button size="sm" onClick={state.onConfirm} className={`h-9 px-4 ${styles.buttonClass}`} autoFocus>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider")
  return ctx
}
