import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims ตรวจลายเซ็น token ในเครื่องได้เลย (เร็ว) ถ้าโปรเจกต์ใช้ signing key แบบใหม่
  // ถ้าไม่รองรับ จะถามเซิร์ฟเวอร์ Supabase แทนเหมือนเดิม
  let user: unknown = null;
  const auth = supabase.auth as any;
  if (typeof auth.getClaims === "function") {
    const { data } = await auth.getClaims();
    user = data?.claims?.sub ? data.claims : null;
  } else {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/privacy");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
