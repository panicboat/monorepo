import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@frontend/rpc"],
  images: {
    // Media host (dev: local disk, prod: S3) isn't knowable at `next build` time in standalone
    // output, so skip the optimizer entirely instead of a remotePatterns value that would freeze
    // to whatever NEXT_PUBLIC_MEDIA_URL happened to be at build time.
    unoptimized: true,
  },
};

export default nextConfig;
