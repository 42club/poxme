"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTelegramAuth } from "@/components/auth/telegram-auth-provider"
import {
  BarChart3,
  ChevronRight,
  Clock,
  Download,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"
import {
  fetchAgentByWallet,
  fetchAgentStrategyInstances,
  fetchMarketplacePage,
  fetchMyStrategyTemplates,
  formatCompactNumber,
  formatRelativeTime,
  normalizePriceLabel,
  useApiResource,
  type StrategyMarketplaceListing,
  type StrategyTemplate,
} from "@/lib/odrob-api"

function formatAuthor(authorUserAddress: string) {
  if (authorUserAddress === "system:marketplace") return "ODROB"
  return authorUserAddress.replace(/^system:/, "").replace(/[-_]/g, " ")
}

export function StrategiesScreen() {
  const { session } = useTelegramAuth()
  const [activeTab, setActiveTab] = useState<"catalog" | "my">("catalog")
  const walletAddress = session?.activeWalletAddress || null

  const { data: marketplace, error: marketplaceError, isLoading: isMarketplaceLoading } = useApiResource(
    () => fetchMarketplacePage(20),
    [],
    {
      initialData: {
        items: [],
        total: 0,
        offset: 0,
        limit: 20,
        hasMore: false,
        categories: [],
      },
    },
  )

  const { data: agentLookup } = useApiResource(
    walletAddress ? () => fetchAgentByWallet(walletAddress) : null,
    [walletAddress],
    { enabled: Boolean(walletAddress), initialData: { agent: null } },
  )
  const currentAgent = agentLookup?.agent || null

  const installedResource = useApiResource(
    currentAgent?.id ? () => fetchAgentStrategyInstances(currentAgent.id) : null,
    [currentAgent?.id],
    { enabled: Boolean(currentAgent?.id), initialData: [] as Awaited<ReturnType<typeof fetchAgentStrategyInstances>> },
  )
  const installedInstances = installedResource.data ?? []

  const myTemplatesResource = useApiResource(
    walletAddress ? fetchMyStrategyTemplates : null,
    [walletAddress],
    { enabled: Boolean(walletAddress), initialData: [] as Awaited<ReturnType<typeof fetchMyStrategyTemplates>> },
  )
  const myTemplates = myTemplatesResource.data ?? []

  const listingMap = useMemo(
    () => new Map((marketplace?.items || []).map((item) => [item.strategyTemplateId, item])),
    [marketplace],
  )

  const installedStrategies = useMemo(() => {
    return installedInstances.map((instance) => ({
      instance,
      listing: listingMap.get(instance.strategyTemplateId) || null,
    }))
  }, [installedInstances, listingMap])

  const stats = {
    catalog: marketplace?.total || marketplace?.items.length || 0,
    featured: (marketplace?.items || []).filter((item) => item.featuredRank != null).length,
    mine: myTemplates.length,
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Стратегии</h1>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Создать
        </Button>
      </div>

      <div className="flex rounded-[22px] bg-secondary/78 p-1">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex-1 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "catalog" ? "bg-card text-foreground shadow-[0_8px_16px_rgba(6,10,18,0.16)]" : "text-muted-foreground"
          }`}
        >
          Каталог
        </button>
        <button
          onClick={() => setActiveTab("my")}
          className={`flex-1 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === "my" ? "bg-card text-foreground shadow-[0_8px_16px_rgba(6,10,18,0.16)]" : "text-muted-foreground"
          }`}
        >
          Мои
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-white/8 bg-card/92 p-3 text-center shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
          <p className="mb-1 text-xs text-muted-foreground">В каталоге</p>
          <p className="text-lg font-bold text-foreground">{stats.catalog}</p>
        </Card>
        <Card className="border-white/8 bg-card/92 p-3 text-center shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
          <p className="mb-1 text-xs text-muted-foreground">Подборка</p>
          <p className="text-lg font-bold text-primary">{stats.featured}</p>
        </Card>
        <Card className="border-white/8 bg-card/92 p-3 text-center shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
          <p className="mb-1 text-xs text-muted-foreground">Мои</p>
          <p className="text-lg font-bold text-foreground">{stats.mine}</p>
        </Card>
      </div>

      {activeTab === "catalog" ? (
        <div className="flex flex-col gap-3">
          {marketplaceError ? <p className="text-sm text-destructive">{marketplaceError}</p> : null}
          {isMarketplaceLoading ? <p className="text-sm text-muted-foreground">Загружаем каталог...</p> : null}
          {(marketplace?.items || []).map((strategy) => (
            <CatalogStrategyCard key={strategy.id} strategy={strategy} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {installedStrategies.length > 0 ? (
            <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Подключено к вашему агенту</h2>
              </div>
              <div className="flex flex-col gap-3">
                {installedStrategies.map(({ instance, listing }) => (
                  <div key={instance.id} className="rounded-2xl bg-secondary/72 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-foreground">
                            {listing?.template.name || instance.strategyTemplateId}
                          </p>
                          <Badge className="border-0 bg-primary/15 text-primary capitalize">{instance.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {listing?.template.shortDescription || "Стратегия привязана к агенту и управляется сессией."}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : walletAddress ? (
            <EmptyStateCard
              icon={<BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />}
              title={currentAgent ? "Стратегии ещё не установлены" : "Агент ещё не создан"}
              description={
                currentAgent
                  ? "Когда стратегия будет подключена к вашему агенту, она появится здесь."
                  : "Сначала создайте или привяжите агента к кошельку, затем можно будет подключать стратегии."
              }
            />
          ) : (
            <EmptyStateCard
              icon={<Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />}
              title="Подключите кошелёк"
              description="Без кошелька приложение не сможет показать ваши стратегии и состояние агента."
            />
          )}

          {myTemplates.length > 0 ? (
            <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Мои шаблоны</h2>
              </div>
              <div className="flex flex-col gap-3">
                {myTemplates.map((template) => (
                  <MyStrategyTemplateCard key={template.id} template={template} />
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CatalogStrategyCard({ strategy }: { strategy: StrategyMarketplaceListing }) {
  return (
    <Card className="rounded-[26px] border-white/8 bg-card/92 px-5 py-5 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-bold text-foreground">{strategy.template.name}</h3>
            {strategy.verifiedBadge ? (
              <Badge className="border-0 bg-primary/15 text-primary">Проверено</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{strategy.template.shortDescription}</p>
        </div>
        <Badge variant="outline" className="border-white/10 capitalize text-muted-foreground">
          {strategy.template.category}
        </Badge>
      </div>

      <div className="mt-4 flex items-center gap-5 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{formatCompactNumber(strategy.activeInstallCount)} активных</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Download className="h-4 w-4" />
          <span>{formatCompactNumber(strategy.installCount)} установок</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{formatRelativeTime(strategy.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Автор</p>
          <p className="font-medium text-foreground">{formatAuthor(strategy.authorUserAddress)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Доступ</p>
          <p className={`font-semibold ${strategy.priceMode === "free" ? "text-success" : "text-foreground"}`}>
            {normalizePriceLabel(strategy.priceMode, strategy.priceValue)}
          </p>
        </div>
      </div>
    </Card>
  )
}

function MyStrategyTemplateCard({ template }: { template: StrategyTemplate }) {
  return (
    <div className="rounded-2xl bg-secondary/72 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-foreground">{template.name}</p>
            <Badge className="border-0 bg-primary/15 text-primary capitalize">{template.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{template.shortDescription || "Пользовательский шаблон стратегии."}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </div>
  )
}

function EmptyStateCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card className="border-dashed border-white/10 bg-secondary/38 p-6 text-center">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Card>
  )
}
