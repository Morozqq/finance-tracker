import { useMemo } from 'react'
import { compactMoney, money, num } from '../lib/format'

interface Slice {
  id: string
  color: string
  share: number
}

/**
 * Ring built from dashed circles rather than arc paths: the geometry stays
 * exact at any radius and there is no path data to get wrong.
 */
export function Donut({
  slices,
  total,
  caption,
  size = 176,
  thickness = 22,
  activeId,
}: {
  slices: Slice[]
  total: number
  caption: string
  size?: number
  thickness?: number
  activeId?: string | null
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const gap = slices.length > 1 ? 2.5 : 0

  const segments = useMemo(() => {
    let offset = 0
    return slices.map((slice) => {
      const length = Math.max(0, slice.share * circumference - gap)
      const segment = { ...slice, length, offset }
      offset += slice.share * circumference
      return segment
    })
  }, [slices, circumference, gap])

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="presentation">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={thickness}
          />
          {segments.map((segment) => (
            <circle
              key={segment.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
              opacity={activeId && activeId !== segment.id ? 0.28 : 1}
              style={{ transition: 'opacity 180ms ease' }}
            />
          ))}
        </g>
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <span className="tnum text-[22px] leading-none font-bold tracking-[-0.03em]">
          {compactMoney(total)}
        </span>
        <span className="text-[12px] text-dim">{caption}</span>
      </div>
    </div>
  )
}

export interface BarPoint {
  key: string
  label: string
  value: number
  /** Labels are printed only where this is true, to keep the axis readable. */
  tick?: boolean
}

/**
 * Column chart on a single shared scale. The tallest column names its own
 * value so the reader never has to guess what the height means.
 */
export function Bars({
  points,
  color = 'var(--accent)',
  height = 132,
}: {
  points: BarPoint[]
  color?: string
  height?: number
}) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0])

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[12px] text-dim">
        <span>Пик: {money(peak?.value ?? 0)}</span>
        <span className="text-faint">{peak?.label}</span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height }} role="img"
        aria-label={`Динамика по дням, максимум ${num(max)} тенге`}>
        {points.map((point) => {
          const ratio = point.value / max
          return (
            <div key={point.key} className="flex h-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-[3px]"
                style={{
                  height: `${Math.max(point.value > 0 ? 3 : 1.5, ratio * 100)}%`,
                  background: point.value > 0 ? color : 'var(--surface-3)',
                  opacity: point.value > 0 ? (point === peak ? 1 : 0.62) : 1,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex gap-[3px] text-[10px] text-faint">
        {points.map((point) => (
          <span key={point.key} className="flex-1 text-center">
            {point.tick ? point.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Thin horizontal share bar used in category rankings. */
export function ShareBar({ share, color }: { share: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(2, share * 100)}%`, background: color }}
      />
    </div>
  )
}

/** Ring used on goal cards. */
export function ProgressRing({
  progress,
  color,
  size = 52,
  thickness = 5,
  children,
}: {
  progress: number
  color: string
  size?: number
  thickness?: number
  children?: React.ReactNode
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const filled = Math.min(1, Math.max(0, progress)) * circumference
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="presentation">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        </g>
      </svg>
      <div className="absolute">{children}</div>
    </div>
  )
}
