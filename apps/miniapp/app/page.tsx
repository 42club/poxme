"use client"

import { useState } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { AgentScreen } from "@/components/screens/agent-screen"
import { TradingScreen } from "@/components/screens/trading-screen"
import { StrategiesScreen } from "@/components/screens/strategies-screen"
import { MarketplaceScreen } from "@/components/screens/marketplace-screen"
import { NotificationsScreen } from "@/components/screens/notifications-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"

export default function ODROBApp() {
  const [activeTab, setActiveTab] = useState("agent")

  const renderScreen = () => {
    switch (activeTab) {
      case "agent":
        return <AgentScreen onGoProfile={() => setActiveTab("profile")}/>
      case "trading":
        return <TradingScreen />
      case "strategies":
        return <StrategiesScreen />
      case "marketplace":
        return <MarketplaceScreen />
      case "notifications":
        return <NotificationsScreen />
      case "profile":
        return <ProfileScreen />
      default:
        return <AgentScreen onGoProfile={() => setActiveTab("profile")}/>
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg px-4 pb-28 pt-5 sm:px-6">
        {renderScreen()}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
