"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, RefreshCw, TrendingUp } from "lucide-react"
import {
  fetchPublicIndexes,
  formatPercent,
  formatPrice,
  formatCompactNumber,
  useApiResource,
} from "@/lib/odrob-api"

export function TradingScreen() {
  const router = useRouter()
  const indexesResource = useApiResource(fetchPublicIndexes, [], {
    initialData: [] as Awaited<ReturnType<typeof fetchPublicIndexes>>,
  })
  const indexes = indexesResource.data ?? []
  const { error, isLoading, refresh } = indexesResource

  const sortedIndexes = useMemo(
    () => [...indexes].sort((left, right) => (right.changePct || 0) - (left.changePct || 0)),
    [indexes],
  )
  const featuredIndex = sortedIndexes[0] ?? null

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Торговля</h1>
        <Button size="sm" variant="secondary" className="text-muted-foreground" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Обновить
        </Button>
      </div>

      <Card className="relative overflow-hidden border-white/8 bg-[linear-gradient(135deg,rgba(74,158,255,0.2),rgba(27,35,51,0.96))] p-5 shadow-[0_18px_40px_rgba(6,10,18,0.22)]">
        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Рынок в реальном времени</span>
          </div>
          <h3 className="mb-1 text-lg font-bold text-foreground">
            {featuredIndex ? `${featuredIndex.name} (${featuredIndex.symbol})` : "Загружаем индексы"}
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            {featuredIndex?.description || "Собираем активные индексы и рыночные изменения."}
          </p>
          <div className="flex items-center gap-3">
            <Badge className="border-0 bg-success/20 text-success">
              {featuredIndex ? formatPercent(featuredIndex.changePct) : "Обновляется"}
            </Badge>
            {featuredIndex ? (
              <Button size="sm" className="gap-2" onClick={() => router.push(`/all-indices/${featuredIndex.symbol}`)}>
                Открыть
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
      </Card>

      <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Индексы</h2>
          <button
            className="text-sm text-primary transition-colors hover:text-primary/80"
            onClick={() => router.push("/all-indices")}
          >
            Посмотреть все
          </button>
        </div>

        {isLoading ? <p className="py-4 text-sm text-muted-foreground">Загружаем рыночные данные...</p> : null}
        {error ? <p className="py-2 text-sm text-destructive">{error}</p> : null}

        {!isLoading && sortedIndexes.length === 0 ? (
          <div className="rounded-2xl bg-secondary/70 px-4 py-5 text-sm text-muted-foreground">
            Индексы пока недоступны.
          </div>
        ) : null}

        <div className="flex flex-col divide-y divide-border/60">
          {sortedIndexes.map((index) => (
            <button
              key={index.id}
              className="group flex items-center justify-between gap-3 rounded-2xl px-1 py-3 text-left"
              onClick={() => router.push(`/all-indices/${index.symbol}`)}
            >
              <div className="min-w-0">
                <p className="mb-1 font-medium leading-none text-foreground">{index.name}</p>
                <p className="text-xs text-muted-foreground">{index.symbol}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="mb-1 text-xs text-muted-foreground">Объём</p>
                  <p className="text-sm font-medium text-foreground">{formatCompactNumber(index.totalVolume)}</p>
                </div>
                <div className="text-right">
                  <p className="mb-1 text-sm font-medium leading-none text-foreground">{formatPrice(index.oraclePrice)}</p>
                  <p className={`text-xs ${index.changePct >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatPercent(index.changePct)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
