"use client"

import { cn } from "@/lib/utils"
import { 
  Bot, 
  LineChart, 
  CandlestickChart,
  Store, 
  Bell 
} from "lucide-react"

interface BottomNavProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "agent", label: "Агент", icon: Bot },
  { id: "trading", label: "Торговля", icon: CandlestickChart },
  { id: "strategies", label: "Стратегии", icon: LineChart },
  { id: "marketplace", label: "Маркет", icon: Store },
  { id: "notifications", label: "Алерты", icon: Bell },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div
        className="mx-auto max-w-lg px-4 pb-3 sm:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
      >
        <div className="relative overflow-hidden rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] px-1.5 py-1.5 shadow-[0_18px_42px_rgba(3,8,20,0.32),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-[24px]">
          <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/65 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(136,187,255,0.2),transparent_56%)] opacity-80" />
          <div className="relative grid grid-cols-5 items-center gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[18px] px-1 py-1.5 text-[10px] font-medium leading-none transition-all duration-200 active:scale-[0.97]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground/95 hover:text-foreground"
                  )}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-[14px] bg-transparent transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="truncate px-1">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
