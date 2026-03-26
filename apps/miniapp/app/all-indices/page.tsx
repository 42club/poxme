"use client"

import { useRouter } from "next/navigation"
import { AllIndicesScreen } from "@/components/screens/all-indices-screen"
import { ArrowLeft } from "lucide-react"

export default function AllIndicesPage() {
  const router = useRouter()
  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 min-h-screen bg-background">
      <div className="flex items-center gap-2 mb-4">
        <button
          className="rounded-full p-2 bg-secondary hover:bg-card transition-colors"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-lg font-semibold">Все индексы</span>
      </div>
      <AllIndicesScreen />
    </div>
  )
}
