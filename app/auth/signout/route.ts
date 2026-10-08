import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin, searchParams } = new URL(request.url);
  const error = searchParams.get("error");
  return NextResponse.redirect(`${origin}/login${error ? `?error=${encodeURIComponent(error)}` : ""}`, {
    status: 303,
  });
}

export const GET = signOut;
export const POST = signOut;
