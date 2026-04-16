import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Next 16 + Turbopack currently fails to bundle `@supabase/ssr` for Edge middleware
  // in this repo, causing "Can't resolve @supabase/supabase-js" at dev time.
  // We keep auth protection in server layouts (`/dashboard`, `/onboarding`) instead.
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/dashboard/:path*",
    "/onboarding",
  ],
};
