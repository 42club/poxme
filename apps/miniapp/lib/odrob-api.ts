"use client"

import { useEffect, useState } from "react"
import { apiBasePath } from "@/lib/env"

interface ApiEnvelope<T> {
  data?: T
  error?: string
  message?: string
}

export interface PublicIndexSnapshot {
  id: string
  name: string
  symbol: string
  description: string
  icon?: string | null
  status: string
  formulaText?: string | null
  oraclePrice: number
  prevOraclePrice?: number | null
  changePct: number
  totalTrades: number
  totalVolume: number
  holderCount: number
  circulatingSupply?: number
  createdAt?: number | null
  treasury?: {
    balance: number
    totalCollected?: number
    totalRedistributed?: number
    backingRatio?: number
  } | null
}

export interface EngineMetrics {
  totalEquity: number
  totalInitial: number
  totalPnl: number
  totalPnlPercent: number
  dailyPnl: number
  dailyPnlPercent: number
  activeAgents: number
  totalAgents: number
  totalTrades: number
  totalVolume: number
  winRate: number
  sharpeRatio?: number
  maxDrawdown?: number
  uptime?: number
  tickCount?: number
}

export interface StrategyMarketplaceListing {
  id: string
  strategyTemplateId: string
  currentVersionId: string
  authorUserAddress: string
  priceMode: string
  priceValue: number | null
  installCount: number
  activeInstallCount: number
  forkCount: number
  reviewCount: number
  avgRating: number
  verifiedBadge: boolean
  featuredRank: number | null
  rankingScore: number
  createdAt: number
  updatedAt: number
  template: {
    id: string
    slug: string
    name: string
    shortDescription: string
    category: string
    type: string
    visibility: string
    status: string
    ownerUserAddress: string
  }
  version?: {
    id: string
    versionNumber: number
    publishedAt: number | null
  } | null
}

export interface MarketplacePage {
  items: StrategyMarketplaceListing[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  categories: string[]
}

export interface IndexFeedEvent {
  id: string
  indexId: string
  eventType: string
  severity: string
  title: string
  detail?: Record<string, unknown>
  timestamp: number
}

export interface IndexTrade {
  id: string
  indexId: string
  buyerName?: string | null
  sellerName?: string | null
  side: string
  aggressorSide?: string | null
  price: number
  size: number
  value: number
  isMint?: boolean
  isBurn?: boolean
  timestamp: number
}

export interface IndexOracleSnapshot {
  indexId: string
  price: number
  bandLow?: number
  bandHigh?: number
  circulating?: number
  holderCount?: number
  formulaInputs?: Record<string, unknown>
  timestamp: number
}

export interface IndexHolder {
  agentId: string
  balance: number
  avgEntryPrice: number
  realizedPnl: number
  unrealizedPnl: number
  holdingValueUsd: number
  pctOfSupply: number
}

export interface AgentTrade {
  id: string
  side: string
  orderType?: string | null
  price: number
  size: number
  value: number
  pnl?: number | null
  indexId?: string | null
  indexSymbol?: string | null
  timestamp: number
}

export interface PublicAgentSummary {
  id: string
  name: string
  strategy: string
  strategyName?: string | null
  status: string
  walletAddress?: string | null
  equity: number
  pnl: number
  pnlPercent: number
  totalTrades: number
  totalVolume: number
  winRate: number
  positionValue?: number
  activeStrategyTemplateId?: string | null
  activeStrategyName?: string | null
  activeStrategyDescription?: string | null
  indexSubscriptions?: Array<{
    indexId: string
    allocationPct: number
    status: string
    subscribedAt: number
  }>
  trades?: AgentTrade[]
}

export interface AgentByWalletResponse {
  agent: PublicAgentSummary | null
}

export interface CreateUserAgentInput {
  name: string
  strategy: string
  icon?: string | null
  virtualBalance?: number
  riskLevel?: "low" | "medium" | "high"
  bio?: string
}

export interface StrategyInstance {
  id: string
  agentId: string
  strategyTemplateId: string
  strategyVersionId: string
  mode: string
  status: string
  installedFromMarketplace: boolean
  installedByUser: string | null
  createdAt: number
  updatedAt: number
}

export interface StrategyTemplate {
  id: string
  slug: string
  name: string
  shortDescription: string
  category: string
  type: string
  visibility: string
  status: string
  ownerUserAddress: string
  createdAt?: number
  updatedAt?: number
}

async function parseApiResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Request failed with ${response.status}`)
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data as T
  }
  return payload as T
}

async function apiGet<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBasePath}${path}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
  })
  return parseApiResponse<T>(response)
}

export function fetchPublicIndexes() {
  return apiGet<PublicIndexSnapshot[]>("/indexes")
}

export function fetchEngineMetrics() {
  return apiGet<EngineMetrics>("/engine/metrics")
}

export function fetchMarketplacePage(limit = 20) {
  return apiGet<MarketplacePage>(`/strategies/marketplace?limit=${limit}&includeMeta=1`)
}

export function fetchGlobalFeed(limit = 20) {
  return apiGet<IndexFeedEvent[]>(`/indexes/feed/global?limit=${limit}`)
}

export function fetchIndexTrades(indexId: string, limit = 20) {
  return apiGet<IndexTrade[]>(`/indexes/${encodeURIComponent(indexId)}/trades?limit=${limit}`)
}

export function fetchIndexOracle(indexId: string, limit = 80) {
  return apiGet<IndexOracleSnapshot[]>(`/indexes/${encodeURIComponent(indexId)}/oracle?limit=${limit}`)
}

export function fetchIndexHolders(indexId: string) {
  return apiGet<IndexHolder[]>(`/indexes/${encodeURIComponent(indexId)}/holders`)
}

export function fetchPublicAgents() {
  return apiGet<PublicAgentSummary[]>("/engine/agents/public")
}

export function fetchAgentByWallet(walletAddress: string) {
  return apiGet<AgentByWalletResponse>(`/engine/agents/by-wallet/${encodeURIComponent(walletAddress)}`)
}

export async function createUserAgent(input: CreateUserAgentInput) {
  const response = await fetch(`${apiBasePath}/engine/agents`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      strategy: input.strategy,
      icon: input.icon || undefined,
      virtualBalance: input.virtualBalance ?? 1000,
      riskLevel: input.riskLevel ?? "medium",
      bio: input.bio || "",
      isUserAgent: true,
    }),
  })
  return parseApiResponse<PublicAgentSummary>(response)
}

export function fetchAgentStrategyInstances(agentId: string) {
  return apiGet<StrategyInstance[]>(`/strategies/agents/${encodeURIComponent(agentId)}/instances`)
}

export function fetchMyStrategyTemplates() {
  return apiGet<StrategyTemplate[]>("/strategies/mine/templates")
}

export function useApiResource<T>(
  loader: (() => Promise<T>) | null,
  deps: readonly unknown[] = [],
  options: { enabled?: boolean; initialData?: T | null } = {},
) {
  const enabled = options.enabled ?? true
  const [data, setData] = useState<T | null>(options.initialData ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(enabled) && (options.initialData == null))
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled || !loader) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    void (async () => {
      try {
        const nextData = await loader()
        if (!cancelled) {
          setData(nextData)
          setError(null)
        }
      } catch (resourceError) {
        if (!cancelled) {
          setError(resourceError instanceof Error ? resourceError.message : "Failed to load data")
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
    // loader is intentionally controlled through deps to avoid forcing useCallback at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadToken, ...deps])

  return {
    data,
    error,
    isLoading,
    refresh: () => setReloadToken((value) => value + 1),
  }
}

export function formatCurrency(value: number | null | undefined, options: { compact?: boolean; maximumFractionDigits?: number } = {}) {
  if (value == null || Number.isNaN(value)) return "—"
  const abs = Math.abs(value)
  const maximumFractionDigits = options.maximumFractionDigits ?? (abs >= 100 ? 0 : abs >= 10 ? 2 : 4)
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits,
  }).format(value)
}

export function formatPrice(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  const abs = Math.abs(value)
  const maximumFractionDigits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value)
}

export function formatPercent(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value == null || Number.isNaN(value)) return "—"
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value)}%`
}

export function formatCompactNumber(value: number | null | undefined, maximumFractionDigits = 1) {
  if (value == null || Number.isNaN(value)) return "—"
  return new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits,
  }).format(value)
}

export function formatRelativeTime(timestamp: number | null | undefined) {
  if (!timestamp) return "сейчас"
  const elapsed = timestamp - Date.now()
  const minutes = Math.round(elapsed / 60000)
  const formatter = new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" })

  if (Math.abs(minutes) < 1) return "только что"
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute")

  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour")

  const days = Math.round(hours / 24)
  return formatter.format(days, "day")
}

export function isRecentlyCreated(timestamp: number | null | undefined, days = 7) {
  if (!timestamp) return false
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000
}

export function normalizePriceLabel(priceMode: string, priceValue: number | null | undefined) {
  if (priceMode === "free") return "Бесплатно"
  if (priceValue == null) return "По запросу"
  return formatCurrency(priceValue, { maximumFractionDigits: 0 })
}
