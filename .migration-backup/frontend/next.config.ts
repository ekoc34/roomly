import type { NextConfig } from "next";

const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHost = "localhost";
if (raw) {
  try {
    supabaseHost = new URL(raw).hostname;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[next.config] invalid NEXT_PUBLIC_SUPABASE_URL:", error);
    }
  }
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.preview.emergentcf.cloud", "*.cluster-0.preview.emergentcf.cloud"],
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
