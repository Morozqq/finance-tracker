import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Trash, X } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Badge, cx } from './ui'
import { dayLabel, money, plural, signedMoney } from '../lib/format'
import type { Account, Category, Transaction } from '../lib/types'

/**
 * Opens under the chart when a slice or a column is tapped: what exactly went
 * into that number, and a way to remove a wrong entry without leaving the
 * screen.
 */
export function TxDrill({
  title,
  color,
  icon,
  items,
  categories,
  accounts,
  onClose,
  moreLink,
  onDelete,
}: {
  title: string
  color: string
  icon?: string
  items: Transaction[]
  categories: Map<string, Category>
  accounts: Map<string, Account>
  onClose: () => void
  moreLink?: string
  onDelete: (id: string) => Promise<void>
}) {
  const reduce = useReducedMotion()
  const box = useRef<HTMLElement>(null)
  const total = items.reduce((s, t) => s + (t.kind === 'expense' ? t.amount : -t.amount), 0)

  // Панель раскрывается под графиком, часто за нижним краем экрана. Подводим
  // её в поле зрения, иначе нажатие выглядит так, будто ничего не произошло.
  useEffect(() => {
    const id = window.setTimeout(() => {
      box.current?.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'nearest',
      })
    }, 260)
    return () => window.clearTimeout(id)
  }, [reduce])

  return (
    <motion.section
      ref={box}
      initial={reduce ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reduce ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className="mt-3 rounded-[var(--r-lg)] bg-surface-2 p-3 pb-4">
        <header className="mb-2 flex items-center gap-2.5 px-1">
          {icon && <Badge icon={icon} color={color} size={32} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold">{title}</p>
            <p className="text-[12px] text-dim">
              {items.length} {plural(items.length, 'операция', 'операции', 'операций')} ·{' '}
              <span className="tnum">{money(Math.abs(total))}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition active:scale-90"
          >
            <X size={16} weight="bold" />
          </button>
        </header>

        {items.length === 0 ? (
          <p className="px-1 py-4 text-center text-[13px] text-faint">Записей нет</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((tx) => (
              <DrillRow
                key={tx.id}
                tx={tx}
                category={categories.get(tx.categoryId)}
                accountName={accounts.get(tx.accountId)?.name}
                onDelete={() => onDelete(tx.id)}
              />
            ))}
          </ul>
        )}

        {moreLink && items.length > 0 && (
          <Link
            to={moreLink}
            className="mt-2 block rounded-[var(--r-md)] py-2 text-center text-[13px] font-semibold text-accent"
          >
            Открыть в списке операций
          </Link>
        )}
      </div>
    </motion.section>
  )
}

/** Delete asks once. A single tap next to a money figure is too easy to hit. */
function DrillRow({
  tx,
  category,
  accountName,
  onDelete,
}: {
  tx: Transaction
  category?: Category
  accountName?: string
  onDelete: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <li className="flex items-center gap-2.5 rounded-[var(--r-md)] bg-surface px-2.5 py-2">
      <Badge icon={category?.icon ?? 'dots'} color={category?.color ?? '#7C8794'} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">
          {tx.note?.trim() || category?.name || 'Без категории'}
        </p>
        <p className="truncate text-[11.5px] text-faint">
          {dayLabel(tx.occurredAt)}
          {accountName ? ` · ${accountName}` : ''}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex shrink-0 items-center gap-1.5"
          >
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onDelete()
                } finally {
                  setBusy(false)
                  setConfirming(false)
                }
              }}
              className="rounded-full bg-neg px-3 py-1.5 text-[12px] font-semibold text-white transition active:scale-95 disabled:opacity-50"
            >
              Удалить
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-1.5 py-1.5 text-[12px] font-medium text-dim"
            >
              Отмена
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex shrink-0 items-center gap-1"
          >
            <span
              className={cx(
                'tnum text-[13.5px] font-semibold',
                tx.kind === 'income' ? 'text-pos' : 'text-ink',
              )}
            >
              {signedMoney(tx.amount, tx.kind)}
            </span>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Удалить операцию на ${tx.amount} тенге`}
              className="grid size-8 place-items-center rounded-full text-faint transition active:scale-90"
            >
              <Trash size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}
