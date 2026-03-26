export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe?: {
    user?: TelegramWebAppUser
  }
  ready?: () => void
  expand?: () => void
}

export interface MiniAppSettings {
  notificationsEnabled: boolean
  compactNavigation: boolean
  hapticsEnabled: boolean
  appearance: "dark" | "system"
}

export interface MiniAppPreferences {
  settings: MiniAppSettings
  state: Record<string, unknown>
  updatedAt: number | null
}

export interface TelegramAuthSession {
  authenticated: boolean
  authSource: string | null
  authLevel?: string | null
  userId: string | null
  activeWalletAddress?: string | null
  session?: {
    id: string | null
    expiresAt: number | null
  } | null
  telegram?: {
    userId: string
    authDate: number | null
    queryId: string | null
    startParam: string | null
    chatType: string | null
    canSendAfter: number | null
    user: {
      id: number | null
      firstName: string
      lastName: string | null
      username: string | null
      languageCode: string | null
      photoUrl: string | null
      isPremium: boolean
    } | null
  } | null
  user?: {
    id: string
    primaryWalletAddress: string | null
    status: string
    metadata?: Record<string, unknown>
  } | null
  miniAppPreferences?: MiniAppPreferences | null
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function getTelegramInitDataRaw() {
  const webApp = getTelegramWebApp()
  const rawFromWebApp = webApp?.initData?.trim()
  if (rawFromWebApp) return rawFromWebApp
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('tgWebAppData')?.trim() || ''
}

export function isTelegramMiniAppContext() {
  return Boolean(getTelegramWebApp())
}
