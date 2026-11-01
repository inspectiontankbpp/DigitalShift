"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined)

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabListProps {
  children: React.ReactNode
  className?: string
}

export function TabList({ children, className }: TabListProps) {
  return <div className={cn("flex", className)}>{children}</div>
}

interface TabTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  children: React.ReactNode
}

export function TabTrigger({ value, children, className, ...props }: TabTriggerProps) {
  const context = React.useContext(TabsContext)
  if (!context) throw new Error("TabTrigger must be used within Tabs")
  return (
    <button
      type="button"
      className={className}
      onClick={() => context.onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabContent({ value, children, className }: TabContentProps) {
  const context = React.useContext(TabsContext)
  if (!context) return null
  if (context.value !== value) return null
  return <div className={className}>{children}</div>
}
