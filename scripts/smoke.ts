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

const snap = demoSnapshot()
assert.ok(snap.transactions.length > 30, 'demo has transactions')
assert.ok(snap.categories.length === 14, 'default categories')

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
  netWorth(snap.accounts, snap.transactions, snap.transfers),
  snap.accounts.reduce((s, a) => s + accountBalance(a, snap.transactions, snap.transfers), 0),
)

// Transfers move money between accounts without changing the total.
const [card, cash] = snap.accounts
const move = [{
  id: 'tr-x', fromAccountId: card.id, toAccountId: cash.id,
  amount: 50000, occurredAt: todayISO(), createdAt: '',
}]
assert.equal(
  accountBalance(card, snap.transactions, [...snap.transfers, ...move]),
  accountBalance(card, snap.transactions, snap.transfers) - 50000,
)
assert.equal(
  accountBalance(cash, snap.transactions, [...snap.transfers, ...move]),
  accountBalance(cash, snap.transactions, snap.transfers) + 50000,
)
assert.equal(
  netWorth(snap.accounts, snap.transactions, [...snap.transfers, ...move]),
  netWorth(snap.accounts, snap.transactions, snap.transfers),
  'a transfer leaves the total alone',
)
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
