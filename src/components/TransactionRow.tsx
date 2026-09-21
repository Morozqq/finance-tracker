import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowsLeftRight, Handshake, Trash } from '@phosphor-icons/react'
import { Badge } from './ui'
import { money, signedMoney } from '../lib/format'
import type { Category, Debt, DebtPayment, Transaction, Transfer } from '../lib/types'

/**
 * Swiping left reveals a delete button rather than deleting outright: on a
 * list you scroll with your thumb, a one-gesture destroy is too easy to hit.
 */
function SwipeRow({
  onEdit,
  onDelete,
  children,
}: {
  onEdit: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const [revealed, setRevealed] = useState(false)

  return (
    <div className="relative overflow-hidden rounded-[var(--r-md)]">
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          type="button"
          onClick={onDelete}
          tabIndex={revealed ? 0 : -1}
          aria-hidden={!revealed}
          className="grid h-full w-[76px] place-items-center bg-neg-soft text-neg"
        >
          <Trash size={20} weight="bold" />
        </button>
      </div>

      <motion.div
        drag={reduce ? false : 'x'}
        dragConstraints={{ left: -76, right: 0 }}
        dragElastic={0.05}
        dragMomentum={false}
        animate={{ x: revealed ? -76 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 42 }}
        onDragEnd={(_, info) => setRevealed(info.offset.x < -38)}
        className="relative bg-surface"
      >
        <button
          type="button"
          onClick={() => (revealed ? setRevealed(false) : onEdit())}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        >
          {children}
        </button>
      </motion.div>
    </div>
  )
}

export function TransactionRow({
  tx,
  category,
  accountName,
  onEdit,
  onDelete,
}: {
  tx: Transaction
  category?: Category
  accountName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <SwipeRow onEdit={onEdit} onDelete={onDelete}>
      <Badge icon={category?.icon ?? 'dots'} color={category?.color ?? '#7C8794'} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">
          {category?.name ?? 'Без категории'}
        </span>
        <span className="block truncate text-[12.5px] text-faint">
          {tx.note ? tx.note : (accountName ?? '')}
        </span>
      </span>
      <span
        className="tnum shrink-0 text-[15px] font-semibold"
        style={{ color: tx.kind === 'income' ? 'var(--positive)' : 'var(--text)' }}
      >
        {signedMoney(tx.amount, tx.kind)}
      </span>
    </SwipeRow>
  )
}

/** A transfer is neither a gain nor a loss, so its amount carries no sign or colour. */
export function TransferRow({
  transfer,
  fromName,
  toName,
  onEdit,
  onDelete,
}: {
  transfer: Transfer
  fromName?: string
  toName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <SwipeRow onEdit={onEdit} onDelete={onDelete}>
      <span
        className="grid size-10 shrink-0 place-items-center rounded-[calc(var(--r-md)-4px)] bg-surface-2 text-dim"
        aria-hidden="true"
      >
        <ArrowsLeftRight size={20} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">Перевод</span>
        <span className="block truncate text-[12.5px] text-faint">
          {fromName ?? 'Счёт'} → {toName ?? 'Счёт'}
          {transfer.note ? ` · ${transfer.note}` : ''}
        </span>
      </span>
      <span className="tnum shrink-0 text-[15px] font-semibold text-dim">
        {money(transfer.amount)}
      </span>
    </SwipeRow>
  )
}

/**
 * A debt or a repayment. Money moves between the account and a person, so like
 * a transfer it carries no colour; the sign says which way it went.
 */
export function DebtRow({
  entry,
  debt,
  accountName,
  onOpen,
  onDelete,
}: {
  entry: Debt | DebtPayment
  /** The debt itself, or the one a repayment belongs to. */
  debt?: Debt
  accountName?: string
  onOpen: () => void
  onDelete: () => void
}) {
  const repayment = 'debtId' in entry
  const lent = debt?.direction === 'lent'
  // Money leaves the account when lending, or when paying back a loan.
  const outgoing = repayment ? !lent : lent
  const title = repayment ? 'Возврат долга' : lent ? 'Дал в долг' : 'Взял в долг'

  return (
    <SwipeRow onEdit={onOpen} onDelete={onDelete}>
      <span
        className="grid size-10 shrink-0 place-items-center rounded-[calc(var(--r-md)-4px)] bg-surface-2 text-dim"
        aria-hidden="true"
      >
        <Handshake size={20} weight="bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        <span className="block truncate text-[12.5px] text-faint">
          {debt?.person ?? 'Долг удалён'}
          {accountName ? ` · ${accountName}` : ''}
        </span>
      </span>
      <span className="tnum shrink-0 text-[15px] font-semibold text-dim">
        {outgoing ? '−' : '+'}
        {money(entry.amount)}
      </span>
    </SwipeRow>
  )
}
