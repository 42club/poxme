"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Download,
  Filter,
  Heart,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react"
import {
  fetchMarketplacePage,
  formatCompactNumber,
  normalizePriceLabel,
  useApiResource,
  type StrategyMarketplaceListing,
} from "@/lib/odrob-api"

function formatAuthor(authorUserAddress: string) {
  if (authorUserAddress === "system:marketplace") return "ODROB"
  return authorUserAddress.replace(/^system:/, "").replace(/[-_]/g, " ")
}

export function MarketplaceScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")
  const [favorites, setFavorites] = useState<string[]>([])
  const { data: marketplace, error, isLoading } = useApiResource(() => fetchMarketplacePage(24), [], {
    initialData: {
      items: [],
      total: 0,
      offset: 0,
      limit: 24,
      hasMore: false,
      categories: [],
    },
  })

  const categories = useMemo(
    () => [
      { id: "all", label: "Все" },
      ...(marketplace?.categories || []).map((category) => ({ id: category, label: category })),
    ],
    [marketplace],
  )

  const filteredStrategies = useMemo(() => {
    return (marketplace?.items || []).filter((strategy) => {
      const matchesSearch =
        strategy.template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strategy.template.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = activeCategory === "all" || strategy.template.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [activeCategory, marketplace, searchQuery])

  const featuredStrategy = useMemo(() => {
    return [...(marketplace?.items || [])].sort((left, right) => {
      const leftRank = left.featuredRank ?? 99
      const rightRank = right.featuredRank ?? 99
      if (leftRank !== rightRank) return leftRank - rightRank
      return right.rankingScore - left.rankingScore
    })[0] ?? null
  }, [marketplace])

  const toggleFavorite = (id: string) => {
    setFavorites((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Маркетплейс</h1>
        <Button size="sm" variant="secondary" className="text-muted-foreground">
          <Filter className="mr-2 h-4 w-4" />
          Категории
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск стратегий..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-12 border-0 bg-card pl-10"
        />
      </div>

      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-card/92 text-muted-foreground hover:text-foreground"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <Card className="relative overflow-hidden border-white/8 bg-[linear-gradient(135deg,rgba(74,158,255,0.18),rgba(27,35,51,0.96))] p-5 shadow-[0_18px_40px_rgba(6,10,18,0.22)]">
        <div className="relative z-10">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">Подборка недели</span>
          </div>
          <h3 className="mb-1 text-lg font-bold text-foreground">
            {featuredStrategy?.template.name || "Подбираем лучшие стратегии"}
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            {featuredStrategy?.template.shortDescription || "Актуальные стратегии появятся сразу после загрузки каталога."}
          </p>
          {featuredStrategy ? (
            <div className="flex items-center gap-3">
              <Badge className="border-0 bg-success/20 text-success">
                {featuredStrategy.verifiedBadge ? "Проверено" : `${featuredStrategy.activeInstallCount} активных`}
              </Badge>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Открыть
              </Button>
            </div>
          ) : null}
        </div>
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Стратегии</h2>
          <span className="text-sm text-muted-foreground">
            {isLoading ? "Загрузка..." : `${filteredStrategies.length} найдено`}
          </span>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!isLoading && filteredStrategies.length === 0 ? (
          <Card className="border-white/8 bg-card/92 p-5 text-sm text-muted-foreground shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
            По этому фильтру стратегий пока нет.
          </Card>
        ) : null}

        {filteredStrategies.map((strategy) => (
          <MarketplaceCard
            key={strategy.id}
            strategy={strategy}
            isFavorite={favorites.includes(strategy.id)}
            onToggleFavorite={() => toggleFavorite(strategy.id)}
          />
        ))}
      </div>
    </div>
  )
}

function MarketplaceCard({
  strategy,
  isFavorite,
  onToggleFavorite,
}: {
  strategy: StrategyMarketplaceListing
  isFavorite: boolean
  onToggleFavorite: () => void
}) {
  return (
    <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-medium text-foreground">{strategy.template.name}</h3>
            {strategy.verifiedBadge ? (
              <Badge className="border-0 bg-primary/18 text-primary text-[10px]">Проверено</Badge>
            ) : null}
          </div>
          <p className="mb-1 text-sm text-muted-foreground">{strategy.template.shortDescription}</p>
          <p className="text-xs text-muted-foreground">Автор: {formatAuthor(strategy.authorUserAddress)}</p>
        </div>
        <button
          onClick={onToggleFavorite}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            isFavorite ? "bg-destructive/20 text-destructive" : "bg-secondary/90 text-muted-foreground"
          }`}
        >
          <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="mb-3 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 fill-warning text-warning" />
          <span className="text-foreground">{strategy.avgRating.toFixed(1)}</span>
          <span className="text-muted-foreground">({strategy.reviewCount})</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-foreground">{formatCompactNumber(strategy.activeInstallCount)}</span>
          <span className="text-muted-foreground">активных</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatCompactNumber(strategy.installCount)} установок
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`font-bold ${strategy.priceMode === "free" ? "text-success" : "text-foreground"}`}>
          {normalizePriceLabel(strategy.priceMode, strategy.priceValue)}
        </span>
        <Button size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Открыть
        </Button>
      </div>
    </Card>
  )
}
