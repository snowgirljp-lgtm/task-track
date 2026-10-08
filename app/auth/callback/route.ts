import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const err = searchParams.get("error_description") || searchParams.get("error");

  if (err) {
    const notAllowed = /ลงทะเบียน|EMAIL_NOT_ALLOWED|saving new user|signups not allowed/i.test(err);
    return NextResponse.redirect(`${origin}/login?error=${notAllowed ? "not_allowed" : "auth"}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
