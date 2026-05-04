import type { NextConfig } from "next";

const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHost = "localhost";
if (raw) {
  try {
    supabaseHost = new URL(raw).hostname;
  } catch {
    /* ongeldige URL — fallback */
  }
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHost,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
