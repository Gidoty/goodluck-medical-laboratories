import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This project lives inside a larger repository. Pin the root so Next.js never picks up the
// parent project's files (for example its proxy.ts).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
