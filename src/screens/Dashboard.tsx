import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, CalendarBlank, CaretRight, Handshake, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/store'
import { Badge, Button, Card, Screen, Segmented, SectionTitle, Skeleton, cx } from '../components/ui'
import { Bars, Donut, ShareBar } from '../components/Charts'
import { TxDrill } from '../components/TxDrill'
import {
  accountBalance,
  byCategory,
  dailySeries,
  inRange,
  monthlySeries,
  netWorth,
  periodOptions,
  rangeFor,
  totals,
  type Period,
} from '../lib/analytics'
import { compactMoney, dayLabel, money, monthLabel, num, plural, shortDate } from '../lib/format'
import { debtTotals } from '../lib/debts'
import { parseISO, differenceInCalendarDays, getDate } from 'date-fns'

export function Dashboard({
  onAdd,
  onDrill,
}: {
  onAdd: () => void
  onDrill?: (open: boolean) => void
}) {
  const { data, ready, postedCount, dismissPosted, clearDemo, deleteTransaction } = useApp()
  const [period, setPeriod] = useState<Period>('month')
  // Only one drill-down is open at a time: opening one closes the other.
  const [activeSlice, setActiveSlice] = useState<string | null>(null)
  const [activeBar, setActiveBar] = useState<string | null>(null)

  const pickSlice = (id: string | null) => {
    setActiveSlice(id)
    if (id) setActiveBar(null)
  }
  const pickBar = (key: string | null) => {
    setActiveBar(key)
    if (key) setActiveSlice(null)
  }

  const range = useMemo(() => rangeFor(period), [period])
  const scoped = useMemo(
    () => data.transactions.filter((t) => inRange(t, range)),
    [data.transactions, range],
  )
  const sums = useMemo(() => totals(scoped), [scoped])
  const slices = useMemo(
    () => byCategory(scoped, data.categories, 'expense'),
    [scoped, data.categories],
  )
  const debts = useMemo(
    () => debtTotals(data.debts, data.debtPayments),
    [data.debts, data.debtPayments],
  )
  const worth = useMemo(
    () => netWorth(data.accounts, data),
    [data],
  )

  const byMonth = period === 'year' || period === 'all'

  const bars = useMemo(() => {
    if (byMonth) {
      return monthlySeries(data.transactions, 12).map((point) => ({
        key: point.key,
        label: point.label,
        value: point.expense,
        tick: true,
      }))
    }
    const series = dailySeries(scoped, range)
    const step = series.length > 20 ? 7 : series.length > 10 ? 3 : 1
    return series.map((point, i) => ({
      key: point.date,
      label: String(getDate(parseISO(point.date))),
      value: point.expense,
      tick: i % step === 0,
    }))
  }, [byMonth, data.transactions, scoped, range])

  const categoryIndex = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c])),
    [data.categories],
  )
  const accountIndex = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts])

  const sliceItems = useMemo(
    () =>
      activeSlice
        ? scoped
            .filter((t) => t.categoryId === activeSlice)
            .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
        : [],
    [activeSlice, scoped],
  )

  const barItems = useMemo(() => {
    if (!activeBar) return []
    const source = byMonth ? data.transactions : scoped
    const match = byMonth
      ? (t: (typeof source)[number]) => t.occurredAt.slice(0, 7) === activeBar
      : (t: (typeof source)[number]) => t.occurredAt === activeBar
    return source
      .filter((t) => t.kind === 'expense' && match(t))
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
  }, [activeBar, byMonth, data.transactions, scoped])

  // Сообщаем наверх, открыт ли разбор: пока открыт, плавающая кнопка прячется.
  useEffect(() => {
    onDrill?.(Boolean(activeSlice || activeBar))
    return () => onDrill?.(false)
  }, [activeSlice, activeBar, onDrill])

  const selectedSlice = useMemo(
    () => slices.find((s) => s.category.id === activeSlice) ?? null,
    [slices, activeSlice],
  )

  const barTitle = activeBar
    ? byMonth
      ? monthLabel(parseISO(activeBar + '-01'))
      : dayLabel(activeBar)
    : ''

  const upcoming = useMemo(
    () =>
      [...data.recurring]
        .filter((r) => r.active)
        .sort((a, b) => (a.nextRunAt < b.nextRunAt ? -1 : 1))
        .slice(0, 3),
    [data.recurring],
  )

  if (!ready) {
    return (
      <Screen title="Обзор">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[132px]" />
          <Skeleton className="h-[44px]" />
          <Skeleton className="h-[260px]" />
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="Обзор">
      <div className="flex flex-col gap-5">
        {data.settings.demo && (
          <div className="flex items-center gap-3 rounded-[var(--r-md)] bg-accent-soft px-4 py-3">
            <p className="flex-1 text-[13px] leading-snug text-ink">
              Это демонстрационные записи, чтобы экраны не были пустыми.
            </p>
            <button
              type="button"
              onClick={() => void clearDemo()}
              className="shrink-0 text-[13px] font-semibold text-accent"
            >
              Очистить
            </button>
          </div>
        )}

        {postedCount > 0 && (
          <div className="flex items-center gap-3 rounded-[var(--r-md)] bg-surface px-4 py-3">
            <p className="flex-1 text-[13px] leading-snug text-dim">
              Добавлено {postedCount}{' '}
              {plural(postedCount, 'регулярная операция', 'регулярные операции', 'регулярных операций')}{' '}
              за пропущенные даты.
            </p>
            <button
              type="button"
              onClick={dismissPosted}
              aria-label="Скрыть уведомление"
              className="shrink-0 text-faint"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Balance is the one figure worth the largest type on the screen. */}
        <section>
          <p className="text-[13px] text-dim">Всего на счетах</p>
          <p className="tnum mt-1 text-[38px] leading-none font-bold tracking-[-0.035em]">
            {money(worth)}
          </p>
          <div className="no-bar mt-3.5 flex gap-2 overflow-x-auto">
            {data.accounts.map((account) => (
              <div
                key={account.id}
                className="shrink-0 rounded-[var(--r-md)] bg-surface px-3.5 py-2.5"
              >
                <span className="flex items-center gap-1.5 text-[12px] text-dim">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: account.color }}
                    aria-hidden="true"
                  />
                  {account.name}
                </span>
                <span className="tnum mt-0.5 block text-[15px] font-semibold">
                  {money(accountBalance(account, data))}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Segmented value={period} onChange={setPeriod} options={periodOptions()} />

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <span className="flex items-center gap-1.5 text-[12.5px] text-dim">
              <ArrowDown size={14} weight="bold" className="text-pos" />
              Доходы
            </span>
            <span className="tnum mt-1 block text-[19px] font-bold tracking-[-0.02em] text-pos">
              {money(sums.income)}
            </span>
          </Card>
          <Card>
            <span className="flex items-center gap-1.5 text-[12.5px] text-dim">
              <ArrowUp size={14} weight="bold" className="text-neg" />
              Расходы
            </span>
            <span className="tnum mt-1 block text-[19px] font-bold tracking-[-0.02em]">
              {money(sums.expense)}
            </span>
          </Card>
        </div>

        {sums.expense === 0 && sums.income === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-[15px] font-semibold">За этот период записей нет</p>
            <p className="max-w-[30ch] text-[13.5px] leading-relaxed text-dim">
              Добавьте первую операцию, и здесь появится разбивка по категориям.
            </p>
            <Button onClick={onAdd} className="mt-1">
              Добавить операцию
            </Button>
          </Card>
        ) : (
          <>
            {slices.length > 0 && (
              <section>
                <SectionTitle
                  right={
                    <span className="text-[12.5px] text-faint">
                      {slices.length} {plural(slices.length, 'категория', 'категории', 'категорий')}
                    </span>
                  }
                >
                  Куда уходят деньги
                </SectionTitle>
                <Card className="flex flex-col items-center gap-5">
                  <Donut
                    slices={slices.map((s) => ({
                      id: s.category.id,
                      color: s.category.color,
                      share: s.share,
                    }))}
                    total={sums.expense}
                    caption={range.label.toLowerCase()}
                    activeId={activeSlice}
                    onSelect={pickSlice}
                    center={
                      selectedSlice ? (
                        <>
                          <span
                            className="tnum text-[20px] leading-none font-bold tracking-[-0.03em]"
                            style={{ color: selectedSlice.category.color }}
                          >
                            {compactMoney(selectedSlice.total)}
                          </span>
                          <span className="line-clamp-2 text-[12px] leading-tight text-dim">
                            {selectedSlice.category.name}
                          </span>
                          <span className="text-[11px] text-faint">
                            {Math.round(selectedSlice.share * 100)}% расходов
                          </span>
                        </>
                      ) : undefined
                    }
                  />
                  <ul className="flex w-full flex-col gap-3">
                    {slices.slice(0, 6).map((slice) => {
                      const on = activeSlice === slice.category.id
                      return (
                        <li key={slice.category.id}>
                          <button
                            type="button"
                            onClick={() => pickSlice(on ? null : slice.category.id)}
                            aria-pressed={on}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <Badge
                              icon={slice.category.icon}
                              color={slice.category.color}
                              size={34}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span
                                  className={cx(
                                    'truncate text-[14px]',
                                    on ? 'font-semibold' : 'font-medium',
                                  )}
                                >
                                  {slice.category.name}
                                </span>
                                <span className="tnum shrink-0 text-[14px] font-semibold">
                                  {money(slice.total)}
                                </span>
                              </span>
                              <span className="mt-1.5 flex items-center gap-2">
                                <ShareBar share={slice.share} color={slice.category.color} />
                                <span className="tnum w-9 shrink-0 text-right text-[11.5px] text-faint">
                                  {Math.round(slice.share * 100)}%
                                </span>
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </Card>

                <AnimatePresence initial={false}>
                  {selectedSlice && (
                    <TxDrill
                      key={selectedSlice.category.id}
                      title={selectedSlice.category.name}
                      color={selectedSlice.category.color}
                      icon={selectedSlice.category.icon}
                      items={sliceItems}
                      categories={categoryIndex}
                      accounts={accountIndex}
                      onClose={() => pickSlice(null)}
                      moreLink={`/transactions?category=${selectedSlice.category.id}`}
                      onDelete={deleteTransaction}
                    />
                  )}
                </AnimatePresence>
              </section>
            )}

            {bars.length > 1 && (
              <section>
                <SectionTitle>{byMonth ? 'Расходы по месяцам' : 'Расходы по дням'}</SectionTitle>
                <Card>
                  <Bars
                    points={bars}
                    activeKey={activeBar}
                    onSelect={pickBar}
                    unit={byMonth ? 'месяцам' : 'дням'}
                  />
                </Card>

                <AnimatePresence initial={false}>
                  {activeBar && (
                    <TxDrill
                      key={activeBar}
                      title={barTitle}
                      color="var(--accent)"
                      items={barItems}
                      categories={categoryIndex}
                      accounts={accountIndex}
                      onClose={() => pickBar(null)}
                      onDelete={deleteTransaction}
                    />
                  )}
                </AnimatePresence>
              </section>
            )}
          </>
        )}

        {(debts.owedToMe > 0 || debts.iOwe > 0) && (
          <Link
            to="/more/debts"
            className="flex items-center gap-3 rounded-[var(--r-lg)] bg-surface px-4 py-3"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)] bg-surface-2 text-dim">
              <Handshake size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">Долги</span>
              <span className="tnum block truncate text-[13px] text-dim">
                {[
                  debts.owedToMe > 0 && `вам должны ${money(debts.owedToMe)}`,
                  debts.iOwe > 0 && `вы должны ${money(debts.iOwe)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <CaretRight size={15} className="shrink-0 text-faint" />
          </Link>
        )}

        {upcoming.length > 0 && (
          <section>
            <SectionTitle
              right={
                <Link to="/more/recurring" className="text-[12.5px] font-semibold text-accent">
                  Все
                </Link>
              }
            >
              Ближайшие платежи
            </SectionTitle>
            <Card className="flex flex-col gap-3 p-3">
              {upcoming.map((rule) => {
                const category = data.categories.find((c) => c.id === rule.categoryId)
                const days = differenceInCalendarDays(parseISO(rule.nextRunAt), new Date())
                return (
                  <div key={rule.id} className="flex items-center gap-3">
                    <Badge
                      icon={category?.icon ?? 'receipt'}
                      color={category?.color ?? '#7C8794'}
                      size={36}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{rule.title}</span>
                      <span className="flex items-center gap-1 text-[12px] text-faint">
                        <CalendarBlank size={12} />
                        {days <= 0
                          ? 'сегодня'
                          : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`}
                        {' · '}
                        {shortDate(rule.nextRunAt)}
                      </span>
                    </span>
                    <span
                      className={cx(
                        'tnum shrink-0 text-[14px] font-semibold',
                        rule.kind === 'income' ? 'text-pos' : 'text-ink',
                      )}
                    >
                      {rule.kind === 'income' ? '+' : ''}
                      {num(rule.amount)} ₸
                    </span>
                  </div>
                )
              })}
            </Card>
          </section>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="pb-2 text-center text-[12px] text-faint"
        >
          {data.transactions.length}{' '}
          {plural(data.transactions.length, 'операция', 'операции', 'операций')} за всё время
        </motion.p>
      </div>
    </Screen>
  )
}
