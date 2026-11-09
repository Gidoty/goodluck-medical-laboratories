import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This project lives inside a larger repository. Pin the root so Next.js never picks up
// files from the parent project.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  // STATIC_EXPORT=1 builds a plain HTML folder (out/) that can be uploaded to any static host.
  ...(process.env.STATIC_EXPORT === "1"
    ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } }
    : {}),
};

export default nextConfig;
