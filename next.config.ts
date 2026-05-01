import type { NextConfig } from "next";

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
};

export default nextConfig;
