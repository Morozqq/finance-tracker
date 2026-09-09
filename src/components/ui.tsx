import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { CaretLeft } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { iconOf } from '../lib/icons'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Page shell: fixed title area, scrollable body, room for the tab bar. */
export function Screen({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-end justify-between px-5 pt-2 pb-3">
          <h1 className="text-[28px] leading-none font-bold tracking-[-0.025em]">{title}</h1>
          {action}
        </div>
      </header>
      <main className="px-5 pb-[calc(96px+env(safe-area-inset-bottom))]">{children}</main>
    </div>
  )
}

/** Nested page: back arrow instead of a large title. */
export function SubScreen({
  title,
  back,
  action,
  children,
}: {
  title: string
  back: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-[100dvh]">
      <header
        className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2 px-3 pt-1 pb-3">
          <Link
            to={back}
            aria-label="Назад"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink transition active:scale-95"
          >
            <CaretLeft size={21} weight="bold" />
          </Link>
          <h1 className="flex-1 truncate text-[19px] font-bold tracking-[-0.02em]">{title}</h1>
          {action}
        </div>
      </header>
      <main className="px-5 pb-[calc(96px+env(safe-area-inset-bottom))]">{children}</main>
    </div>
  )
}

export function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  // A faded accent fill reads as a muddy colour rather than as "unavailable",
  // so the disabled state drops to a neutral surface instead.
  const base =
    'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--r-md)] px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:active:scale-100 disabled:bg-surface-2 disabled:text-faint'
  const skin = {
    primary: 'bg-accent text-accent-ink',
    soft: 'bg-surface-2 text-ink',
    ghost: 'text-dim disabled:bg-transparent',
    danger: 'bg-neg-soft text-neg',
  }[variant]
  return <button className={cx(base, skin, className)} {...rest} />
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div className="flex gap-1 rounded-[var(--r-md)] bg-surface-2 p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cx(
              'flex-1 rounded-[calc(var(--r-md)-4px)] py-2 text-[13px] font-semibold transition',
              active ? 'bg-surface text-ink shadow-[var(--shadow-lift)]' : 'text-dim',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Coloured category or goal badge. */
export function Badge({
  icon,
  color,
  size = 40,
}: {
  icon: string
  color: string
  size?: number
}) {
  const Glyph = iconOf(icon)
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[calc(var(--r-md)-4px)]"
      style={{ width: size, height: size, background: color + '22', color }}
      aria-hidden="true"
    >
      <Glyph size={size * 0.5} weight="fill" />
    </span>
  )
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section'
}) {
  return (
    <Tag className={cx('rounded-[var(--r-lg)] bg-surface p-4', className)}>{children}</Tag>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{children}</h2>
      {right}
    </div>
  )
}

export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon: string
  title: string
  hint: string
  action?: ReactNode
}) {
  const Glyph = iconOf(icon)
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] bg-surface px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-faint">
        <Glyph size={26} weight="duotone" />
      </span>
      <p className="text-[16px] font-semibold">{title}</p>
      <p className="max-w-[34ch] text-[14px] leading-relaxed text-dim">{hint}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  )
}

/** Matches the shape of the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx('animate-pulse rounded-[var(--r-md)] bg-surface-2', className)}
      aria-hidden="true"
    />
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-dim">{label}</span>
      {children}
      {error ? (
        <span className="text-[12px] text-neg">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  )
}

export const inputClass =
  'h-12 w-full rounded-[var(--r-md)] bg-surface-2 px-4 text-[16px] text-ink placeholder:text-faint outline-none focus:ring-2 focus:ring-accent'
