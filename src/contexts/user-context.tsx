"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface UserContextType {
  user: User | null
  profile: { full_name: string | null; role: string | null } | null
  loading: boolean
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{ full_name: string | null; role: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from("profiles").select("full_name, role").eq("id", authUser.id).single()
    setProfile(data)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      fetchProfile(data.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      fetchProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchProfile])

  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <UserContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error("useUser must be used within UserProvider")
  }
  return context
}
