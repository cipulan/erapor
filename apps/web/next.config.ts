import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Semua panggilan API lewat proxy same-origin /api/v1 -> API_URL,
  // sehingga cookie sesi HttpOnly selalu terkirim tanpa masalah CORS.
  transpilePackages: ["@erapor/api-client"],
};

export default nextConfig;
