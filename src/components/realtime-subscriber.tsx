"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/contexts/toast-context"

export function RealtimeSubscriber() {
  const toast = useToast()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const channel = supabase
      .channel("handover-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "handovers" },
        (payload: { new: Record<string, unknown> }) => {
          const status = String(payload.new.status || "")
          const form = String(payload.new.form_number || "")
          if (status === "submitted") {
            toast.info(`Handover baru masuk: ${form}`)
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "handovers" },
        (payload: { new: Record<string, unknown> }) => {
          const status = String(payload.new.status || "")
          const form = String(payload.new.form_number || "")
          if (status === "approved") {
            toast.success(`Handover ${form} disetujui`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, toast])

  return null
}
