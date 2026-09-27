import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@frontend/rpc"],
  images: {
    // Disable the image optimizer because standalone builds cannot resolve the media host at build time.
    unoptimized: true,
  },
};

export default nextConfig;
