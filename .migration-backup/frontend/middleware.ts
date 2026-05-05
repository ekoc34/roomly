import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  try {
    return await createClient(request);
  } catch (error) {
    // Safe fallback: never break the app
    if (process.env.NODE_ENV !== "production") {
      console.warn("[middleware] error:", error);
    }
    return NextResponse.next({
      request,
    });
  }
}

export const config = {
  matcher: [
    // Limit middleware to routes that need Supabase authentication
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
