"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronRight,
  Info,
  RefreshCw,
  Settings,
  Trash2,
  TrendingDown,
} from "lucide-react"
import {
  fetchGlobalFeed,
  formatRelativeTime,
  useApiResource,
  type IndexFeedEvent,
} from "@/lib/odrob-api"

function getNotificationIcon(type: string) {
  switch (type) {
    case "success":
      return <CheckCircle className="h-5 w-5 text-success" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-warning" />
    case "error":
      return <TrendingDown className="h-5 w-5 text-destructive" />
    default:
      return <Info className="h-5 w-5 text-primary" />
  }
}

function getNotificationBg(type: string) {
  switch (type) {
    case "success":
      return "bg-success/20"
    case "warning":
      return "bg-warning/20"
    case "error":
      return "bg-destructive/20"
    default:
      return "bg-primary/20"
  }
}

function normalizeFeedEvent(feedEvent: IndexFeedEvent) {
  const severity = feedEvent.severity === "warn" ? "warning" : feedEvent.severity
  return {
    id: feedEvent.id,
    type: severity || "info",
    title: feedEvent.title,
    message: `Индекс ${feedEvent.indexId} обновил состояние.`,
    time: formatRelativeTime(feedEvent.timestamp),
    indexId: feedEvent.indexId,
  }
}

export function NotificationsScreen() {
  const feedResource = useApiResource(() => fetchGlobalFeed(30), [], {
    initialData: [] as IndexFeedEvent[],
  })
  const feed = feedResource.data ?? []
  const { error, isLoading, refresh } = feedResource
  const [readIds, setReadIds] = useState<string[]>([])
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const notifications = useMemo(() => feed.filter((item) => !dismissedIds.includes(item.id)).map(normalizeFeedEvent), [dismissedIds, feed])

  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length
  const filteredNotifications =
    filter === "all" ? notifications : notifications.filter((item) => !readIds.includes(item.id))

  const markAllAsRead = () => {
    setReadIds(notifications.map((item) => item.id))
  }

  const deleteNotification = (id: string) => {
    setDismissedIds((current) => [...current, id])
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Уведомления</h1>
          {unreadCount > 0 ? <Badge className="bg-primary text-primary-foreground">{unreadCount}</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="secondary" className="text-muted-foreground" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="icon-sm" variant="secondary" className="text-muted-foreground">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex rounded-[22px] bg-secondary/78 p-1">
        <button
          onClick={() => setFilter("all")}
          className={`flex-1 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
            filter === "all" ? "bg-card text-foreground shadow-[0_8px_16px_rgba(6,10,18,0.16)]" : "text-muted-foreground"
          }`}
        >
          Все
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`flex-1 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
            filter === "unread"
              ? "bg-card text-foreground shadow-[0_8px_16px_rgba(6,10,18,0.16)]"
              : "text-muted-foreground"
          }`}
        >
          Непрочитанные ({unreadCount})
        </button>
      </div>

      {unreadCount > 0 ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-sm text-primary" onClick={markAllAsRead}>
            Прочитать все
          </Button>
        </div>
      ) : null}

      {isLoading ? <p className="text-sm text-muted-foreground">Обновляем события...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2">
        {!isLoading && filteredNotifications.length === 0 ? (
          <Card className="border-white/8 bg-card/92 p-8 text-center shadow-[0_16px_32px_rgba(6,10,18,0.18)]">
            <Bell className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Пока нет новых событий</p>
          </Card>
        ) : null}

        {filteredNotifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            isRead={readIds.includes(notification.id)}
            onDelete={() => deleteNotification(notification.id)}
            onRead={() => setReadIds((current) => (current.includes(notification.id) ? current : [...current, notification.id]))}
          />
        ))}
      </div>
    </div>
  )
}

function NotificationCard({
  notification,
  isRead,
  onDelete,
  onRead,
}: {
  notification: ReturnType<typeof normalizeFeedEvent>
  isRead: boolean
  onDelete: () => void
  onRead: () => void
}) {
  return (
    <Card
      className={`border-white/8 bg-card/92 p-4 shadow-[0_16px_32px_rgba(6,10,18,0.18)] ${!isRead ? "border-l-2 border-l-primary" : ""}`}
      onClick={onRead}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${getNotificationBg(notification.type)}`}>
          {getNotificationIcon(notification.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`text-sm font-medium ${!isRead ? "text-foreground" : "text-muted-foreground"}`}>
                {notification.title}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
              <button className="mt-1 flex items-center gap-1 text-xs text-primary">
                {notification.indexId} <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <button onClick={onDelete} className="p-1 text-muted-foreground transition-colors hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{notification.time}</p>
        </div>
      </div>
    </Card>
  )
}
