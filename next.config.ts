import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  // SWC minifying the build-time server bundle breaks "Collecting page data" with
  // "TypeError: Cannot convert object to primitive value" depending on unrelated admin-tab text.
  // A static export never ships that bundle, so skipping its minification costs nothing.
  experimental: { serverMinification: false },
  images: {
    unoptimized: true,
  },
};
export default nextConfig;