import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isAuthPage) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPage) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = profile?.role === "supervisor" ? "/dashboard" : "/handover"
    return NextResponse.redirect(dashboardUrl)
  }

  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    const role = profile?.role || "operator"

    const supervisorPages = ["/dashboard", "/powerbi", "/settings"]
    const isSupervisorPage = supervisorPages.some(p => request.nextUrl.pathname.startsWith(p))

    if (isSupervisorPage && role === "operator") {
      const handoverUrl = request.nextUrl.clone()
      handoverUrl.pathname = "/handover"
      return NextResponse.redirect(handoverUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|offline\\.html|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
