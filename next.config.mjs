const isDev = process.env.NODE_ENV !== "production";

// PayWay hosted-checkout domains — the checkout form POSTs to these, so they
// must be allowed in form-action or the redirect to payment is blocked.
const PAYWAY_DOMAINS =
  "https://checkout.payway.com.kh https://checkout-sandbox.payway.com.kh";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // QR PNGs (self), inline data URIs, and camera blob frames.
  "img-src 'self' data: blob: https:",
  // 'unsafe-inline' for Next's hydration inline scripts; 'unsafe-eval' + ws only
  // in dev for Fast Refresh/HMR. blob: for the html5-qrcode worker.
  `script-src 'self' 'unsafe-inline' blob:${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  // Allow the checkout form to POST to PayWay's hosted checkout.
  `form-action 'self' ${PAYWAY_DOMAINS}`,
  "frame-src 'self'",
]
  .map((d) => d.trim())
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Allow the camera for the check-in scanner (same-origin only); deny the rest.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  // HSTS only in production (real HTTPS); harmless-but-pointless on localhost.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a slim, self-contained server bundle for the Cloud Run image.
  output: "standalone",

  // Keep TypeORM out of the webpack bundle so it runs as a plain Node dependency.
  serverExternalPackages: ["typeorm", "pg"],

  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
