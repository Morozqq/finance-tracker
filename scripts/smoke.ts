import assert from 'node:assert/strict'
import { demoSnapshot } from '../src/lib/seed.ts'
import { catchUp, advance, ruleSummary } from '../src/lib/recurring.ts'
import {
  accountBalance, byCategory, dailySeries, groupByDay,
  inRange, monthlySeries, netWorth, rangeFor, totals,
} from '../src/lib/analytics.ts'
import { money, signedMoney, plural, dayLabel, todayISO } from '../src/lib/format.ts'

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
  netWorth(snap.accounts, snap.transactions),
  snap.accounts.reduce((s, a) => s + accountBalance(a, snap.transactions), 0),
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

// Calendar days are local, not UTC: at UTC+5 an evening entry must not land
// on yesterday. todayISO uses local formatting, so this holds.
assert.equal(dayLabel(todayISO()), 'Сегодня')

console.log('smoke: all checks passed')
