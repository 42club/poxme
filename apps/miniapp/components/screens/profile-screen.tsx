"use client"

import { useMemo, useState } from "react"
import { useTelegramAuth } from "@/components/auth/telegram-auth-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useMiniAppSettings } from "@/lib/mini-app-settings"
import {
  Bell,
  Check,
  ChevronRight,
  Copy,
  FileText,
  HelpCircle,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react"

export function ProfileScreen() {
  const { session } = useTelegramAuth()
  const telegramUser = session?.telegram?.user
  const { error, isLoading, isSaving, settings, updateSettings } = useMiniAppSettings(session?.miniAppPreferences ?? null)
  const [copied, setCopied] = useState(false)

  const fullName = [telegramUser?.firstName, telegramUser?.lastName].filter(Boolean).join(" ") || "Пользователь"
  const subtitle = telegramUser?.username ? `@${telegramUser.username}` : "Профиль Telegram"
  const walletAddress = session?.activeWalletAddress || null
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : "Не подключен"
  const expiresAt = session?.session?.expiresAt || null
  const initials = useMemo(
    () =>
      fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "TG",
    [fullName],
  )
  const sessionExpiresLabel = expiresAt
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(expiresAt)
    : "Активна"

  const copyAddress = () => {
    if (!walletAddress) return
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Профиль</h1>
        <Button size="icon-sm" variant="secondary" className="text-muted-foreground">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <Card className="overflow-hidden border-white/8 bg-card/92 p-5 shadow-[0_18px_40px_rgba(6,10,18,0.22)]">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 ring-1 ring-white/10">
            <AvatarImage
              src={telegramUser?.photoUrl || undefined}
              alt={fullName}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold text-foreground">{fullName}</p>
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                {telegramUser?.isPremium ? "Premium" : "Telegram"}
              </span>
              <span className="rounded-full bg-secondary/90 px-3 py-1 text-xs font-medium text-muted-foreground">
                {walletAddress ? "Кошелёк подключен" : "Кошелёк не подключен"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-secondary/82 p-4">
            <p className="text-sm text-muted-foreground">Кошелёк</p>
            <p className="mt-1 text-base font-medium text-foreground">{shortAddress}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {walletAddress ? "Доступен для торговых действий и запуска агента." : "Подключение понадобится для торговых сценариев."}
            </p>
          </div>
          <div className="rounded-2xl bg-secondary/82 p-4">
            <p className="text-sm text-muted-foreground">Сессия</p>
            <p className="mt-1 text-base font-medium text-foreground">До {sessionExpiresLabel}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Вход привязан к Telegram и ограничен по времени.
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            disabled={!walletAddress}
            onClick={copyAddress}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary/90 px-4 text-sm font-semibold text-foreground transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            Скопировать адрес
          </button>
          <Button className="flex-1">
            <Wallet className="h-4 w-4" />
            {walletAddress ? "Управление" : "Подключить"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-white/8 bg-card/92 p-0 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <SettingsItem
          icon={<Bell className="h-5 w-5" />}
          label="Уведомления"
          description="Сделки, отчеты и важные события"
          action={
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={(value) => void updateSettings({ notificationsEnabled: value })}
            />
          }
        />
        <SettingsItem
          icon={<Sparkles className="h-5 w-5" />}
          label="Компактный интерфейс"
          description="Более плотная навигация и карточки"
          action={
            <Switch
              checked={settings.compactNavigation}
              onCheckedChange={(value) => void updateSettings({ compactNavigation: value })}
            />
          }
        />
        <SettingsItem
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Тактильный отклик"
          description="Лёгкое подтверждение действий внутри приложения"
          action={
            <Switch
              checked={settings.hapticsEnabled}
              onCheckedChange={(value) => void updateSettings({ hapticsEnabled: value })}
            />
          }
          isLast
        />
      </Card>

      <Card className="border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Состояние аккаунта</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Настройки приложения сохраняются для этого пользователя.
            </p>
          </div>
          {isSaving ? (
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">Сохранение...</span>
          ) : null}
        </div>
        {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Загружаем настройки...</p> : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Card>

      <Card className="overflow-hidden border-white/8 bg-card/92 p-0 shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
        <SettingsItem
          icon={<Shield className="h-5 w-5" />}
          label="Безопасность"
          description="Сессия, доступы и защита аккаунта"
          action={<ChevronRight className="h-5 w-5 text-muted-foreground" />}
        />
        <SettingsItem
          icon={<HelpCircle className="h-5 w-5" />}
          label="Помощь и поддержка"
          description="Ответы на вопросы и связь с командой"
          action={<ChevronRight className="h-5 w-5 text-muted-foreground" />}
        />
        <SettingsItem
          icon={<FileText className="h-5 w-5" />}
          label="Условия использования"
          description="Правила работы сервиса"
          action={<ChevronRight className="h-5 w-5 text-muted-foreground" />}
          isLast
        />
      </Card>
    </div>
  )
}

function SettingsItem({
  icon,
  label,
  description,
  action,
  isLast = false,
}: {
  icon: React.ReactNode
  label: string
  description?: string
  action: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4 py-4 ${!isLast ? "border-b border-white/6" : ""}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/90 text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          {description ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span> : null}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
