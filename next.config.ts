import type { NextConfig } from "next";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIDDLEWARE_NFT_REL = join(".next", "server", "middleware.js.nft.json");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.accounts.dev https://*.clerk.accounts.dev",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://clerk.accounts.dev https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.clerk-telemetry.com",
              "frame-src 'self' https://clerk.accounts.dev https://*.clerk.accounts.dev",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      return config;
    }

    config.plugins ??= [];
    config.plugins.push({
      apply(compiler: {
        hooks: { done: { tap: (name: string, fn: () => void) => void } };
      }) {
        compiler.hooks.done.tap("MiddlewareNftJsonPlaceholder", () => {
          const filePath = join(process.cwd(), MIDDLEWARE_NFT_REL);
          if (existsSync(filePath)) {
            return;
          }
          mkdirSync(join(process.cwd(), ".next", "server"), { recursive: true });
          writeFileSync(
            filePath,
            JSON.stringify({ version: 1, files: [] }),
            "utf8"
          );
        });
      },
    });

    return config;
  },
};

export default nextConfig;
