"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { apiBasePath } from "@/lib/env"
import { getTelegramInitDataRaw, getTelegramWebApp, isTelegramMiniAppContext, type TelegramAuthSession } from "@/lib/telegram"

type AuthStatus = "loading" | "authenticating" | "authenticated" | "outside" | "error"

interface TelegramAuthContextValue {
  error: string | null
  isTelegramMiniApp: boolean
  refresh: () => Promise<void>
  session: TelegramAuthSession | null
  status: AuthStatus
}

const TelegramAuthContext = createContext<TelegramAuthContextValue | null>(null)

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed with ${response.status}`
    throw new Error(message)
  }
  return payload?.data ?? null
}

async function fetchExistingSession() {
  const response = await fetch(`${apiBasePath}/auth/session`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  return parseJsonResponse(response) as Promise<TelegramAuthSession | null>
}

async function verifyTelegramInitData(initDataRaw: string) {
  const response = await fetch(`${apiBasePath}/auth/telegram/verify`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Authorization: `tma ${initDataRaw}`,
    },
  })
  return parseJsonResponse(response) as Promise<TelegramAuthSession>
}

export function TelegramAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [session, setSession] = useState<TelegramAuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const webApp = getTelegramWebApp()
    const inTelegramMiniApp = isTelegramMiniAppContext()
    const initDataRaw = getTelegramInitDataRaw()

    if (webApp) {
      webApp.ready?.()
      webApp.expand?.()
    }

    setError(null)
    setStatus("loading")

    try {
      const existingSession = await fetchExistingSession().catch(() => null)
      if (existingSession?.authenticated && existingSession.authSource === "telegram-mini-app") {
        setSession(existingSession)
        setStatus("authenticated")
        return
      }

      if (!initDataRaw) {
        setSession(null)
        setStatus("outside")
        return
      }

      setStatus("authenticating")
      const verifiedSession = await verifyTelegramInitData(initDataRaw)
      setSession(verifiedSession)
      setStatus("authenticated")
    } catch (authError) {
      setSession(null)
      setStatus(inTelegramMiniApp || Boolean(initDataRaw) ? "error" : "outside")
      setError(authError instanceof Error ? authError.message : "Не удалось выполнить вход через Telegram")
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value = {
    error,
    isTelegramMiniApp: isTelegramMiniAppContext(),
    refresh,
    session,
    status,
  }

  return (
    <TelegramAuthContext.Provider value={value}>
      {children}
    </TelegramAuthContext.Provider>
  )
}

export function useTelegramAuth() {
  const context = useContext(TelegramAuthContext)
  if (!context) {
    throw new Error("useTelegramAuth must be used inside TelegramAuthProvider")
  }
  return context
}
