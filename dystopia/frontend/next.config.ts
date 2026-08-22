import type { NextConfig } from "next";

// Media (avatars / post images) is served from the monolith's storage adapter
// as an absolute URL built from its APP_URL. The host is environment-specific,
// so derive the allowed remotePattern from NEXT_PUBLIC_MEDIA_URL rather than
// hardcoding it.
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
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
