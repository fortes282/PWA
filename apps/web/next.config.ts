import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pristav/shared"],
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  webpack: (config) => {
    // Allow .js extensions in imports to resolve to .ts source files
    // (needed because @pristav/shared uses NodeNext moduleResolution with .js extensions)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
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
