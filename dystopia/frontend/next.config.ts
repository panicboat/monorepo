import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address?.family === "IPv4" && !address.internal)
  .map((address) => address!.address);

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@frontend/rpc"],
  // Resolve at startup instead of pinning an address because DHCP reassigns the LAN IP that other devices use.
  allowedDevOrigins: lanAddresses,
  images: {
    // Disable the image optimizer because standalone builds cannot resolve the media host at build time.
    unoptimized: true,
  },
};

export default nextConfig;
