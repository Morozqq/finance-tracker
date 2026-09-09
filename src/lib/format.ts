import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

const grouped = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

/** 1 240 000 ₸ */
export function money(value: number): string {
  return grouped.format(Math.round(value)) + ' ₸'
}

/** Bare number, no currency mark. For inputs and tight columns. */
export function num(value: number): string {
  return grouped.format(Math.round(value))
}

/** +12 000 ₸ / -3 400 ₸ */
export function signedMoney(value: number, kind: 'income' | 'expense'): string {
  const mark = kind === 'income' ? '+' : '−'
  return mark + grouped.format(Math.abs(Math.round(value))) + ' ₸'
}

/** 1 240 000 -> 1,2 млн. Used only where the full number would not fit. */
export function compactMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.', ',') + ' млн ₸'
  if (abs >= 100_000) return Math.round(value / 1000) + ' тыс ₸'
  return money(value)
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoToDate(iso: string): Date {
  return parseISO(iso)
}

/** "Сегодня" / "Вчера" / "14 марта" / "14 марта 2024" */
export function dayLabel(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return 'Сегодня'
  if (isYesterday(d)) return 'Вчера'
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? 'd MMMM' : 'd MMMM yyyy', { locale: ru })
}

/** "март 2026" */
export function monthLabel(date: Date): string {
  return format(date, 'LLLL yyyy', { locale: ru })
}

export function shortDate(iso: string): string {
  return format(parseISO(iso), 'd MMM', { locale: ru })
}

export function weekdayShort(date: Date): string {
  return format(date, 'EEEEEE', { locale: ru })
}

/** Russian plural: 1 день / 2 дня / 5 дней */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function uid(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  )
}
