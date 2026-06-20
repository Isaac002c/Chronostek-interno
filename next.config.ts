import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Lint is run separately via `npm run lint`; do not block production builds.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // bcryptjs / prisma are server-only; keep them out of the client bundle.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
