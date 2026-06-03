import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required for Mongoose — prevents Next.js from bundling it through webpack,
  // which breaks Mongoose's connection-model cache in App Router route handlers.
  serverExternalPackages: ['mongoose'],
}

export default nextConfig
