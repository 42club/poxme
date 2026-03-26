"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { IndexChart } from "@/components/screens/index-chart"
import { BottomNav } from "@/components/bottom-nav"
import {
  fetchIndexHolders,
  fetchIndexOracle,
  fetchIndexTrades,
  fetchPublicAgents,
  fetchPublicIndexes,
  formatCurrency,
  formatPercent,
  formatPrice,
  useApiResource,
} from "@/lib/odrob-api"

export default function IndexPage() {
  const router = useRouter()
  const params = useParams<{ symbol: string }>()
  const symbol = Array.isArray(params?.symbol) ? params.symbol[0] : params?.symbol
  const [period, setPeriod] = useState("1D")
  const [activeTab, setActiveTab] = useState("trade")

  const indexesResource = useApiResource(fetchPublicIndexes, [], {
    initialData: [] as Awaited<ReturnType<typeof fetchPublicIndexes>>,
  })
  const indexes = indexesResource.data ?? []
  const { isLoading: isIndexesLoading, error: indexesError } = indexesResource
  const index = indexes.find((item) => item.symbol === symbol) || null

  const tradesResource = useApiResource(
    index ? () => fetchIndexTrades(index.id, 20) : null,
    [index?.id],
    { enabled: Boolean(index), initialData: [] as Awaited<ReturnType<typeof fetchIndexTrades>> },
  )
  const trades = tradesResource.data ?? []
  const historyResource = useApiResource(
    index ? () => fetchIndexOracle(index.id, 200) : null,
    [index?.id],
    { enabled: Boolean(index), initialData: [] as Awaited<ReturnType<typeof fetchIndexOracle>> },
  )
  const history = historyResource.data ?? []
  const holdersResource = useApiResource(
    index ? () => fetchIndexHolders(index.id) : null,
    [index?.id],
    { enabled: Boolean(index), initialData: [] as Awaited<ReturnType<typeof fetchIndexHolders>> },
  )
  const holders = holdersResource.data ?? []
  const agentsResource = useApiResource(fetchPublicAgents, [], {
    initialData: [] as Awaited<ReturnType<typeof fetchPublicAgents>>,
  })
  const agents = agentsResource.data ?? []

  const agentNameMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent.name])), [agents])

  if (isIndexesLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Загружаем индекс...</div>
  }

  if (!index) {
    return <div className="p-8 text-center text-sm text-muted-foreground">{indexesError || "Индекс не найден"}</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <button
            className="rounded-full bg-secondary p-2 transition-colors hover:bg-card"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-lg font-semibold">
            {index.name} ({index.symbol})
          </span>
        </div>

        <div className="mb-6 flex justify-center">
          <div className="flex gap-3 rounded-full bg-secondary/60 px-2 py-1">
            {[
              { id: "trade", label: "Торговля" },
              { id: "treasury", label: "Казна" },
              { id: "leaderboard", label: "Лидерборд" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-6 py-2 text-base font-medium transition-colors ${
                  activeTab === tab.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ minWidth: 120 }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <IndexChart index={index} history={history} period={period} setPeriod={setPeriod} />

        <div className="mb-6 mt-6 flex flex-col gap-2 rounded-2xl bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-medium text-primary">Об индексе</h2>
          </div>
          <p className="text-sm leading-snug text-muted-foreground">{index.description}</p>
          {index.formulaText ? (
            <div className="mt-2 rounded-2xl bg-secondary/70 px-3 py-2 text-xs text-muted-foreground">{index.formulaText}</div>
          ) : null}
        </div>

        {activeTab === "trade" ? (
          <div className="mb-6 flex flex-col gap-2 rounded-2xl bg-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium text-primary">Последние сделки</h2>
            </div>
            <div className="flex flex-col gap-3">
              {trades.map((trade) => {
                const isBuy = trade.side === "buy"
                const actor = isBuy ? trade.buyerName : trade.sellerName
                return (
                  <div key={trade.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isBuy ? "bg-success/20" : "bg-destructive/20"}`}>
                        {isBuy ? (
                          <ArrowUpRight className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isBuy ? "Покупка" : "Продажа"} {index.symbol} <span className="text-muted-foreground">· {actor || "Участник"}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{formatPrice(trade.price)} за единицу</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${isBuy ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(trade.value, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{trade.size.toFixed(2)} шт.</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {activeTab === "treasury" ? (
          <div className="mb-6 grid grid-cols-2 gap-3">
            <TreasuryCard label="Баланс казны" value={formatPrice(index.treasury?.balance || 0)} />
            <TreasuryCard label="Собрано" value={formatPrice(index.treasury?.totalCollected || 0)} />
            <TreasuryCard label="Распределено" value={formatPrice(index.treasury?.totalRedistributed || 0)} />
            <TreasuryCard label="Покрытие" value={formatPercent(index.treasury?.backingRatio || 0)} />
          </div>
        ) : null}

        {activeTab === "leaderboard" ? (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-card p-4">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-medium text-primary">Топ держателей</h2>
            </div>
            {holders.map((holder, position) => (
              <div key={holder.agentId} className="flex items-center justify-between rounded-2xl bg-secondary/70 px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">
                    #{position + 1} {agentNameMap.get(holder.agentId) || holder.agentId}
                  </p>
                  <p className="text-sm text-muted-foreground">{holder.balance.toFixed(2)} токенов</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{formatPrice(holder.holdingValueUsd)}</p>
                  <p className={`text-xs ${holder.unrealizedPnl >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatPrice(holder.unrealizedPnl)} unrealized
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <BottomNav activeTab="trading" onTabChange={() => router.push("/")} />
    </div>
  )
}

function TreasuryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
