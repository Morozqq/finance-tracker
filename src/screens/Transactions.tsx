import { useMemo, useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../data/store'
import { Button, Empty, Screen, Segmented, Skeleton, cx, inputClass } from '../components/ui'
import { TransactionRow, TransferRow } from '../components/TransactionRow'
import {
  groupByDay,
  inRange,
  isTransfer,
  periodOptions,
  rangeFor,
  totals,
  type Period,
} from '../lib/analytics'
import { dayLabel, money, plural } from '../lib/format'
import type { Transaction, Transfer } from '../lib/types'

export function Transactions({
  onAdd,
  onEdit,
}: {
  onAdd: () => void
  onEdit: (entry: Transaction | Transfer) => void
}) {
  const { data, ready, deleteTransaction, deleteTransfer } = useApp()
  const [params, setParams] = useSearchParams()
  const [period, setPeriod] = useState<Period>('month')
  const [query, setQuery] = useState('')

  const categoryFilter = params.get('category')
  const range = useMemo(() => rangeFor(period), [period])
  const categoryIndex = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c])),
    [data.categories],
  )
  const accountIndex = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return data.transactions.filter((tx) => {
      if (!inRange(tx, range)) return false
      if (categoryFilter && tx.categoryId !== categoryFilter) return false
      if (!needle) return true
      const category = categoryIndex.get(tx.categoryId)?.name.toLowerCase() ?? ''
      return category.includes(needle) || (tx.note ?? '').toLowerCase().includes(needle)
    })
  }, [data.transactions, range, categoryFilter, query, categoryIndex])

  // Transfers have no category, so a category filter hides them.
  const transfers = useMemo(() => {
    if (categoryFilter) return []
    const needle = query.trim().toLowerCase()
    return data.transfers.filter((t) => {
      if (!inRange(t, range)) return false
      if (!needle) return true
      const text = [
        'перевод',
        accountIndex.get(t.fromAccountId)?.name,
        accountIndex.get(t.toAccountId)?.name,
        t.note,
      ]
        .join(' ')
        .toLowerCase()
      return text.includes(needle)
    })
  }, [data.transfers, range, categoryFilter, query, accountIndex])

  const groups = useMemo(() => groupByDay([...filtered, ...transfers]), [filtered, transfers])
  const sums = useMemo(() => totals(filtered), [filtered])
  const count = filtered.length + transfers.length
  const activeCategory = categoryFilter ? categoryIndex.get(categoryFilter) : undefined

  if (!ready) {
    return (
      <Screen title="Операции">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[44px]" />
          <Skeleton className="h-[48px]" />
          <Skeleton className="h-[220px]" />
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="Операции">
      <div className="flex flex-col gap-4">
        <Segmented value={period} onChange={setPeriod} options={periodOptions()} />

        <div className="relative">
          <MagnifyingGlass
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Категория или комментарий"
            aria-label="Поиск по операциям"
            className={cx(inputClass, 'pl-11')}
          />
        </div>

        {activeCategory && (
          <button
            type="button"
            onClick={() => setParams({}, { replace: true })}
            className="flex items-center gap-2 self-start rounded-full bg-surface-2 py-1.5 pr-2.5 pl-3 text-[13px] font-medium"
          >
            <span
              className="size-2 rounded-full"
              style={{ background: activeCategory.color }}
              aria-hidden="true"
            />
            {activeCategory.name}
            <X size={14} weight="bold" className="text-faint" />
          </button>
        )}

        {count > 0 && (
          <div className="flex items-baseline justify-between rounded-[var(--r-md)] bg-surface px-4 py-3">
            <span className="text-[13px] text-dim">
              {count} {plural(count, 'операция', 'операции', 'операций')}
            </span>
            <span className="tnum text-[15px] font-semibold">
              {sums.income > 0 && <span className="text-pos">+{money(sums.income)}</span>}
              {sums.income > 0 && sums.expense > 0 && <span className="text-faint"> · </span>}
              {sums.expense > 0 && <span>−{money(sums.expense)}</span>}
            </span>
          </div>
        )}

        {groups.length === 0 ? (
          <Empty
            icon="receipt"
            title={query || categoryFilter ? 'Ничего не найдено' : 'Пока пусто'}
            hint={
              query || categoryFilter
                ? 'Попробуйте другой период или снимите фильтр.'
                : 'Здесь появятся ваши операции. Начните с первой траты за сегодня.'
            }
            action={
              query || categoryFilter ? undefined : <Button onClick={onAdd}>Добавить операцию</Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <section key={group.date}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <h2 className="text-[13px] font-semibold text-dim">{dayLabel(group.date)}</h2>
                  <span className="tnum text-[12.5px] text-faint">
                    {group.expense > 0 ? `−${money(group.expense)}` : ''}
                    {group.expense > 0 && group.income > 0 ? ' · ' : ''}
                    {group.income > 0 ? `+${money(group.income)}` : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((entry) =>
                    isTransfer(entry) ? (
                      <TransferRow
                        key={entry.id}
                        transfer={entry}
                        fromName={accountIndex.get(entry.fromAccountId)?.name}
                        toName={accountIndex.get(entry.toAccountId)?.name}
                        onEdit={() => onEdit(entry)}
                        onDelete={() => void deleteTransfer(entry.id)}
                      />
                    ) : (
                      <TransactionRow
                        key={entry.id}
                        tx={entry}
                        category={categoryIndex.get(entry.categoryId)}
                        accountName={accountIndex.get(entry.accountId)?.name}
                        onEdit={() => onEdit(entry)}
                        onDelete={() => void deleteTransaction(entry.id)}
                      />
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}
