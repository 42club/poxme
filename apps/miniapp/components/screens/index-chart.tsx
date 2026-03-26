"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSpring, animated } from "@react-spring/web"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import {
  formatCompactNumber,
  formatPercent,
  formatPrice,
  type IndexOracleSnapshot,
  type PublicIndexSnapshot,
} from "@/lib/odrob-api"

const periods = [
  { id: "1D", label: "1Д", points: 24 },
  { id: "1W", label: "1Н", points: 48 },
  { id: "1M", label: "1М", points: 96 },
  { id: "3M", label: "3М", points: 144 },
  { id: "1Y", label: "1Г", points: 200 },
]

interface IndexChartProps {
  index: PublicIndexSnapshot
  history: IndexOracleSnapshot[]
  period: string
  setPeriod: (period: string) => void
}

export function IndexChart({ index, history, period, setPeriod }: IndexChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const data = useMemo(() => {
    const pointLimit = periods.find((item) => item.id === period)?.points ?? 24
    const source = history.length > 1 ? history.slice(-pointLimit) : [{ price: index.oraclePrice, timestamp: Date.now(), indexId: index.id }]
    return source.map((point, position) => ({
      x: position,
      y: point.price,
      timestamp: point.timestamp,
    }))
  }, [history, index.id, index.oraclePrice, period])

  const prevDataRef = useRef(data)
  const [springT, setSpringT] = useState(1)
  const spring = useSpring({
    t: springT,
    config: { tension: 120, friction: 20 },
    onRest: () => {
      if (springT === 1) prevDataRef.current = data
    },
  })

  useEffect(() => {
    prevDataRef.current = prevDataRef.current.length === data.length ? prevDataRef.current : data
    setSpringT(0)
    const timer = window.setTimeout(() => setSpringT(1), 10)
    return () => window.clearTimeout(timer)
  }, [data, period])

  const yValues = data.map((item) => item.y)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const yPad = Math.max(0.02, (maxY - minY) * 0.15)
  const yMin = minY - yPad
  const yMax = maxY + yPad

  const getAnimatedPoints = (progress: number) => {
    const previous = prevDataRef.current
    if (previous.length !== data.length) {
      return data
        .map((point, indexPoint) => {
          const x = data.length === 1 ? 160 : (indexPoint / (data.length - 1)) * 320
          const y = 120 - ((point.y - yMin) / (yMax - yMin || 1)) * 120
          return `${x},${y}`
        })
        .join(" ")
    }

    return data
      .map((point, indexPoint) => {
        const previousY = previous[indexPoint]?.y ?? point.y
        const nextY = point.y
        const interpolatedY = previousY + (nextY - previousY) * progress
        const x = data.length === 1 ? 160 : (indexPoint / (data.length - 1)) * 320
        const y = 120 - ((interpolatedY - yMin) / (yMax - yMin || 1)) * 120
        return `${x},${y}`
      })
      .join(" ")
  }

  const current = hoverIdx !== null ? data[hoverIdx] : data[data.length - 1]
  const previous = data[0]
  const absoluteChange = current.y - previous.y
  const percentChange = previous?.y ? ((current.y - previous.y) / previous.y) * 100 : 0
  const lineColor = absoluteChange >= 0 ? "#22c55e" : "#ef4444"

  return (
    <div>
      <div className="mb-2">
        <div className="flex items-end gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Цена</span>
            <span className="text-2xl font-bold text-foreground">{formatPrice(current.y)}</span>
          </div>
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${absoluteChange >= 0 ? "text-success" : "text-destructive"}`}>
                {formatPrice(absoluteChange)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  absoluteChange >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                }`}
              >
                {absoluteChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {formatPercent(percentChange)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">за выбранный период</span>
          </div>
        </div>
      </div>

      <div className="relative h-40 w-full">
        <svg width="100%" height="100%" viewBox="0 0 320 120" className="absolute left-0 top-0">
          <animated.polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="3"
            points={spring.t.to((value) => getAnimatedPoints(value))}
          />
          {hoverIdx !== null ? (
            <circle
              cx={data.length === 1 ? 160 : (hoverIdx / (data.length - 1)) * 320}
              cy={120 - ((data[hoverIdx].y - yMin) / (yMax - yMin || 1)) * 120}
              r="6"
              fill={lineColor}
              stroke="#fff"
              strokeWidth="2"
            />
          ) : null}
        </svg>
        <div
          className="absolute left-0 top-0 h-full w-full cursor-pointer"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            const x = event.clientX - rect.left
            const indexValue = Math.round((x / rect.width) * (data.length - 1))
            setHoverIdx(Math.max(0, Math.min(data.length - 1, indexValue)))
          }}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchMove={(event) => {
            const touch = event.touches[0]
            const rect = event.currentTarget.getBoundingClientRect()
            const x = touch.clientX - rect.left
            const indexValue = Math.round((x / rect.width) * (data.length - 1))
            setHoverIdx(Math.max(0, Math.min(data.length - 1, indexValue)))
          }}
          onTouchEnd={() => setHoverIdx(null)}
        />
      </div>

      <div className="mt-4 grid w-full grid-cols-5 gap-2">
        {periods.map((item) => (
          <button
            key={item.id}
            onClick={() => setPeriod(item.id)}
            className={`w-full rounded-xl py-2 text-base font-medium transition-colors ${
              period === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-card p-4">
        <div className="mb-1">
          <h2 className="font-medium text-primary">Показатели</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Metric label="Казна" value={formatPrice(index.treasury?.balance || 0)} />
          <Metric label="Холдеры" value={String(index.holderCount)} />
          <Metric label="Трейдов" value={formatCompactNumber(index.totalTrades, 0)} />
          <Metric label="Объём" value={formatPrice(index.totalVolume)} />
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span className="mb-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-center text-lg font-bold text-foreground">{value}</span>
    </div>
  )
}
