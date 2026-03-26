function normalizeBasePath(rawBasePath?: string | null) {
  if (!rawBasePath || rawBasePath === '/') return ''
  const withLeadingSlash = rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`
  return withLeadingSlash.replace(/\/+$/, '')
}

export const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_ODROB_BASE_PATH ?? '')
export const apiBasePath = process.env.NEXT_PUBLIC_ODROB_API_BASE?.trim() || '/api'

export function withAppBasePath(pathname: string) {
  return `${appBasePath}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}
