import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const createClient = (request: NextRequest) => {
  try {
    // Access env variables inside the function to avoid module-level issues in Vercel edge runtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Guard: Return early if env variables are missing
    if (!supabaseUrl || !supabaseKey) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[supabase/middleware] Missing Supabase environment variables");
      }
      return NextResponse.next({
        request,
      });
    }

    // Create an unmodified response
    let supabaseResponse = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      },
    );

    return supabaseResponse
  } catch (error) {
    // Safe fallback: never break the app
    if (process.env.NODE_ENV !== "production") {
      console.warn("[supabase/middleware] error:", error);
    }
    return NextResponse.next({
      request,
    });
  }
};
