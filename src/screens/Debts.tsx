import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CaretDown, Plus, Trash, X } from '@phosphor-icons/react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../data/store'
import { Sheet } from '../components/Sheet'
import { ShareBar } from '../components/Charts'
import { AccountChips } from '../components/AccountChips'
import {
  Button,
  Card,
  Empty,
  Field,
  Segmented,
  SectionTitle,
  SubScreen,
  cx,
  inputClass,
} from '../components/ui'
import { debtPaid, debtRemaining, debtTotals, knownPeople } from '../lib/debts'
import { dayLabel, money, num, plural, shortDate, todayISO } from '../lib/format'
import type { Debt } from '../lib/types'

interface Row {
  debt: Debt
  paid: number
  left: number
}

export function Debts() {
  const { data } = useApp()
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [showClosed, setShowClosed] = useState(false)

  // A row in Операции links here with ?open=<id>.
  const openId = params.get('open')
  const openDebt = data.debts.find((d) => d.id === openId) ?? null
  const setOpen = (id: string | null) => setParams(id ? { open: id } : {}, { replace: true })

  const totals = debtTotals(data.debts, data.debtPayments)
  const rows = useMemo<Row[]>(
    () =>
      [...data.debts]
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
        .map((debt) => ({
          debt,
          paid: debtPaid(debt, data.debtPayments),
          left: debtRemaining(debt, data.debtPayments),
        })),
    [data.debts, data.debtPayments],
  )
  const lent = rows.filter((r) => r.left > 0 && r.debt.direction === 'lent')
  const borrowed = rows.filter((r) => r.left > 0 && r.debt.direction === 'borrowed')
  const closed = rows.filter((r) => r.left <= 0)

  return (
    <SubScreen
      title="Долги"
      back="/more"
      action={
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Новый долг"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition active:scale-95"
        >
          <Plus size={19} weight="bold" />
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-[12.5px] text-dim">Мне должны</p>
            <p className="tnum mt-1 text-[20px] leading-none font-bold tracking-[-0.02em] text-pos">
              {money(totals.owedToMe)}
            </p>
          </Card>
          <Card>
            <p className="text-[12.5px] text-dim">Я должен</p>
            <p className="tnum mt-1 text-[20px] leading-none font-bold tracking-[-0.02em]">
              {money(totals.iOwe)}
            </p>
          </Card>
        </div>

        {rows.length === 0 ? (
          <Empty
            icon="hands"
            title="Долгов нет"
            hint="Запишите, кому дали в долг или у кого взяли: остаток и возвраты всегда будут под рукой."
            action={<Button onClick={() => setCreating(true)}>Записать долг</Button>}
          />
        ) : (
          <>
            {lent.length > 0 && <DebtGroup title="Мне должны" rows={lent} onOpen={setOpen} />}
            {borrowed.length > 0 && <DebtGroup title="Я должен" rows={borrowed} onOpen={setOpen} />}
            {lent.length === 0 && borrowed.length === 0 && (
              <p className="text-center text-[14px] text-dim">Все долги закрыты.</p>
            )}

            {closed.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowClosed((v) => !v)}
                  aria-expanded={showClosed}
                  className="mb-3 flex w-full items-center justify-between text-[15px] font-semibold"
                >
                  Закрытые · {closed.length}
                  <CaretDown
                    size={15}
                    weight="bold"
                    className={cx('text-faint transition-transform', showClosed && 'rotate-180')}
                  />
                </button>
                {showClosed && (
                  <div className="flex flex-col gap-2 opacity-75">
                    {closed.map((row) => (
                      <DebtCard key={row.debt.id} row={row} onOpen={() => setOpen(row.debt.id)} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <NewDebtSheet open={creating} onClose={() => setCreating(false)} />
      <DebtSheet debt={openDebt} onClose={() => setOpen(null)} />
    </SubScreen>
  )
}

function DebtGroup({
  title,
  rows,
  onOpen,
}: {
  title: string
  rows: Row[]
  onOpen: (id: string) => void
}) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <DebtCard key={row.debt.id} row={row} onOpen={() => onOpen(row.debt.id)} />
        ))}
      </div>
    </section>
  )
}

function DebtCard({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const { debt, paid, left } = row
  const overdue = Boolean(debt.dueAt && left > 0 && debt.dueAt < todayISO())
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <Card className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{debt.person}</span>
          <span
            className={cx(
              'tnum shrink-0 text-[16px] font-bold tracking-[-0.01em]',
              left <= 0 ? 'text-faint' : debt.direction === 'lent' ? 'text-pos' : 'text-ink',
            )}
          >
            {left > 0 ? money(left) : 'закрыт'}
          </span>
        </div>
        {paid > 0 && left > 0 && (
          <ShareBar share={Math.min(1, paid / debt.amount)} color="var(--positive)" />
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-faint">
          <span>
            {paid > 0
              ? `вернули ${money(paid)} из ${money(debt.amount)}`
              : `${money(debt.amount)} с ${shortDate(debt.occurredAt)}`}
          </span>
          {debt.dueAt && left > 0 && (
            <span className={overdue ? 'font-semibold text-neg' : undefined}>
              {overdue ? `срок прошёл ${shortDate(debt.dueAt)}` : `вернуть до ${shortDate(debt.dueAt)}`}
            </span>
          )}
        </div>
      </Card>
    </button>
  )
}

function NewDebtSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addDebt } = useApp()
  const accounts = useMemo(() => data.accounts.filter((a) => !a.archived), [data.accounts])
  const [direction, setDirection] = useState<Debt['direction']>('lent')
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setDirection('lent')
    setPerson('')
    setAmount('')
    setAccountId(accounts[0]?.id ?? '')
    setDate(todayISO())
    setDue('')
    setNote('')
  }, [open, accounts])

  const value = Number(amount.replace(/\D/g, '') || '0')
  const people = knownPeople(data.debts)
  const valid = person.trim().length > 0 && value > 0 && Boolean(accountId)
  const lent = direction === 'lent'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    await addDebt({
      direction,
      person: person.trim(),
      amount: value,
      accountId,
      occurredAt: date,
      dueAt: due || undefined,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Новый долг">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 pb-2">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'lent', label: 'Я дал в долг' },
            { value: 'borrowed', label: 'Я взял в долг' },
          ]}
        />

        <Field label={lent ? 'Кому' : 'У кого'}>
          <input
            type="text"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="Имя"
            className={inputClass}
          />
        </Field>
        {people.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2">
            {people.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setPerson(name)}
                className={cx(
                  'rounded-full px-3 py-1 text-[13px] font-medium transition active:scale-95',
                  person.trim() === name ? 'bg-ink text-bg' : 'bg-surface-2 text-dim',
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <Field label="Сумма">
          <input
            type="text"
            inputMode="numeric"
            value={value ? num(value) : ''}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <AccountChips
          label={lent ? 'С какого счёта' : 'На какой счёт'}
          accounts={accounts}
          value={accountId}
          onPick={setAccountId}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Дата">
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Вернуть до" hint="Необязательно">
            <input
              type="date"
              value={due}
              min={date}
              onChange={(e) => setDue(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Комментарий">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например, на билеты"
            className={inputClass}
          />
        </Field>

        <p className="text-[12.5px] leading-relaxed text-faint">
          {lent
            ? 'Сумма уйдёт со счёта, но в расходы не попадёт: это ваши деньги, их вернут.'
            : 'Сумма придёт на счёт, но в доходы не попадёт: её нужно будет вернуть.'}
        </p>

        <Button type="submit" disabled={!valid}>
          Записать
        </Button>
      </form>
    </Sheet>
  )
}

function DebtSheet({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const { data, addDebtPayment, deleteDebtPayment, deleteDebt } = useApp()
  const accounts = useMemo(() => data.accounts.filter((a) => !a.archived), [data.accounts])
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [confirmDelete, setConfirmDelete] = useState(false)

  const payments = debt
    ? data.debtPayments
        .filter((p) => p.debtId === debt.id)
        .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1))
    : []
  const left = debt ? debtRemaining(debt, data.debtPayments) : 0
  const accountName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? 'Счёт'

  // Reset the form only when another debt opens, not after each repayment.
  useEffect(() => {
    if (!debt) return
    setAmount(left > 0 ? String(left) : '')
    setAccountId(debt.accountId)
    setDate(todayISO())
    setConfirmDelete(false)
  }, [debt?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = Number(amount.replace(/\D/g, '') || '0')
  const lent = debt?.direction === 'lent'

  const repay = async (e: FormEvent) => {
    e.preventDefault()
    if (!debt || value <= 0 || value > left || !accountId) return
    await addDebtPayment({ debtId: debt.id, amount: value, accountId, occurredAt: date })
    setAmount(left - value > 0 ? String(left - value) : '')
  }

  return (
    <Sheet open={debt !== null} onClose={onClose} title={debt?.person}>
      {debt && (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] text-dim">
            {lent ? 'Вы дали в долг' : 'Вы взяли в долг'} {money(debt.amount)}
            {left > 0 ? `, осталось ${money(left)}` : ', долг закрыт'}.
            {debt.note ? ` ${debt.note}.` : ''}
          </p>

          <Card className="flex flex-col gap-2.5 bg-surface-2 p-3.5">
            <HistoryLine
              title={lent ? 'Дали' : 'Взяли'}
              amount={debt.amount}
              meta={`${dayLabel(debt.occurredAt)} · ${accountName(debt.accountId)}`}
            />
            {payments.map((p) => (
              <HistoryLine
                key={p.id}
                title="Вернули"
                amount={p.amount}
                meta={`${dayLabel(p.occurredAt)} · ${accountName(p.accountId)}`}
                onRemove={() => void deleteDebtPayment(p.id)}
              />
            ))}
          </Card>

          {left > 0 && (
            <form onSubmit={(e) => void repay(e)} className="flex flex-col gap-3">
              <SectionTitle>Возврат</SectionTitle>
              <Field
                label="Сколько вернули"
                error={value > left ? `Больше остатка: осталось ${money(left)}` : undefined}
              >
                <input
                  type="text"
                  inputMode="numeric"
                  value={value ? num(value) : ''}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <AccountChips
                label={lent ? 'На какой счёт' : 'С какого счёта'}
                accounts={accounts}
                value={accountId}
                onPick={setAccountId}
              />
              <Field label="Дата">
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Button type="submit" disabled={value <= 0 || value > left}>
                {value >= left ? 'Вернули всё' : 'Вернули часть'}
              </Button>
            </form>
          )}

          {confirmDelete ? (
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await deleteDebt(debt.id)
                  onClose()
                }}
              >
                Да, удалить
              </Button>
              <Button variant="soft" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash size={17} weight="bold" />
              Удалить долг
            </Button>
          )}
          {confirmDelete && payments.length > 0 && (
            <p className="-mt-2 text-center text-[12px] text-neg">
              Вместе с долгом удалятся {payments.length}{' '}
              {plural(payments.length, 'возврат', 'возврата', 'возвратов')}.
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}

function HistoryLine({
  title,
  amount,
  meta,
  onRemove,
}: {
  title: string
  amount: number
  meta: string
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">
          {title} <span className="tnum">{money(amount)}</span>
        </span>
        <span className="block truncate text-[12px] text-faint">{meta}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Удалить возврат ${money(amount)}`}
          className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition active:scale-90"
        >
          <X size={15} weight="bold" />
        </button>
      )}
    </div>
  )
}
