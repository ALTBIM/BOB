/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/ifc/:path*.wasm",
        headers: [{ key: "Content-Type", value: "application/wasm" }],
      },
      {
        source: "/ifc/:path*.worker.js",
        headers: [{ key: "Content-Type", value: "application/javascript" }],
      },
    ]
  },
}

export default nextConfig
