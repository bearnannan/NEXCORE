import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      allowedOrigins: ['127.0.0.1', 'localhost', '172.30.213.7']
    }
  }
};

export default nextConfig;
