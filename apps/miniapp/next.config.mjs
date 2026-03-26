import path from 'node:path'
import { fileURLToPath } from 'node:url'

function normalizeBasePath(rawBasePath) {
  if (!rawBasePath || rawBasePath === '/') return ''
  const withLeadingSlash = rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`
  return withLeadingSlash.replace(/\/+$/, '')
}

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_ODROB_BASE_PATH ?? '')
const apiProxyTarget = (process.env.ODROB_API_PROXY_TARGET || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3001' : '')).replace(/\/+$/, '')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: basePath || undefined,
  turbopack: {
    root: appRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (!apiProxyTarget) return []
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
