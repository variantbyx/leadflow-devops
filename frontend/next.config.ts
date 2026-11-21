import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The UI calls the API with relative URLs (/api/...). In production, whatever
  // sits in front of the two services must route /api to the backend and
  // everything else to this app. For local development only, proxy to the API.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.DEV_API_URL ?? "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
