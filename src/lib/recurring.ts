import { addDays, addMonths, addWeeks, addYears, format, isAfter, parseISO } from 'date-fns'
import type { Freq, RecurringRule, Transaction } from './types'
import { uid } from './format'

const day = (d: Date) => format(d, 'yyyy-MM-dd')

export function advance(iso: string, freq: Freq, interval: number): string {
  const d = parseISO(iso)
  const step = Math.max(1, interval)
  switch (freq) {
    case 'day':
      return day(addDays(d, step))
    case 'week':
      return day(addWeeks(d, step))
    case 'month':
      return day(addMonths(d, step))
    case 'year':
      return day(addYears(d, step))
  }
}

export const FREQ_LABEL: Record<Freq, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  year: 'Год',
}

export function ruleSummary(rule: RecurringRule): string {
  const n = Math.max(1, rule.interval)
  if (n === 1) {
    return { day: 'Каждый день', week: 'Каждую неделю', month: 'Каждый месяц', year: 'Каждый год' }[
      rule.freq
    ]
  }
  const unit = {
    day: ['день', 'дня', 'дней'],
    week: ['неделю', 'недели', 'недель'],
    month: ['месяц', 'месяца', 'месяцев'],
    year: ['год', 'года', 'лет'],
  }[rule.freq]
  const mod10 = n % 10
  const mod100 = n % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? unit[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? unit[1]
        : unit[2]
  return `Каждые ${n} ${word}`
}

export interface CatchUpResult {
  transactions: Transaction[]
  rules: RecurringRule[]
  posted: number
}

/**
 * Posts every occurrence a rule has passed since it was last seen and moves
 * its cursor forward. Runs on app start, which means a payment lands when the
 * app is opened rather than exactly at midnight. That trade buys a backend
 * this app does not otherwise need.
 */
export function catchUp(rules: RecurringRule[], today = new Date()): CatchUpResult {
  const transactions: Transaction[] = []
  const updated: RecurringRule[] = []
  const stamp = new Date().toISOString()
  // Guards against a rule with a far-past cursor generating thousands of rows.
  const MAX_PER_RULE = 60

  for (const rule of rules) {
    if (!rule.active) {
      updated.push(rule)
      continue
    }

    let cursor = rule.nextRunAt
    let made = 0

    while (!isAfter(parseISO(cursor), today) && made < MAX_PER_RULE) {
      if (rule.endsAt && isAfter(parseISO(cursor), parseISO(rule.endsAt))) break
      transactions.push({
        id: 't-' + uid(),
        kind: rule.kind,
        amount: rule.amount,
        categoryId: rule.categoryId,
        accountId: rule.accountId,
        occurredAt: cursor,
        note: rule.title,
        recurringId: rule.id,
        createdAt: stamp,
      })
      cursor = advance(cursor, rule.freq, rule.interval)
      made += 1
    }

    const ended = Boolean(rule.endsAt && isAfter(parseISO(cursor), parseISO(rule.endsAt)))
    updated.push(
      made > 0 || ended ? { ...rule, nextRunAt: cursor, active: rule.active && !ended } : rule,
    )
  }

  return { transactions, rules: updated, posted: transactions.length }
}
