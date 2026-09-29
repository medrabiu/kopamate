/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // The Status card and share preview images read these font files at runtime.
  outputFileTracingIncludes: Object.fromEntries(
    ["/card/[code]", "/opengraph-image", "/r/[code]/opengraph-image"].map((route) => [
      route,
      [
        "./node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff",
        "./node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff",
      ],
    ]),
  ),
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
