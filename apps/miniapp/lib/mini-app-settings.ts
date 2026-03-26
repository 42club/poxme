"use client"

import { useEffect, useState, useTransition } from "react"
import { apiBasePath } from "@/lib/env"
import type { MiniAppPreferences, MiniAppSettings } from "@/lib/telegram"

export const defaultMiniAppSettings: MiniAppSettings = {
  notificationsEnabled: true,
  compactNavigation: true,
  hapticsEnabled: true,
  appearance: "dark",
}

function mergeMiniAppPreferences(preferences?: MiniAppPreferences | null): MiniAppPreferences {
  return {
    settings: {
      ...defaultMiniAppSettings,
      ...(preferences?.settings || {}),
    },
    state: preferences?.state && typeof preferences.state === "object" ? preferences.state : {},
    updatedAt: preferences?.updatedAt || null,
  }
}

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Request failed with ${response.status}`)
  }
  return payload?.data ?? null
}

async function fetchMiniAppPreferences() {
  const response = await fetch(`${apiBasePath}/auth/mini-app/preferences`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })
  return mergeMiniAppPreferences(await parseJsonResponse(response))
}

async function saveMiniAppPreferences(settings: Partial<MiniAppSettings>) {
  const response = await fetch(`${apiBasePath}/auth/mini-app/preferences`, {
    method: "PUT",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ settings }),
  })
  return mergeMiniAppPreferences(await parseJsonResponse(response))
}

export function useMiniAppSettings(initialPreferences?: MiniAppPreferences | null) {
  const [preferences, setPreferences] = useState<MiniAppPreferences>(() => mergeMiniAppPreferences(initialPreferences))
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!initialPreferences)
  const [isSaving, startSaving] = useTransition()

  useEffect(() => {
    setPreferences(mergeMiniAppPreferences(initialPreferences))
    setIsLoading(!initialPreferences)
  }, [initialPreferences])

  useEffect(() => {
    if (initialPreferences) return

    let cancelled = false

    void (async () => {
      try {
        const remotePreferences = await fetchMiniAppPreferences()
        if (!cancelled) {
          setPreferences(remotePreferences)
          setError(null)
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Не удалось загрузить настройки")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [initialPreferences])

  async function updateSettings(settingsPatch: Partial<MiniAppSettings>) {
    const previous = preferences
    const optimistic = mergeMiniAppPreferences({
      ...preferences,
      settings: {
        ...preferences.settings,
        ...settingsPatch,
      },
    })

    setPreferences(optimistic)
    setError(null)

    startSaving(() => {
      void (async () => {
        try {
          const savedPreferences = await saveMiniAppPreferences(settingsPatch)
          setPreferences(savedPreferences)
        } catch (saveError) {
          setPreferences(previous)
          setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить настройки")
        }
      })()
    })
  }

  return {
    error,
    isLoading,
    isSaving,
    preferences,
    settings: preferences.settings,
    updateSettings,
  }
}
