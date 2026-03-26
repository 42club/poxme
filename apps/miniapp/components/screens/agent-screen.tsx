"use client"

import { useMemo, useState, useTransition } from "react"
import { useTelegramAuth } from "@/components/auth/telegram-auth-provider"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Settings,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react"
import {
  createUserAgent,
  fetchAgentByWallet,
  fetchEngineMetrics,
  fetchGlobalFeed,
  fetchPublicIndexes,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatPrice,
  formatRelativeTime,
  useApiResource,
  type AgentTrade,
  type IndexFeedEvent,
  type PublicIndexSnapshot,
} from "@/lib/odrob-api"

function mapAgentTrade(trade: AgentTrade) {
  const positive = trade.side === "sell" || trade.side === "treasury_dividend"
  return {
    id: trade.id,
    asset: trade.indexSymbol || trade.indexId || "Индекс",
    amount: positive ? formatCurrency(trade.value, { maximumFractionDigits: 2 }) : `-${formatCurrency(trade.value, { maximumFractionDigits: 2 })}`,
    time: formatRelativeTime(trade.timestamp),
    positive,
  }
}

function mapFeedEvent(feedEvent: IndexFeedEvent) {
  const positive = ["treasury_redistribution", "oracle_update"].includes(feedEvent.eventType)
  return {
    id: feedEvent.id,
    asset: feedEvent.indexId,
    amount: feedEvent.title,
    time: formatRelativeTime(feedEvent.timestamp),
    positive,
  }
}

export function AgentScreen({ onGoProfile }: { onGoProfile?: () => void }) {
  const { error: authError, refresh: refreshSession, session, status: authStatus } = useTelegramAuth()
  const walletAddress = session?.activeWalletAddress || null
  const [activeTab, setActiveTab] = useState("account")
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreatingAgent, startCreateAgent] = useTransition()

  const { data: metrics } = useApiResource(fetchEngineMetrics, [])
  const indexesResource = useApiResource(fetchPublicIndexes, [], { initialData: [] as PublicIndexSnapshot[] })
  const feedResource = useApiResource(() => fetchGlobalFeed(8), [], { initialData: [] as IndexFeedEvent[] })
  const agentResource = useApiResource(
    walletAddress ? () => fetchAgentByWallet(walletAddress) : null,
    [walletAddress],
    { enabled: Boolean(walletAddress), initialData: { agent: null } },
  )
  const { data: agentLookup, error: agentError, isLoading: isAgentLoading, refresh: refreshAgent } = agentResource
  const indexes = indexesResource.data ?? []
  const feed = feedResource.data ?? []

  const currentAgent = agentLookup?.agent || null
  const telegramUser = session?.telegram?.user || null

  const sortedIndexes = useMemo(
    () => [...indexes].sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct)),
    [indexes],
  )
  const agentIndexes = useMemo(() => {
    if (!currentAgent?.indexSubscriptions?.length) return sortedIndexes.slice(0, 4)
    return currentAgent.indexSubscriptions
      .map((subscription) => indexes.find((index) => index.id === subscription.indexId))
      .filter(Boolean) as PublicIndexSnapshot[]
  }, [currentAgent, indexes, sortedIndexes])

  const heroLabel = currentAgent ? "Баланс агента" : "Пульс платформы"
  const heroValue = currentAgent ? formatCurrency(currentAgent.equity) : formatCurrency(metrics?.totalEquity)
  const heroDelta = currentAgent ? formatCurrency(currentAgent.pnl) : formatCurrency(metrics?.totalPnl)
  const heroDeltaPct = currentAgent ? currentAgent.pnlPercent : metrics?.totalPnlPercent

  const statusTitle = currentAgent
    ? currentAgent.name
    : isAgentLoading && walletAddress
      ? "Подключаем агента"
    : walletAddress
      ? "Агент ещё не создан"
      : authStatus === "loading" || authStatus === "authenticating"
        ? "Подключаем аккаунт"
        : authStatus === "error"
          ? "Не удалось подключить аккаунт"
          : "Откройте mini app из Telegram"
  const statusDescription = currentAgent
    ? `${currentAgent.activeStrategyName || currentAgent.strategyName || "Стратегия"} сейчас ${currentAgent.status === "active" ? "активна" : "на паузе"}`
    : isAgentLoading && walletAddress
      ? "Ищем агента, привязанного к вашему кошельку."
    : walletAddress
      ? "Кошелёк уже активен. Можно создать персонального агента и сразу подключить стратегии."
      : authStatus === "loading" || authStatus === "authenticating"
        ? "Проверяем Telegram-сессию и поднимаем торговый профиль."
        : authStatus === "error"
          ? authError || "Не удалось обновить Telegram-сессию."
          : "Авторизация и торговые функции станут доступны после запуска приложения внутри Telegram."

  const trendCards = sortedIndexes.slice(0, 4)
  const recentActivity = currentAgent?.trades?.length
    ? currentAgent.trades.slice(0, 3).map(mapAgentTrade)
    : feed.slice(0, 3).map(mapFeedEvent)

  const statCards = currentAgent
    ? [
        { label: "Прибыль", value: formatCurrency(currentAgent.pnl), valueClassName: currentAgent.pnl >= 0 ? "text-success" : "text-destructive", icon: <TrendingUp className={`h-4 w-4 ${currentAgent.pnl >= 0 ? "text-success" : "text-destructive"}`} /> },
        { label: "Объём", value: formatCurrency(currentAgent.totalVolume), icon: null },
        { label: "Сделки", value: String(currentAgent.totalTrades), icon: null },
        { label: "Winrate", value: formatPercent(currentAgent.winRate, 0), valueClassName: "text-success", icon: null },
      ]
    : [
        { label: "Агентов", value: String(metrics?.activeAgents || 0), icon: <TrendingUp className="h-4 w-4 text-success" /> },
        { label: "Оборот", value: formatCurrency(metrics?.totalVolume), icon: null },
        { label: "Сделки", value: formatCompactNumber(metrics?.totalTrades, 0), icon: null },
        { label: "Winrate", value: formatPercent((metrics?.winRate || 0) * 100, 0), valueClassName: "text-success", icon: null },
      ]

  const handleCreateAgent = () => {
    if (!walletAddress || isCreatingAgent) return

    const displayName = telegramUser?.firstName?.trim() || telegramUser?.username?.trim() || "Trader"
    const normalizedDisplayName = displayName.length > 24 ? displayName.slice(0, 24).trim() : displayName

    setCreateError(null)

    startCreateAgent(() => {
      void (async () => {
        try {
          await createUserAgent({
            name: `Agent ${normalizedDisplayName}`,
            strategy: "trend_follower",
            icon: telegramUser?.isPremium ? "⭐" : "🤖",
            bio: "Персональный агент, созданный через Telegram Mini App.",
          })
          await refreshSession()
          refreshAgent()
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось создать агента"
          if (/Wallet already has an agent/i.test(message)) {
            await refreshSession()
            refreshAgent()
            return
          }
          setCreateError(message)
        }
      })()
    })
  }

  const handleRetryAuth = () => {
    setCreateError(null)
    void refreshSession()
  }

  const statusAction = currentAgent
    ? (
        <Button variant="secondary" size="sm" onClick={onGoProfile}>
          Профиль
        </Button>
      )
    : walletAddress
      ? (
          <Button size="sm" onClick={handleCreateAgent} disabled={isCreatingAgent || isAgentLoading}>
            {isCreatingAgent ? "Создаём..." : "Создать агента"}
          </Button>
        )
      : authStatus === "error"
        ? (
            <Button variant="secondary" size="sm" onClick={handleRetryAuth}>
              Повторить
            </Button>
          )
        : (
            <Button variant="secondary" size="sm" onClick={onGoProfile} disabled={authStatus === "loading" || authStatus === "authenticating"}>
              {authStatus === "loading" || authStatus === "authenticating" ? "Проверяем..." : "Профиль"}
            </Button>
          )

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 rounded-[22px] bg-secondary/78 p-1">
          {[
            { id: "account", label: "Счёт" },
            { id: "ref", label: "Друзья" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.id ? "bg-card text-foreground shadow-[0_8px_16px_rgba(6,10,18,0.16)]" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button size="icon" variant="secondary" className="shrink-0" onClick={onGoProfile}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <Card className="overflow-hidden border-white/8 bg-[linear-gradient(135deg,rgba(74,158,255,0.2),rgba(27,35,51,0.96))] p-5 shadow-[0_18px_40px_rgba(6,10,18,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{heroLabel}</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-foreground">{heroValue}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-sm font-medium ${(heroDeltaPct || 0) >= 0 ? "text-success" : "text-destructive"}`}>{heroDelta}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${(heroDeltaPct || 0) >= 0 ? "bg-success/18 text-success" : "bg-destructive/18 text-destructive"}`}>
                {formatPercent(heroDeltaPct)}
              </span>
              <span className="text-xs text-muted-foreground">сейчас</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/6 p-3 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <ActionButton icon={<TrendingUp className="h-5 w-5" />} label="Обзор" />
          <ActionButton icon={<ArrowUpRight className="h-5 w-5" />} label="Индексы" />
          <ActionButton icon={<ArrowDownLeft className="h-5 w-5" />} label="Профиль" onClick={onGoProfile} />
        </div>
      </Card>

      <Card className="border-white/8 bg-card/92 p-4 shadow-[0_14px_30px_rgba(6,10,18,0.18)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/18 text-primary">
              <Zap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{statusTitle}</p>
              <p className="truncate text-sm text-muted-foreground">{statusDescription}</p>
            </div>
          </div>
          {statusAction}
        </div>
        {createError || agentError ? (
          <p className="mt-3 text-sm text-destructive">{createError || agentError}</p>
        ) : null}
      </Card>

      <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{currentAgent ? "Подписки агента" : "Индексы"}</h2>
          <button className="flex items-center gap-1 text-sm text-primary">
            Все <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {agentIndexes.slice(0, 4).map((index) => (
            <div key={index.id} className="rounded-2xl bg-secondary/76 p-3 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-sm font-semibold text-foreground">
                {index.icon || index.symbol[0]}
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">{index.symbol}</p>
              <p className={`mt-1 text-xs font-medium ${index.changePct >= 0 ? "text-success" : "text-destructive"}`}>
                {formatPercent(index.changePct)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map((item) => (
          <StatCard
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            valueClassName={item.valueClassName || "text-foreground"}
          />
        ))}
      </div>

      <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">В тренде</h2>
          <button className="flex items-center gap-1 text-sm text-primary">
            Подробнее <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {trendCards.map((item) => (
            <div key={item.id} className="rounded-2xl bg-secondary/76 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-lg font-semibold text-foreground">
                  {item.icon || item.symbol[0]}
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${item.changePct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {formatPercent(item.changePct)}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{item.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatPrice(item.oraclePrice)}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Последние события</h2>
          <button className="text-sm text-primary">История</button>
        </div>
        <div className="flex flex-col gap-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/72 px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${activity.positive ? "bg-success/18 text-success" : "bg-destructive/18 text-destructive"}`}>
                  {activity.positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{activity.asset}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
              <span className={`max-w-[46%] truncate text-right text-sm font-semibold ${activity.positive ? "text-success" : "text-destructive"}`}>
                {activity.amount}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[88px] flex-col items-center justify-center gap-2 rounded-2xl bg-secondary/78 px-3 text-center transition-colors hover:bg-secondary"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-foreground">{icon}</div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueClassName = "text-foreground",
}: {
  icon?: React.ReactNode
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
      <div className="flex items-center gap-2">
        {icon ? <span>{icon}</span> : null}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className={`mt-3 text-xl font-semibold ${valueClassName}`}>{value}</p>
    </Card>
  )
}
