import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A `next dev` ne fűzzön „nextjs-agent-rules” blokkot a CLAUDE.md-hez (T36, döntés: 2026-11-12).
  agentRules: false,
  images: {
    remotePatterns: [
      // ESPN játékos- és csapatképek (headshot, logó)
      {
        protocol: "https",
        hostname: "a.espncdn.com",
      },
    ],
  },
};

export default nextConfig;
