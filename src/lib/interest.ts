import { addDays, addMonths, format, getDaysInMonth, parseISO } from 'date-fns'
import { accountMoves, type Ledger } from './analytics'
import type { Account, Category, Transaction } from './types'

const day = (d: Date) => format(d, 'yyyy-MM-dd')

/** Guards against a cursor far in the past posting years of rows at once. */
const MAX_PERIODS = 36

function creditDayIn(year: number, month: number, dayOfMonth: number): string {
  const last = getDaysInMonth(new Date(year, month, 1))
  return day(new Date(year, month, Math.min(dayOfMonth, last)))
}

/** The first credit date strictly after `from`; the 31st falls back to a short month's last day. */
export function nextCreditDate(from: string, dayOfMonth: number): string {
  const d = parseISO(from)
  const thisMonth = creditDayIn(d.getFullYear(), d.getMonth(), dayOfMonth)
  if (thisMonth > from) return thisMonth
  const next = addMonths(new Date(d.getFullYear(), d.getMonth(), 1), 1)
  return creditDayIn(next.getFullYear(), next.getMonth(), dayOfMonth)
}

/** End-of-day balance for every day in [from, to). */
export function dailyBalances(account: Account, ledger: Ledger, from: string, to: string): number[] {
  let balance = account.initialBalance
  const byDay = new Map<string, number>()
  for (const m of accountMoves(account.id, ledger)) {
    if (m.day < from) balance += m.amount
    else if (m.day < to) byDay.set(m.day, (byDay.get(m.day) ?? 0) + m.amount)
  }
  const out: number[] = []
  for (let d = parseISO(from); day(d) < to; d = addDays(d, 1)) {
    balance += byDay.get(day(d)) ?? 0
    out.push(balance)
  }
  return out
}

/** Simple daily interest on actual days over a 365-day year; a negative day earns nothing. */
export function interestFor(balances: number[], rate: number): number {
  const daily = rate / 100 / 365
  return balances.reduce((sum, b) => sum + Math.max(0, b) * daily, 0)
}

export function interestCategory(categories: Category[]): Category | undefined {
  const income = categories.filter((c) => c.kind === 'income' && !c.archived)
  return income.find((c) => c.name.trim().toLowerCase() === 'проценты') ?? income[0]
}

function creditDayOf(account: Account): number {
  return account.interestDay ?? parseISO(account.interestFrom!).getDate()
}

export interface AccrualResult {
  transactions: Transaction[]
  /** Only the accounts whose cursor moved. */
  accounts: Account[]
}

/**
 * Pays every interest period a deposit has finished since its cursor, as
 * income on the credit date, then moves the cursor. Runs when the app opens,
 * like recurring payments. Each payment joins the ledger straight away, so the
 * next period earns on it too: monthly capitalisation. Ids are built from the
 * account and the date, so a second device cannot pay the same month twice.
 */
export function accrueInterest(
  accounts: Account[],
  ledger: Ledger,
  categories: Category[],
  today = new Date(),
): AccrualResult {
  const todayIso = day(today)
  const category = interestCategory(categories)
  const stamp = new Date().toISOString()
  const transactions: Transaction[] = []
  const moved: Account[] = []
  if (!category) return { transactions, accounts: moved }

  let book = ledger
  const known = new Set(ledger.transactions.map((t) => t.id))

  for (const account of accounts) {
    if (!account.interestRate || !account.interestFrom || account.archived) continue
    const dayOfMonth = creditDayOf(account)
    let cursor = account.interestFrom
    let credit = nextCreditDate(cursor, dayOfMonth)

    for (let periods = 0; credit <= todayIso && periods < MAX_PERIODS; periods++) {
      const amount = Math.round(
        interestFor(dailyBalances(account, book, cursor, credit), account.interestRate),
      )
      const id = `t-int-${account.id}-${credit}`
      if (amount > 0 && !known.has(id)) {
        const tx: Transaction = {
          id,
          kind: 'income',
          amount,
          categoryId: category.id,
          accountId: account.id,
          occurredAt: credit,
          note: 'Проценты по вкладу',
          createdAt: stamp,
        }
        transactions.push(tx)
        known.add(id)
        book = { ...book, transactions: [...book.transactions, tx] }
      }
      cursor = credit
      credit = nextCreditDate(cursor, dayOfMonth)
    }

    if (cursor !== account.interestFrom) moved.push({ ...account, interestFrom: cursor })
  }

  return { transactions, accounts: moved }
}

/** Interest earned so far in the running period, and the day it will be paid. */
export function accruedSoFar(
  account: Account,
  ledger: Ledger,
  today = new Date(),
): { amount: number; creditOn: string } | null {
  if (!account.interestRate || !account.interestFrom) return null
  const creditOn = nextCreditDate(account.interestFrom, creditDayOf(account))
  const tomorrow = day(addDays(today, 1))
  const until = tomorrow < creditOn ? tomorrow : creditOn
  const amount =
    account.interestFrom < until
      ? interestFor(dailyBalances(account, ledger, account.interestFrom, until), account.interestRate)
      : 0
  return { amount: Math.round(amount), creditOn }
}

export interface ProjectionPoint {
  month: number
  balance: number
  /** Interest earned from now up to this month. */
  interest: number
}

/** Month-by-month outlook: the top-up lands at the start of a month, interest at its end. */
export function projectDeposit(
  balance: number,
  rate: number,
  topUp: number,
  months: number,
): ProjectionPoint[] {
  const out: ProjectionPoint[] = []
  let current = balance
  let earned = 0
  for (let month = 1; month <= months; month++) {
    current += topUp
    const interest = (Math.max(0, current) * rate) / 100 / 12
    current += interest
    earned += interest
    out.push({ month, balance: Math.round(current), interest: Math.round(earned) })
  }
  return out
}
