import type { NextConfig } from "next";

// EduQuest is almost entirely authenticated, per-request UI, so it uses the
// classic dynamic rendering model rather than Cache Components.
const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth", "unpdf"],
  poweredByHeader: false,
  // Hide the Next.js dev-tools button ("N") shown in the corner during `npm run dev`.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
