import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // version-skew protection: clients on an old deployment hard-reload instead
  // of failing to fetch purged chunks when a new deploy lands mid-session
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
};

export default nextConfig;
