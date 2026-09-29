/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The Status card route reads these font files at runtime.
  outputFileTracingIncludes: {
    "/card/[code]": [
      "./node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff",
      "./node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff",
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
