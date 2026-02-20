const isStaticExport = process.env.BUILD_TARGET === "static";
const apiUrl = process.env.API_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isStaticExport ? "export" : "standalone",
  images: {
    unoptimized: isStaticExport,
  },
  experimental: {
    instrumentationHook: !isStaticExport,
    serverComponentsExternalPackages: ["dd-trace", "@strands-agents/sdk"],
  },
  async rewrites() {
    if (!apiUrl || isStaticExport) return [];
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${apiUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
