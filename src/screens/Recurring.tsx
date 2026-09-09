import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useApp } from '../data/store'
import { Sheet } from '../components/Sheet'
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Segmented,
  SubScreen,
  cx,
  inputClass,
} from '../components/ui'
import { FREQ_LABEL, ruleSummary } from '../lib/recurring'
import { num, plural, shortDate, todayISO } from '../lib/format'
import type { Freq, RecurringRule, TxKind } from '../lib/types'

export function Recurring() {
  const { data, saveRule, deleteRule, toggleRule } = useApp()
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [creating, setCreating] = useState(false)

  const rules = useMemo(
    () => [...data.recurring].sort((a, b) => (a.nextRunAt < b.nextRunAt ? -1 : 1)),
    [data.recurring],
  )

  return (
    <SubScreen
      title="Регулярные платежи"
      back="/more"
      action={
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Новое правило"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition active:scale-95"
        >
          <Plus size={19} weight="bold" />
        </button>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-dim">
        Операции создаются при открытии приложения, сразу за все пропущенные даты.
      </p>

      {rules.length === 0 ? (
        <Empty
          icon="receipt"
          title="Правил пока нет"
          hint="Добавьте аренду, подписки или зарплату, чтобы они появлялись сами."
          action={<Button onClick={() => setCreating(true)}>Создать правило</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => {
            const category = data.categories.find((c) => c.id === rule.categoryId)
            const days = differenceInCalendarDays(parseISO(rule.nextRunAt), new Date())
            return (
              <Card key={rule.id} className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setEditing(rule)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Badge
                    icon={category?.icon ?? 'receipt'}
                    color={category?.color ?? '#7C8794'}
                    size={40}
                  />
                  {/* Title and amount share the first line; the schedule gets
                      the full width below so it is never clipped. */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={cx(
                          'min-w-0 flex-1 truncate text-[15px] font-medium',
                          !rule.active && 'text-faint line-through',
                        )}
                      >
                        {rule.title}
                      </span>
                      <span
                        className={cx(
                          'tnum shrink-0 text-[15px] font-semibold',
                          rule.kind === 'income' ? 'text-pos' : 'text-ink',
                          !rule.active && 'opacity-45',
                        )}
                      >
                        {rule.kind === 'income' ? '+' : ''}
                        {num(rule.amount)} ₸
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-faint">
                      {ruleSummary(rule)}
                      {rule.active &&
                        ` · ${
                          days <= 0
                            ? 'сегодня'
                            : `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
                        }`}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.active}
                  aria-label={`${rule.title}: ${rule.active ? 'включено' : 'выключено'}`}
                  onClick={() => void toggleRule(rule.id)}
                  className={cx(
                    'relative h-[26px] w-[44px] shrink-0 rounded-full transition',
                    rule.active ? 'bg-accent' : 'bg-surface-3',
                  )}
                >
                  <span
                    className="absolute top-[3px] size-5 rounded-full bg-white transition-all"
                    style={{ left: rule.active ? 21 : 3 }}
                  />
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <RuleSheet
        open={creating || editing !== null}
        rule={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSave={async (input) => {
          await saveRule(input)
          setCreating(false)
          setEditing(null)
        }}
        onDelete={
          editing
            ? async () => {
                await deleteRule(editing.id)
                setEditing(null)
              }
            : undefined
        }
      />
    </SubScreen>
  )
}

function RuleSheet({
  open,
  rule,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  rule: RecurringRule | null
  onClose: () => void
  onSave: (input: Omit<RecurringRule, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { data } = useApp()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TxKind>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [freq, setFreq] = useState<Freq>('month')
  const [interval, setInterval] = useState('1')
  const [nextRunAt, setNextRunAt] = useState(todayISO())

  useEffect(() => {
    if (!open) return
    setTitle(rule?.title ?? '')
    setKind(rule?.kind ?? 'expense')
    setAmount(rule ? String(rule.amount) : '')
    setCategoryId(rule?.categoryId ?? '')
    setAccountId(rule?.accountId ?? data.accounts[0]?.id ?? '')
    setFreq(rule?.freq ?? 'month')
    setInterval(String(rule?.interval ?? 1))
    setNextRunAt(rule?.nextRunAt ?? todayISO())
  }, [open, rule, data.accounts])

  const categories = data.categories.filter((c) => c.kind === kind && !c.archived)
  const value = Number(amount.replace(/\D/g, '') || '0')
  const valid = title.trim().length > 0 && value > 0 && categoryId && accountId

  useEffect(() => {
    if (categoryId && !categories.some((c) => c.id === categoryId)) setCategoryId('')
  }, [categories, categoryId])

  return (
    <Sheet open={open} onClose={onClose} title={rule ? 'Изменить правило' : 'Новое правило'}>
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Название">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, аренда квартиры"
            className={inputClass}
          />
        </Field>

        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' },
          ]}
        />

        <Field label="Сумма">
          <input
            type="text"
            inputMode="numeric"
            value={amount ? num(value) : ''}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <Field label="Категория">
          <div className="grid grid-cols-4 gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={cx(
                  'flex flex-col items-center gap-1.5 rounded-[var(--r-md)] px-1 py-2 transition active:scale-95',
                  category.id === categoryId ? 'bg-surface-2' : '',
                )}
                style={
                  category.id === categoryId
                    ? { boxShadow: `inset 0 0 0 2px ${category.color}` }
                    : undefined
                }
              >
                <Badge icon={category.icon} color={category.color} size={34} />
                <span className="line-clamp-2 text-center text-[10px] leading-tight text-dim">
                  {category.name}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Счёт">
          <div className="flex flex-wrap gap-2">
            {data.accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setAccountId(account.id)}
                className={cx(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95',
                  account.id === accountId ? 'bg-ink text-bg' : 'bg-surface-2 text-dim',
                )}
              >
                {account.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Повтор">
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              aria-label="Интервал повтора"
              className={cx(inputClass, 'w-20 text-center')}
            />
            <div className="flex flex-1 gap-1 rounded-[var(--r-md)] bg-surface-2 p-1">
              {(Object.keys(FREQ_LABEL) as Freq[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFreq(option)}
                  className={cx(
                    'flex-1 rounded-[calc(var(--r-md)-4px)] text-[12.5px] font-semibold transition',
                    freq === option ? 'bg-surface text-ink' : 'text-dim',
                  )}
                >
                  {FREQ_LABEL[option]}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Следующее списание" hint={`${ruleSummary({ freq, interval: Number(interval) || 1 } as RecurringRule)}, начиная с ${shortDate(nextRunAt)}`}>
          <input
            type="date"
            value={nextRunAt}
            onChange={(e) => setNextRunAt(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Button
          onClick={() =>
            void onSave({
              id: rule?.id,
              title: title.trim(),
              kind,
              amount: value,
              categoryId,
              accountId,
              freq,
              interval: Math.max(1, Number(interval) || 1),
              nextRunAt,
              active: rule?.active ?? true,
            })
          }
          disabled={!valid}
        >
          Сохранить
        </Button>

        {onDelete && (
          <Button variant="danger" onClick={() => void onDelete()}>
            <Trash size={17} weight="bold" />
            Удалить правило
          </Button>
        )}

      </div>
    </Sheet>
  )
}
