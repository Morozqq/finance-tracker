import {
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns'
import type { Account, Category, GoalContribution, Transaction, TxKind } from './types'

export type Period = 'month' | 'prev' | 'year' | 'all'

export interface Range {
  from: string
  to: string
  label: string
}

const day = (d: Date) => format(d, 'yyyy-MM-dd')

export function rangeFor(period: Period, now = new Date()): Range {
  switch (period) {
    case 'month':
      return { from: day(startOfMonth(now)), to: day(endOfMonth(now)), label: 'Этот месяц' }
    case 'prev': {
      const p = subMonths(now, 1)
      return { from: day(startOfMonth(p)), to: day(endOfMonth(p)), label: 'Прошлый месяц' }
    }
    case 'year':
      return { from: day(startOfYear(now)), to: day(endOfYear(now)), label: 'Год' }
    case 'all':
      return { from: '0000-01-01', to: '9999-12-31', label: 'Всё время' }
  }
}

export function inRange(tx: Transaction, range: Range): boolean {
  return tx.occurredAt >= range.from && tx.occurredAt <= range.to
}

export interface Totals {
  income: number
  expense: number
  net: number
}

export function totals(transactions: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, net: income - expense }
}

export interface CategorySlice {
  category: Category
  total: number
  share: number
  count: number
}

export function byCategory(
  transactions: Transaction[],
  categories: Category[],
  kind: TxKind,
): CategorySlice[] {
  const index = new Map(categories.map((c) => [c.id, c]))
  const sums = new Map<string, { total: number; count: number }>()
  let grand = 0

  for (const t of transactions) {
    if (t.kind !== kind) continue
    const current = sums.get(t.categoryId) ?? { total: 0, count: 0 }
    current.total += t.amount
    current.count += 1
    sums.set(t.categoryId, current)
    grand += t.amount
  }

  return [...sums.entries()]
    .map(([id, { total, count }]) => ({
      category: index.get(id) ?? {
        id,
        name: 'Без категории',
        kind,
        color: '#7C8794',
        icon: 'dots',
        sort: 999,
      },
      total,
      count,
      share: grand > 0 ? total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export interface DayPoint {
  date: string
  expense: number
  income: number
}

/** Daily buckets across the range, gaps included, so the chart keeps its shape. */
export function dailySeries(transactions: Transaction[], range: Range): DayPoint[] {
  const from = range.from === '0000-01-01' ? earliest(transactions) : range.from
  const to = range.to === '9999-12-31' ? day(new Date()) : range.to
  if (!from) return []

  const buckets = new Map<string, DayPoint>()
  for (const d of eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })) {
    const key = day(d)
    buckets.set(key, { date: key, expense: 0, income: 0 })
  }
  for (const t of transactions) {
    const bucket = buckets.get(t.occurredAt)
    if (!bucket) continue
    if (t.kind === 'income') bucket.income += t.amount
    else bucket.expense += t.amount
  }
  return [...buckets.values()]
}

function earliest(transactions: Transaction[]): string | null {
  let min: string | null = null
  for (const t of transactions) if (!min || t.occurredAt < min) min = t.occurredAt
  return min
}

/** Groups by calendar month for the year view. */
export function monthlySeries(transactions: Transaction[], months: number, now = new Date()) {
  const out: Array<{ key: string; label: string; expense: number; income: number }> = []
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    out.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'LLL'),
      expense: 0,
      income: 0,
    })
  }
  const index = new Map(out.map((m) => [m.key, m]))
  for (const t of transactions) {
    const bucket = index.get(t.occurredAt.slice(0, 7))
    if (!bucket) continue
    if (t.kind === 'income') bucket.income += t.amount
    else bucket.expense += t.amount
  }
  return out
}

export function accountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.initialBalance
  for (const t of transactions) {
    if (t.accountId !== account.id) continue
    balance += t.kind === 'income' ? t.amount : -t.amount
  }
  return balance
}

export function netWorth(accounts: Account[], transactions: Transaction[]): number {
  return accounts.reduce((sum, a) => sum + accountBalance(a, transactions), 0)
}

export function goalSaved(goalId: string, contributions: GoalContribution[]): number {
  return contributions.reduce((sum, c) => (c.goalId === goalId ? sum + c.amount : sum), 0)
}

/** Groups transactions into day sections, newest first. */
export function groupByDay(transactions: Transaction[]) {
  const map = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const list = map.get(t.occurredAt)
    if (list) list.push(t)
    else map.set(t.occurredAt, [t])
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      expense: items.reduce((s, t) => s + (t.kind === 'expense' ? t.amount : 0), 0),
      income: items.reduce((s, t) => s + (t.kind === 'income' ? t.amount : 0), 0),
    }))
}
