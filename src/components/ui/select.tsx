"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useEffect, useRef } from "react"

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  displayLabel: string
  setDisplayLabel: (label: string) => void
}

const SelectContext = React.createContext<SelectContextType | null>(null)

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join("")
  if (React.isValidElement(node)) {
    return getNodeText((node.props as { children?: React.ReactNode }).children)
  }
  return ""
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [displayLabel, setDisplayLabel] = React.useState("")
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, displayLabel, setDisplayLabel }}>
      {children}
    </SelectContext.Provider>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(SelectContext)
    if (!context) throw new Error("SelectTrigger must be used within Select")
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        onClick={() => context.setOpen(!context.open)}
        {...props}
      >
        {children}
        <svg className="ml-2 h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
        </svg>
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectValue must be used within Select")
  return <span>{context.displayLabel || placeholder}</span>
}

interface SelectContentProps {
  children: React.ReactNode
}

export function SelectContent({ children }: SelectContentProps) {
  const ctx = React.useContext(SelectContext)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctx?.open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        ctx?.setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [ctx])

  if (!ctx?.open) return null

  return (
    <div ref={containerRef} className="absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
      {children}
    </div>
  )
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  children: React.ReactNode
}

export function SelectItem({ value, children, className, ...props }: SelectItemProps) {
  const context = React.useContext(SelectContext)
  if (!context) throw new Error("SelectItem must be used within Select")

  const label = getNodeText(children) || value

  useEffect(() => {
    if (context.value === value) {
      context.setDisplayLabel(label)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.value, value, label])

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent",
        className
      )}
      data-selected={context.value === value}
      onClick={() => {
        context.onValueChange(value)
        context.setDisplayLabel(label)
        context.setOpen(false)
      }}
      {...props}
    >
      {children}
    </div>
  )
}
