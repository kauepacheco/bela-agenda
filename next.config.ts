import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Node 24 in the local toolchain does not expose captured `tsc --showConfig`
    // output reliably; TypeScript 5 still supports Next's compiler API checker.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
