"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Sparkles, TrendingUp, Users, ChevronRight } from "lucide-react"
import {
  fetchPublicIndexes,
  formatPercent,
  formatPrice,
  isRecentlyCreated,
  useApiResource,
} from "@/lib/odrob-api"

const tabs = [
  { id: "trending", label: "В тренде", icon: TrendingUp },
  { id: "new", label: "Новые", icon: Sparkles },
  { id: "indices", label: "Индексы", icon: null },
  { id: "agents", label: "Холдеры", icon: Users },
]

export function AllIndicesScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("trending")
  const indexesResource = useApiResource(fetchPublicIndexes, [], {
    initialData: [] as Awaited<ReturnType<typeof fetchPublicIndexes>>,
  })
  const indexes = indexesResource.data ?? []
  const { error, isLoading } = indexesResource

  const filtered = useMemo(() => {
    if (activeTab === "trending") {
      return [...indexes].sort((left, right) => Math.abs(right.changePct) - Math.abs(left.changePct))
    }
    if (activeTab === "new") {
      return indexes.filter((item) => isRecentlyCreated(item.createdAt))
    }
    if (activeTab === "agents") {
      return [...indexes].sort((left, right) => (right.holderCount || 0) - (left.holderCount || 0))
    }
    return indexes
  }, [activeTab, indexes])

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Все индексы</h1>
      </div>

      <div className="flex gap-2 rounded-xl bg-secondary p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-card text-foreground" : "text-muted-foreground"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {tab.label}
            </button>
          )
        })}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Загружаем индексы...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col divide-y divide-border/60">
        {filtered.map((index) => (
          <button
            key={index.id}
            className="group flex w-full items-center justify-between py-3 text-left focus:outline-none"
            onClick={() => router.push(`/all-indices/${index.symbol}`)}
          >
            <div>
              <div className="mb-1 flex items-center gap-2">
                <p className="font-medium leading-none text-foreground">{index.name}</p>
                {isRecentlyCreated(index.createdAt) ? (
                  <Badge className="border-0 bg-primary/20 text-[10px] text-primary">NEW</Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{index.symbol}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="mb-1 text-sm font-medium leading-none text-foreground">{formatPrice(index.oraclePrice)}</p>
                <p className={`text-xs ${index.changePct >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatPercent(index.changePct)}
                </p>
              </div>
              <div className="flex min-w-[72px] flex-col items-end">
                <span className="text-xs text-muted-foreground">Холдеров: {index.holderCount}</span>
                <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
            </div>
          </button>
        ))}

        {!isLoading && filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Нет индексов по выбранному фильтру
          </div>
        ) : null}
      </div>
    </div>
  )
}
