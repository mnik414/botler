import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Force the standalone bundle to be traced from this project root,
  // otherwise it may nest under a parent workspace directory.
  outputFileTracingRoot: path.resolve(process.cwd()),
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // NOTE: frame-ancestors is intentionally omitted — the embeddable widget
    // (/?embed=1) is iframed by customer websites. All other directives are
    // locked down; script-src needs 'unsafe-inline' for Next.js hydration.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
