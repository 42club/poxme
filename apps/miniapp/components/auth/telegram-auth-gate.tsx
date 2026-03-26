"use client"

import { RefreshCw, Smartphone, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useTelegramAuth } from "@/components/auth/telegram-auth-provider"

function LoadingState({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center">
        <Card className="w-full border-0 bg-card/90 p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground">Вход через Telegram</h1>
          <p className="text-sm leading-6 text-muted-foreground">{label}</p>
        </Card>
      </div>
    </div>
  )
}

export function TelegramAuthGate({ children }: { children: React.ReactNode }) {
  const { error, isTelegramMiniApp, refresh, status } = useTelegramAuth()

  if (status === "loading") {
    return <LoadingState label="Проверяем доступ и открываем приложение." />
  }

  if (status === "authenticating") {
    return <LoadingState label="Выполняем вход. Это займет несколько секунд." />
  }

  if (status === "authenticated") {
    return <>{children}</>
  }

  const title = status === "error" ? "Не удалось войти" : "Откройте приложение в Telegram"
  const description = status === "error"
    ? "Попробуйте открыть приложение еще раз из Telegram."
    : (isTelegramMiniApp
      ? "Не получилось подтвердить вход. Откройте приложение заново из бота."
      : "Чтобы продолжить, откройте это приложение из Telegram.")

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center">
        <Card className="w-full border-0 bg-card/95 p-8 text-center shadow-2xl shadow-black/20">
          <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${status === "error" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
            {status === "error" ? <TriangleAlert className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
          </div>
          <h1 className="mb-2 text-xl font-semibold text-foreground">{title}</h1>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>

          <div className="mt-2 flex flex-col gap-3">
            <Button className="w-full" onClick={() => void refresh()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Попробовать снова
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
