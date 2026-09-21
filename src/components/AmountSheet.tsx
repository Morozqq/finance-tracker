import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowsDownUp, Backspace, CaretDown, Check, Trash } from '@phosphor-icons/react'
import { format, subDays } from 'date-fns'
import { Sheet } from './Sheet'
import { Badge, Button, Segmented, cx, inputClass } from './ui'
import { useApp } from '../data/store'
import { accountBalance, isTransfer } from '../lib/analytics'
import { dayLabel, money, num, todayISO } from '../lib/format'
import type { Account, Transaction, Transfer, TxKind } from '../lib/types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'] as const

type Mode = TxKind | 'transfer'

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'expense', label: 'Расход' },
  { value: 'income', label: 'Доход' },
  { value: 'transfer', label: 'Перевод' },
]

export function AmountSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Transaction | Transfer | null
}) {
  const {
    data,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addTransfer,
    updateTransfer,
    deleteTransfer,
  } = useApp()
  const [mode, setMode] = useState<Mode>('expense')
  const [digits, setDigits] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [details, setDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const transfer = mode === 'transfer'
  const editingTransfer = Boolean(editing && isTransfer(editing))

  const categories = useMemo(
    () =>
      data.categories.filter((c) => c.kind === mode && !c.archived).sort((a, b) => a.sort - b.sort),
    [data.categories, mode],
  )
  const accounts = useMemo(() => data.accounts.filter((a) => !a.archived), [data.accounts])

  useEffect(() => {
    if (!open) return
    setDetails(false)
    setConfirmDelete(false)
    // A new transfer defaults from the first account into savings, the usual move.
    const first = accounts[0]?.id ?? ''
    const other =
      accounts.find((a) => a.id !== first && a.type === 'savings')?.id ??
      accounts.find((a) => a.id !== first)?.id ??
      ''
    if (editing && isTransfer(editing)) {
      setMode('transfer')
      setCategoryId('')
      setAccountId(first)
      setFromId(editing.fromAccountId)
      setToId(editing.toAccountId)
    } else if (editing) {
      setMode(editing.kind)
      setCategoryId(editing.categoryId)
      setAccountId(editing.accountId)
      setFromId(first)
      setToId(other)
    } else {
      setMode('expense')
      setCategoryId('')
      setAccountId(first)
      setFromId(first)
      setToId(other)
    }
    setDigits(editing ? String(editing.amount) : '')
    setDate(editing?.occurredAt ?? todayISO())
    setNote(editing?.note ?? '')
  }, [open, editing, accounts])

  // Keep the chosen category valid when the kind flips.
  useEffect(() => {
    if (categoryId && !categories.some((c) => c.id === categoryId)) setCategoryId('')
  }, [categories, categoryId])

  const amount = Number(digits || '0')
  const canSave =
    amount > 0 &&
    !saving &&
    (transfer
      ? Boolean(fromId) && Boolean(toId) && fromId !== toId
      : Boolean(categoryId) && Boolean(accountId))

  // Picking the account already on the other side swaps the two.
  const pickFrom = (id: string) => {
    if (id === toId) setToId(fromId)
    setFromId(id)
  }
  const pickTo = (id: string) => {
    if (id === fromId) setFromId(toId)
    setToId(id)
  }

  const press = (key: (typeof KEYS)[number]) => {
    navigator.vibrate?.(8)
    if (key === 'back') {
      setDigits((d) => d.slice(0, -1))
      return
    }
    setDigits((d) => {
      const next = (d + key).replace(/^0+/, '')
      return next.length > 12 ? d : next
    })
  }

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const common = { amount, occurredAt: date, note: note.trim() || undefined }
      if (transfer) {
        const payload = { ...common, fromAccountId: fromId, toAccountId: toId }
        if (editing && isTransfer(editing)) await updateTransfer({ ...editing, ...payload })
        else await addTransfer(payload)
      } else {
        const payload = { ...common, kind: mode as TxKind, categoryId, accountId }
        if (editing && !isTransfer(editing)) await updateTransaction({ ...editing, ...payload })
        else await addTransaction(payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const balanceOf = (id: string) => {
    const account = accounts.find((a) => a.id === id)
    return account ? accountBalance(account, data.transactions, data.transfers) : 0
  }

  const accountName = accounts.find((a) => a.id === accountId)?.name ?? ''
  const dateChips = [
    { value: todayISO(), label: 'Сегодня' },
    { value: format(subDays(new Date(), 1), 'yyyy-MM-dd'), label: 'Вчера' },
  ]
  const chip = (active: boolean) =>
    cx(
      'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95',
      active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-dim',
    )

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full
      title={editing ? (editingTransfer ? 'Изменить перевод' : 'Изменить операцию') : undefined}
    >
      <div className="flex flex-col gap-3 pt-1">
        {/* An existing record keeps its nature: an operation can flip between
            spending and income, but a transfer is a different kind of entry. */}
        {!editingTransfer && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={editing ? MODES.filter((m) => m.value !== 'transfer') : MODES}
          />
        )}

        <div className="flex items-baseline justify-center gap-1.5">
          <span
            className={cx(
              'tnum text-[40px] leading-none font-bold tracking-[-0.04em]',
              amount > 0 ? (mode === 'income' ? 'text-pos' : 'text-ink') : 'text-faint',
            )}
          >
            {digits ? num(amount) : '0'}
          </span>
          <span className="text-[24px] leading-none font-semibold text-dim">₸</span>
        </div>

        {transfer ? (
          accounts.length < 2 ? (
            <p className="rounded-[var(--r-md)] bg-surface-2 px-4 py-3 text-center text-[13px] leading-relaxed text-dim">
              Для перевода нужен второй счёт. Добавьте его в разделе «Ещё» → «Счета».
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <AccountChips
                label="Откуда"
                accounts={accounts}
                value={fromId}
                onPick={pickFrom}
                hint={fromId ? `на счёте ${money(balanceOf(fromId))}` : undefined}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setFromId(toId)
                    setToId(fromId)
                  }}
                  aria-label="Поменять счета местами"
                  className="grid size-8 place-items-center rounded-full bg-surface-2 text-dim transition active:scale-90"
                >
                  <ArrowsDownUp size={16} weight="bold" />
                </button>
              </div>
              <AccountChips
                label="Куда"
                accounts={accounts}
                value={toId}
                onPick={pickTo}
                hint={toId ? `на счёте ${money(balanceOf(toId))}` : undefined}
              />
            </div>
          )
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {categories.map((category) => {
              const active = category.id === categoryId
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryId(category.id)}
                  aria-pressed={active}
                  className={cx(
                    'flex flex-col items-center gap-1 rounded-[var(--r-md)] px-1 py-1.5 transition active:scale-95',
                    active ? 'bg-surface-2' : '',
                  )}
                  style={active ? { boxShadow: `inset 0 0 0 2px ${category.color}` } : undefined}
                >
                  <Badge icon={category.icon} color={category.color} size={34} />
                  <span className="w-full truncate text-center text-[10.5px] text-dim">
                    {category.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Account, date and note are set once and rarely changed, so they
            collapse into a summary line and leave the keypad room to breathe. */}
        <button
          type="button"
          onClick={() => setDetails((d) => !d)}
          aria-expanded={details}
          className="flex items-center gap-2 rounded-[var(--r-md)] bg-surface-2 px-3.5 py-2 text-[13px]"
        >
          <span className="min-w-0 flex-1 truncate text-left text-dim">
            {transfer ? '' : `${accountName} · `}
            {dayLabel(date)}
            {note.trim() ? ` · ${note.trim()}` : ''}
          </span>
          <CaretDown
            size={14}
            weight="bold"
            className={cx('shrink-0 text-faint transition-transform', details && 'rotate-180')}
          />
        </button>

        <AnimatePresence initial={false}>
          {details && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2.5 pb-1">
                {/* A transfer already names both of its accounts above. */}
                {!transfer && (
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => setAccountId(account.id)}
                        className={chip(account.id === accountId)}
                      >
                        {account.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {dateChips.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDate(item.value)}
                      className={chip(date === item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={date}
                    max={todayISO()}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Дата операции"
                    className="h-[34px] rounded-full bg-surface-2 px-3 text-[13px] text-dim outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Комментарий"
                  aria-label="Комментарий"
                  className={cx(inputClass, 'h-11')}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-1.5">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              aria-label={key === 'back' ? 'Стереть' : key}
              className="grid h-[46px] place-items-center rounded-[var(--r-md)] bg-surface-2 text-[20px] font-semibold transition active:scale-95 active:bg-surface-3"
            >
              {key === 'back' ? <Backspace size={21} weight="bold" /> : key}
            </button>
          ))}
        </div>

        {/* Sticky so the primary action stays reachable on short screens. */}
        <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-surface px-5 pt-1.5 pb-1">
          <Button onClick={save} disabled={!canSave} className="w-full">
            <Check size={19} weight="bold" />
            {editing ? 'Сохранить' : transfer ? 'Перевести' : 'Добавить'}
          </Button>

          {editing &&
            (confirmDelete ? (
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true)
                    try {
                      if (isTransfer(editing)) await deleteTransfer(editing.id)
                      else await deleteTransaction(editing.id)
                      onClose()
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Да, удалить
                </Button>
                <Button variant="soft" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  Отмена
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
                <Trash size={17} weight="bold" />
                {editingTransfer ? 'Удалить перевод' : 'Удалить операцию'}
              </Button>
            ))}
        </div>
      </div>
    </Sheet>
  )
}

function AccountChips({
  label,
  accounts,
  value,
  onPick,
  hint,
}: {
  label: string
  accounts: Account[]
  value: string
  onPick: (id: string) => void
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[12.5px] font-semibold text-dim">{label}</span>
        {hint && <span className="tnum text-[12px] text-faint">{hint}</span>}
      </div>
      <div className="no-bar flex gap-2 overflow-x-auto" role="group" aria-label={label}>
        {accounts.map((account) => {
          const active = account.id === value
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onPick(account.id)}
              aria-pressed={active}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95',
                active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-dim',
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: active ? 'currentColor' : account.color }}
                aria-hidden="true"
              />
              {account.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
