import type { NextConfig } from "next";

// Media URL host differs per environment (dev: local disk, prod: S3) — derive remotePattern from NEXT_PUBLIC_MEDIA_URL instead of hardcoding it.
const mediaUrl = new URL(
  process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:3000"
);

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@frontend/rpc"],
  images: {
    remotePatterns: [
      {
        protocol: mediaUrl.protocol.replace(":", "") as "http" | "https",
        hostname: mediaUrl.hostname,
        port: mediaUrl.port || undefined,
      },
    ],
  },
};

export default nextConfig;
