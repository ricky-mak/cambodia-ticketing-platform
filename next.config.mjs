/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a slim, self-contained server bundle for the Cloud Run image.
  output: "standalone",

  // TypeORM relies on runtime require() of optional drivers and on
  // decorator metadata. Keep it out of the webpack bundle so it runs as a
  // plain Node dependency in the server runtime.
  serverExternalPackages: ["typeorm", "pg"],

  eslint: {
    // Lint is run as an explicit CI step; don't fail the production build on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
