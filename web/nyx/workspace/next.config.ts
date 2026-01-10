import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@nyx/rpc"],
  async redirects() {
    return [
      {
        source: "/manage/plans",
        destination: "/manage/plan",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
