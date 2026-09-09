import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Trash } from '@phosphor-icons/react'
import { Badge } from './ui'
import { signedMoney } from '../lib/format'
import type { Category, Transaction } from '../lib/types'

/**
 * Swiping left reveals a delete button rather than deleting outright: on a
 * list you scroll with your thumb, a one-gesture destroy is too easy to hit.
 */
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
        </button>
      </motion.div>
    </div>
  )
}
