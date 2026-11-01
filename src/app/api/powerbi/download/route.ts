import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BUCKET = "powerbi"
const FILE_NAME = "ShiftHandover.pbix"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "supervisor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: file, error } = await supabase.storage.from(BUCKET).download(FILE_NAME)

  if (error || !file) {
    return NextResponse.json(
      { error: "File Power BI belum tersedia. Unggah ShiftHandover.pbix ke Supabase Storage bucket powerbi." },
      { status: 404 },
    )
  }

  return new NextResponse(file.stream(), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${FILE_NAME}"`,
      "Content-Length": file.size.toString(),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
