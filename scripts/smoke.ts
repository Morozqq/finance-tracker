import assert from 'node:assert/strict'
import { demoSnapshot } from '../src/lib/seed.ts'
import { catchUp, advance, ruleSummary } from '../src/lib/recurring.ts'
import {
  accountBalance, byCategory, dailySeries, groupByDay,
  inRange, monthlySeries, netWorth, rangeFor, totals,
} from '../src/lib/analytics.ts'
import { money, signedMoney, plural, dayLabel, todayISO } from '../src/lib/format.ts'
import {
  heatLevel, heatmapWeeks, spawnTasks, spawnedId, statsByDay,
  streak, weekCompletion, weekdaysLabel,
} from '../src/lib/tasks.ts'
import { accrueInterest, nextCreditDate, projectDeposit } from '../src/lib/interest.ts'
import { debtRemaining, debtTotals, knownPeople } from '../src/lib/debts.ts'
import type { Account, Debt, DebtPayment } from '../src/lib/types.ts'

const snap = demoSnapshot()
assert.ok(snap.transactions.length > 30, 'demo has transactions')
assert.ok(snap.categories.length === 14, 'default categories')
// Accounts carry a manual position; the first one is the default in new entries.
assert.deepEqual(snap.accounts.map((a) => a.sort), [0, 1, 2])

// Money formatting uses the Russian grouping plus the tenge mark.
// Intl groups with a non-breaking space, so compare on the digits themselves.
assert.equal(money(1240000).replace(/\s/g, ' '), '1 240 000 ₸')
assert.equal(money(0).replace(/\s/g, ' '), '0 ₸')
assert.equal(signedMoney(3400, 'expense').startsWith('−'), true)
assert.equal(plural(1, 'день', 'дня', 'дней'), 'день')
assert.equal(plural(3, 'день', 'дня', 'дней'), 'дня')
assert.equal(plural(11, 'день', 'дня', 'дней'), 'дней')

// Every transaction carries a real category and account.
const catIds = new Set(snap.categories.map((c) => c.id))
const accIds = new Set(snap.accounts.map((a) => a.id))
for (const t of snap.transactions) {
  assert.ok(catIds.has(t.categoryId), 'category exists for ' + t.id)
  assert.ok(accIds.has(t.accountId), 'account exists for ' + t.id)
  assert.ok(t.amount > 0, 'amount is positive')
}

// Totals and per-category shares agree with each other.
const month = rangeFor('month')
const scoped = snap.transactions.filter((t) => inRange(t, month))
const sums = totals(scoped)
const slices = byCategory(scoped, snap.categories, 'expense')
const sliceSum = slices.reduce((s, x) => s + x.total, 0)
assert.equal(sliceSum, sums.expense, 'category totals equal the expense total')
const shareSum = slices.reduce((s, x) => s + x.share, 0)
assert.ok(Math.abs(shareSum - 1) < 1e-9 || slices.length === 0, 'shares add up to 1')

// Balances.
assert.equal(
  netWorth(snap.accounts, snap),
  snap.accounts.reduce((s, a) => s + accountBalance(a, snap), 0),
)

// Transfers move money between accounts without changing the total.
const [card, cash] = snap.accounts
const move = [{
  id: 'tr-x', fromAccountId: card.id, toAccountId: cash.id,
  amount: 50000, occurredAt: todayISO(), createdAt: '',
}]
const moved = { ...snap, transfers: [...snap.transfers, ...move] }
assert.equal(accountBalance(card, moved), accountBalance(card, snap) - 50000)
assert.equal(accountBalance(cash, moved), accountBalance(cash, snap) + 50000)
assert.equal(netWorth(snap.accounts, moved), netWorth(snap.accounts, snap), 'a transfer leaves the total alone')
// ...and never count as income or spending in the day sums.
const mixed = groupByDay([...snap.transactions.filter((t) => t.occurredAt === todayISO()), ...move])
const todayGroup = mixed.find((g) => g.date === todayISO())!
assert.ok(todayGroup.items.some((i) => i.id === 'tr-x'), 'transfer listed with its day')
assert.equal(
  todayGroup.expense + todayGroup.income,
  snap.transactions
    .filter((t) => t.occurredAt === todayISO())
    .reduce((s, t) => s + t.amount, 0),
  'day sums ignore transfers',
)

// Debts: lending takes money off the account, a repayment brings it back,
// and neither is spending or income.
const lend: Debt = {
  id: 'd-1', direction: 'lent', person: 'Асет', amount: 20000,
  accountId: card.id, occurredAt: todayISO(), createdAt: '1',
}
const owe: Debt = { ...lend, id: 'd-2', direction: 'borrowed', person: 'асет', amount: 7000, createdAt: '2' }
const back: DebtPayment = {
  id: 'dp-1', debtId: 'd-1', amount: 5000, accountId: card.id, occurredAt: todayISO(), createdAt: '3',
}
const cardNow = accountBalance(card, snap)
assert.equal(accountBalance(card, { ...snap, debts: [lend] }), cardNow - 20000, 'lending leaves the account')
assert.equal(accountBalance(card, { ...snap, debts: [lend], debtPayments: [back] }), cardNow - 15000, 'repayment returns')
assert.equal(accountBalance(card, { ...snap, debts: [owe] }), cardNow + 7000, 'borrowing lands on the account')
assert.equal(
  accountBalance(card, { ...snap, debts: [owe], debtPayments: [{ ...back, debtId: 'd-2' }] }),
  cardNow + 2000,
  'paying back a loan leaves the account',
)
assert.equal(debtRemaining(lend, [back]), 15000)
assert.deepEqual(debtTotals([lend, owe], [back]), { owedToMe: 15000, iOwe: 7000 })
assert.deepEqual(knownPeople([lend, owe]), ['асет'], 'names dedupe regardless of case')
const debtDay = groupByDay([lend, back])[0]
assert.equal(debtDay.expense + debtDay.income, 0, 'debts do not count as spending or income')

// Interest: daily on the actual balance, paid monthly, compounding.
assert.equal(nextCreditDate('2026-09-21', 21), '2026-10-21')
assert.equal(nextCreditDate('2026-09-10', 21), '2026-09-21')
assert.equal(nextCreditDate('2026-08-31', 31), '2026-09-30', 'the 31st falls back to a short month end')
assert.equal(nextCreditDate('2026-01-31', 31), '2026-02-28')

const deposit: Account = {
  id: 'a-dep', name: 'Депозит', type: 'savings', initialBalance: 1_000_000, color: '#2FAF8C',
  sort: 0, interestRate: 14, interestDay: 21, interestFrom: '2026-09-21',
}
const blank = { transactions: [], transfers: [], debts: [], debtPayments: [] }
const percentCategory = snap.categories.find((c) => c.name === 'Проценты')!
const oct21 = new Date(2026, 9, 21, 12)

const first = accrueInterest([deposit], blank, snap.categories, oct21)
assert.equal(first.transactions.length, 1)
assert.equal(first.transactions[0].amount, 11507, '1 000 000 at 14% for 30 days, got ' + first.transactions[0].amount)
assert.equal(first.transactions[0].occurredAt, '2026-10-21')
assert.equal(first.transactions[0].categoryId, percentCategory.id)
assert.equal(first.accounts[0].interestFrom, '2026-10-21', 'cursor moves to the credit date')

// A top-up on 6 October earns for its 15 remaining days.
const topped = accrueInterest([deposit], {
  ...blank,
  transfers: [{ id: 'tr-top', fromAccountId: 'a-x', toAccountId: 'a-dep', amount: 100000, occurredAt: '2026-10-06', createdAt: '' }],
}, snap.categories, oct21)
assert.equal(
  topped.transactions[0].amount,
  Math.round((1_000_000 * 0.14 * 30) / 365 + (100_000 * 0.14 * 15) / 365),
  'a top-up counts from its own day',
)

// The second month earns on the first month's interest as well.
const twoMonths = accrueInterest([deposit], blank, snap.categories, new Date(2026, 10, 21, 12))
assert.equal(twoMonths.transactions.length, 2)
assert.equal(twoMonths.transactions[1].amount, Math.round((1_011_507 * 0.14 * 31) / 365), 'capitalised')

// Paid already, say from another device: the cursor moves, nothing is paid twice.
const repeat = accrueInterest([deposit], { ...blank, transactions: first.transactions }, snap.categories, oct21)
assert.equal(repeat.transactions.length, 0)
assert.equal(repeat.accounts[0].interestFrom, '2026-10-21')
// A cursor years back catches up at most 36 months per run.
assert.equal(accrueInterest([{ ...deposit, interestFrom: '2020-01-21' }], blank, snap.categories, oct21).transactions.length, 36)
// No rate, no interest.
assert.equal(accrueInterest([{ ...deposit, interestRate: undefined }], blank, snap.categories, oct21).transactions.length, 0)

// Outlook: 100 000 a month at 14% for a year.
const outlook = projectDeposit(0, 14, 100_000, 12)
assert.equal(outlook.length, 12)
assert.ok(outlook[11].balance > 1_290_000 && outlook[11].balance < 1_300_000, 'a year out: ' + outlook[11].balance)
assert.ok(Math.abs(outlook[11].balance - outlook[11].interest - 1_200_000) <= 1, 'balance = top-ups + interest')

// Grouping keeps every row and orders days newest first.
const groups = groupByDay(scoped)
assert.equal(groups.reduce((s, g) => s + g.items.length, 0), scoped.length)
for (let i = 1; i < groups.length; i++) assert.ok(groups[i - 1].date > groups[i].date)

// Series cover the range without gaps.
const series = dailySeries(scoped, month)
assert.ok(series.length >= 28 && series.length <= 31, 'a month of buckets: ' + series.length)
assert.equal(monthlySeries(snap.transactions, 12).length, 12)

// Recurring: advancing and catching up.
assert.equal(advance('2026-01-31', 'month', 1), '2026-02-28')
assert.equal(advance('2026-03-10', 'week', 2), '2026-03-24')
assert.ok(ruleSummary({ freq: 'month', interval: 1 } as never).length > 0)
assert.equal(ruleSummary({ freq: 'day', interval: 3 } as never), 'Каждые 3 дня')

// A rule three months overdue posts exactly the missed occurrences.
const overdue = [{
  ...snap.recurring[0],
  nextRunAt: '2026-06-10',
  freq: 'month' as const,
  interval: 1,
  active: true,
}]
const run = catchUp(overdue, new Date('2026-09-10T12:00:00Z'))
assert.equal(run.posted, 4, 'jun, jul, aug, sep -> 4 postings, got ' + run.posted)
assert.equal(run.rules[0].nextRunAt, '2026-10-10')
for (const t of run.transactions) assert.equal(t.recurringId, overdue[0].id)

// An inactive rule posts nothing.
assert.equal(catchUp([{ ...overdue[0], active: false }], new Date('2026-09-10')).posted, 0)

// A rule past its end date stops.
const ending = catchUp(
  [{ ...overdue[0], nextRunAt: '2026-06-10', endsAt: '2026-07-15' }],
  new Date('2026-09-10'),
)
assert.equal(ending.posted, 2, 'jun + jul, got ' + ending.posted)
assert.equal(ending.rules[0].active, false, 'rule deactivates after its end date')

// Tasks: standing templates spawn on their weekdays only, once per day.
// 2026-09-21 is a Monday.
const monday = new Date(2026, 8, 21, 12)
const template = {
  id: 'tt-a',
  title: 'Отжаться 20 раз',
  weekdays: [1, 3, 5],
  nextDay: '2026-09-14',
  createdAt: '2026-09-14T08:00:00Z',
}
const spawn = spawnTasks([template], [], monday)
assert.deepEqual(
  spawn.tasks.map((t) => t.day),
  ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21'],
  'mon, wed, fri, mon',
)
assert.equal(spawn.tasks[0].id, spawnedId('tt-a', '2026-09-14'))
assert.equal(spawn.templates[0].nextDay, '2026-09-22', 'cursor moves to tomorrow')
assert.equal(spawnTasks(spawn.templates, spawn.tasks, monday).templates.length, 0, 'nothing twice a day')
// Same cursor but tasks already there (second device): no duplicates.
assert.equal(spawnTasks([template], spawn.tasks, monday).tasks.length, 0, 'deterministic ids dedupe')
// A deleted day stays deleted once the cursor has passed it.
const withoutToday = spawn.tasks.filter((t) => t.day !== '2026-09-21')
assert.equal(spawnTasks(spawn.templates, withoutToday, monday).tasks.length, 0)
// A template untouched for a year backfills at most 60 days.
const stale = spawnTasks([{ ...template, weekdays: [0, 1, 2, 3, 4, 5, 6], nextDay: '2025-09-01' }], [], monday)
assert.equal(stale.tasks.length, 60, 'backfill capped, got ' + stale.tasks.length)

assert.equal(weekdaysLabel([0, 1, 2, 3, 4, 5, 6]), 'Каждый день')
assert.equal(weekdaysLabel([1, 2, 3, 4, 5]), 'Будни')
assert.equal(weekdaysLabel([6, 0]), 'Выходные')
assert.equal(weekdaysLabel([5, 1, 3]), 'Пн, Ср, Пт')

assert.equal(heatLevel(undefined), 0)
assert.equal(heatLevel({ done: 0, total: 3 }), 0)
assert.equal(heatLevel({ done: 1, total: 4 }), 1)
assert.equal(heatLevel({ done: 1, total: 2 }), 2)
assert.equal(heatLevel({ done: 2, total: 3 }), 3)
assert.equal(heatLevel({ done: 3, total: 3 }), 4, 'only a finished day is the brightest')

// Streak: an unfinished today and a day without tasks do not break the run.
const task = (day: string, done: boolean) =>
  ({ id: day + done + Math.random(), title: 'x', day, done, createdAt: '' })
const history = statsByDay([
  task('2026-09-21', false),
  task('2026-09-20', true),
  task('2026-09-18', true),
  task('2026-09-18', true),
  task('2026-09-17', false),
])
assert.equal(streak(history, monday), 2, 'sun + fri, sat has no tasks')
assert.deepEqual(weekCompletion(history, monday), { done: 3, total: 5 })

// The grid ends with the current week; days after today are empty.
const grid = heatmapWeeks(monday, 20)
assert.equal(grid.length, 20)
assert.equal(grid[19][0], '2026-09-21', 'last column starts on this monday')
assert.equal(grid[19][1], null, 'tomorrow is not drawn')
assert.equal(grid[0][0], '2026-05-11')

// Calendar days are local, not UTC: at UTC+5 an evening entry must not land
// on yesterday. todayISO uses local formatting, so this holds.
assert.equal(dayLabel(todayISO()), 'Сегодня')

console.log('smoke: all checks passed')
