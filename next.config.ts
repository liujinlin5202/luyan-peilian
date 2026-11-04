import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone：构建产物自带运行时依赖，小内存服务器无需 npm install 即可启动
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
