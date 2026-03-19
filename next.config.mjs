/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
        "onnxruntime-node$": false,
      };
    }
    return config;
  },

  serverExternalPackages: [
    "sharp",
    "onnxruntime-node",
    "@huggingface/transformers",
  ],

  // Add crossorigin="anonymous" to all <script> and <link rel="preload">
  // tags that Next.js generates.  This makes them load via CORS mode,
  // which is required under COEP: require-corp for any resource that
  // *could* be cross-origin (e.g. if assetPrefix were ever set to a CDN).
  // For same-origin resources it is harmless but ensures correctness.
  crossOrigin: "anonymous",

  // Belt-and-suspenders: set COOP/COEP via headers() as well as middleware.
  // Middleware (src/middleware.ts) is the primary mechanism, but headers()
  // acts as a fallback in case middleware is skipped for certain responses
  // during dev mode (error overlays, HMR, etc.).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
