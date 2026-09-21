import { Fragment, useMemo, type ReactNode } from 'react'
import { compactMoney, money, num } from '../lib/format'
import { cx } from './ui'

interface Slice {
  id: string
  color: string
  share: number
}

/**
 * Ring built from dashed circles rather than arc paths: the geometry stays
 * exact at any radius and there is no path data to get wrong.
 *
 * With onSelect the arcs become tap targets. pointerEvents="stroke" limits the
 * hit area to the drawn band, so a tap lands on the segment under the finger
 * and the hole in the middle stays inert.
 */
export function Donut({
  slices,
  total,
  caption,
  size = 176,
  thickness = 22,
  activeId,
  onSelect,
  center,
}: {
  slices: Slice[]
  total: number
  caption: string
  size?: number
  thickness?: number
  activeId?: string | null
  onSelect?: (id: string | null) => void
  center?: ReactNode
}) {
  // Выделенный сегмент рисуется толще, поэтому радиус считаем от самой толстой
  // полосы, иначе кольцо срезается рамкой svg.
  const activeThickness = thickness + 6
  const radius = (size - activeThickness - 4) / 2
  const circumference = 2 * Math.PI * radius

  // Сегменты в доли процента разделять нечем: зазор съел бы их целиком.
  const visible = slices.filter((s) => s.share > 0.004)
  const solo = visible.length <= 1
  const gap = solo ? 0 : 2.5

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
          {segments.map((segment) => {
            const selected = activeId === segment.id
            // Единственный сегмент — сплошная окружность без штриховки: так на
            // стыке начала и конца дуги не остаётся шва.
            const whole = solo && segment.share > 0.996
            return (
              <circle
                key={segment.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={selected ? activeThickness : thickness}
                strokeLinecap="butt"
                strokeDasharray={whole ? undefined : `${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={whole ? undefined : -segment.offset}
                opacity={activeId && !selected ? 0.28 : 1}
                pointerEvents={onSelect ? 'stroke' : 'none'}
                style={{
                  cursor: onSelect ? 'pointer' : undefined,
                  transition: 'opacity 180ms ease, stroke-width 180ms ease',
                }}
                onClick={() => onSelect?.(selected ? null : segment.id)}
              />
            )
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute flex flex-col items-center gap-0.5 px-7 text-center">
        {center ?? (
          <>
            <span className="tnum text-[22px] leading-none font-bold tracking-[-0.03em]">
              {compactMoney(total)}
            </span>
            <span className="text-[12px] text-dim">{caption}</span>
          </>
        )}
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
 * Column chart on a single shared scale. Each column is a button, so a tap
 * reports which bucket was picked. The header names the value being looked at:
 * the selected column when there is one, the tallest otherwise.
 */
export function Bars({
  points,
  color = 'var(--accent)',
  height = 132,
  activeKey,
  onSelect,
  unit = 'дням',
}: {
  points: BarPoint[]
  color?: string
  height?: number
  activeKey?: string | null
  onSelect?: (key: string | null) => void
  unit?: string
}) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const peak = points.reduce((best, p) => (p.value > best.value ? p : best), points[0])
  const shown = (activeKey && points.find((p) => p.key === activeKey)) || peak

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[12px]">
        <span className="text-dim">
          {activeKey ? 'Выбрано: ' : 'Пик: '}
          <span className="tnum font-semibold text-ink">{money(shown?.value ?? 0)}</span>
        </span>
        <span className="text-faint">{shown?.label}</span>
      </div>

      <div
        className="flex items-end gap-[3px]"
        style={{ height }}
        role="group"
        aria-label={`Расходы по ${unit}, максимум ${num(max)} тенге`}
      >
        {points.map((point) => {
          const ratio = point.value / max
          const selected = activeKey === point.key
          const dimmed = Boolean(activeKey) && !selected
          return (
            <button
              key={point.key}
              type="button"
              onClick={() => onSelect?.(selected ? null : point.key)}
              disabled={!onSelect}
              aria-pressed={selected}
              aria-label={`${point.label}: ${num(point.value)} тенге`}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <span
                className="block w-full rounded-t-[3px]"
                style={{
                  height: `${Math.max(point.value > 0 ? 3 : 1.5, ratio * 100)}%`,
                  background: point.value > 0 ? color : 'var(--surface-3)',
                  opacity: dimmed ? 0.3 : point.value > 0 && point !== shown ? 0.62 : 1,
                  transition: 'opacity 160ms ease',
                }}
              />
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex gap-[3px] text-[10px]">
        {points.map((point) => (
          <span
            key={point.key}
            className={
              activeKey === point.key
                ? 'flex-1 text-center font-semibold text-ink'
                : 'flex-1 text-center text-faint'
            }
          >
            {point.tick || activeKey === point.key ? point.label : ''}
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

const HEAT = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4']
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const ROW_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', '']

/**
 * GitHub-style activity grid: one column per Monday-first week, one square per
 * day, greener the more of the day got done. Each square is a button, so a tap
 * reports the day.
 */
export function Heatmap({
  weeks,
  levelOf,
  labelOf,
  activeDay,
  onSelect,
  caption,
}: {
  weeks: Array<Array<string | null>>
  levelOf: (day: string) => number
  labelOf: (day: string) => string
  activeDay?: string | null
  onSelect?: (day: string) => void
  caption?: ReactNode
}) {
  // A month is named over the week it starts in. The very first column is
  // named only when the next change is far enough away not to collide.
  const monthOf = (w: number) => Number(weeks[w][0]!.slice(5, 7)) - 1
  const labels = weeks.map((_, w) => {
    if (w === 0) {
      const nextChange = weeks.findIndex((_, i) => i > 0 && monthOf(i) !== monthOf(0))
      return nextChange === -1 || nextChange >= 3 ? MONTHS[monthOf(0)] : ''
    }
    return monthOf(w) !== monthOf(w - 1) ? MONTHS[monthOf(w)] : ''
  })

  return (
    <div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        <span />
        {labels.map((label, w) => (
          <span key={w} className="h-4 overflow-visible text-[10px] whitespace-nowrap text-faint">
            {label}
          </span>
        ))}

        {ROW_LABELS.map((rowLabel, d) => (
          <Fragment key={d}>
            <span className="pr-1 text-[10px] leading-none text-faint self-center">{rowLabel}</span>
            {weeks.map((week, w) => {
              const day = week[d]
              if (!day) return <span key={w} />
              const active = activeDay === day
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSelect?.(day)}
                  disabled={!onSelect}
                  aria-pressed={active}
                  aria-label={labelOf(day)}
                  className={cx(
                    'aspect-square w-full rounded-[3px] transition',
                    HEAT[levelOf(day)] ?? HEAT[0],
                    active && 'ring-[1.5px] ring-ink',
                  )}
                />
              )
            })}
          </Fragment>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11px] text-faint">
        <span className="min-w-0">{caption}</span>
        <span className="ml-auto flex shrink-0 items-center gap-[3px]" aria-hidden="true">
          Меньше
          {HEAT.map((cls) => (
            <span key={cls} className={cx('mx-[1px] size-2.5 rounded-[2px]', cls)} />
          ))}
          Больше
        </span>
      </div>
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
  children?: ReactNode
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
          {/* A zero-length arc with a round cap would still paint a dot. */}
          {filled > 0 && (
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
          )}
        </g>
      </svg>
      <div className="absolute">{children}</div>
    </div>
  )
}
