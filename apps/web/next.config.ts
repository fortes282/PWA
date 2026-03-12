import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pristav/shared"],
  experimental: {
    typedRoutes: false,
  },
  webpack: (config) => {
    // Allow .js extensions in imports to resolve to .ts source files
    // (needed because @pristav/shared uses NodeNext moduleResolution with .js extensions)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
