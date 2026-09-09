import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { differenceInCalendarDays, differenceInDays, parseISO } from 'date-fns'
import { useApp } from '../data/store'
import { Sheet } from '../components/Sheet'
import { ProgressRing } from '../components/Charts'
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Screen,
  Skeleton,
  cx,
  inputClass,
} from '../components/ui'
import { ICON_KEYS, SWATCHES, iconOf } from '../lib/icons'
import { goalSaved } from '../lib/analytics'
import { money, num, plural, shortDate } from '../lib/format'
import type { Goal } from '../lib/types'

export function Goals() {
  const { data, ready, saveGoal, deleteGoal, contribute } = useApp()
  const [editing, setEditing] = useState<Goal | null>(null)
  const [creating, setCreating] = useState(false)
  const [topUp, setTopUp] = useState<Goal | null>(null)

  const goals = useMemo(
    () =>
      data.goals.map((goal) => {
        const saved = goalSaved(goal.id, data.contributions)
        const progress = goal.targetAmount > 0 ? saved / goal.targetAmount : 0
        return { goal, saved, progress, remaining: Math.max(0, goal.targetAmount - saved) }
      }),
    [data.goals, data.contributions],
  )

  if (!ready) {
    return (
      <Screen title="Цели">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[104px]" />
          <Skeleton className="h-[104px]" />
        </div>
      </Screen>
    )
  }

  return (
    <Screen
      title="Цели"
      action={
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Новая цель"
          className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink transition active:scale-95"
        >
          <Plus size={19} weight="bold" />
        </button>
      }
    >
      {goals.length === 0 ? (
        <Empty
          icon="target"
          title="Целей пока нет"
          hint="Поставьте цель, откладывайте понемногу и следите за прогрессом."
          action={<Button onClick={() => setCreating(true)}>Создать цель</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map(({ goal, saved, progress, remaining }) => {
            const done = remaining === 0
            const daysLeft = goal.targetDate
              ? differenceInCalendarDays(parseISO(goal.targetDate), new Date())
              : null
            // Pace comes from how long money has actually been going in, and
            // only once there is enough history for the number to mean
            // anything. A goal opened yesterday must not promise a date.
            const first = data.contributions
              .filter((c) => c.goalId === goal.id)
              .reduce<string | null>((min, c) => (!min || c.occurredAt < min ? c.occurredAt : min), null)
            const span = first ? differenceInDays(new Date(), parseISO(first)) : 0
            const perDay = span >= 14 && saved > 0 ? saved / span : 0
            const forecast = perDay > 0 && !done ? Math.ceil(remaining / perDay) : null

            return (
              <Card key={goal.id} className="p-4">
                <button
                  type="button"
                  onClick={() => setTopUp(goal)}
                  className="flex w-full items-center gap-3.5 text-left"
                >
                  <ProgressRing progress={progress} color={goal.color} size={54} thickness={5}>
                    <Badge icon={goal.icon} color={goal.color} size={34} />
                  </ProgressRing>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{goal.name}</span>
                    <span className="tnum block text-[13px] text-dim">
                      {money(saved)} из {money(goal.targetAmount)}
                    </span>
                  </span>
                  <span
                    className="tnum shrink-0 text-[17px] font-bold tracking-[-0.02em]"
                    style={{ color: goal.color }}
                  >
                    {Math.round(progress * 100)}%
                  </span>
                </button>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
                  {done ? (
                    <span className="font-semibold text-pos">Цель достигнута</span>
                  ) : (
                    <span>Осталось {money(remaining)}</span>
                  )}
                  {daysLeft !== null && !done && (
                    <span>
                      {daysLeft >= 0
                        ? `до ${shortDate(goal.targetDate!)}, ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}`
                        : `срок прошёл ${shortDate(goal.targetDate!)}`}
                    </span>
                  )}
                  {forecast !== null && forecast < 3650 && (
                    <span>
                      при текущем темпе ещё {forecast} {plural(forecast, 'день', 'дня', 'дней')}
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <TopUpSheet
        goal={topUp}
        saved={topUp ? goalSaved(topUp.id, data.contributions) : 0}
        onClose={() => setTopUp(null)}
        onContribute={async (amount) => {
          if (topUp) await contribute(topUp.id, amount)
          setTopUp(null)
        }}
        onEdit={() => {
          setEditing(topUp)
          setTopUp(null)
        }}
      />

      <GoalSheet
        open={creating || editing !== null}
        goal={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSave={async (input) => {
          await saveGoal(input)
          setCreating(false)
          setEditing(null)
        }}
        onDelete={
          editing
            ? async () => {
                await deleteGoal(editing.id)
                setEditing(null)
              }
            : undefined
        }
      />
    </Screen>
  )
}

function TopUpSheet({
  goal,
  saved,
  onClose,
  onContribute,
  onEdit,
}: {
  goal: Goal | null
  saved: number
  onClose: () => void
  onContribute: (amount: number) => Promise<void>
  onEdit: () => void
}) {
  const [value, setValue] = useState('')
  const amount = Number(value.replace(/\D/g, '') || '0')
  const remaining = goal ? Math.max(0, goal.targetAmount - saved) : 0
  const quick = [10000, 50000, 100000].filter((q) => q <= Math.max(remaining, 100000))

  return (
    <Sheet open={goal !== null} onClose={onClose} title={goal?.name}>
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-[13.5px] text-dim">
          Накоплено {money(saved)}. Осталось {money(remaining)}.
        </p>

        <Field label="Сумма пополнения">
          <input
            type="text"
            inputMode="numeric"
            value={value ? num(amount) : ''}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <div className="flex gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setValue(String(q))}
              className="flex-1 rounded-[var(--r-md)] bg-surface-2 py-2.5 text-[13px] font-semibold"
            >
              {num(q)} ₸
            </button>
          ))}
        </div>

        <Button
          onClick={async () => {
            await onContribute(amount)
            setValue('')
          }}
          disabled={amount <= 0}
        >
          Пополнить
        </Button>
        <Button variant="ghost" onClick={onEdit}>
          Изменить цель
        </Button>
      </div>
    </Sheet>
  )
}

function GoalSheet({
  open,
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  goal: Goal | null
  onClose: () => void
  onSave: (input: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [color, setColor] = useState(SWATCHES[3])
  const [icon, setIcon] = useState('target')
  const [touched, setTouched] = useState(false)

  // Load the goal being edited each time the sheet opens.
  useEffect(() => {
    if (!open) return
    setName(goal?.name ?? '')
    setTarget(goal ? String(goal.targetAmount) : '')
    setDate(goal?.targetDate ?? '')
    setColor(goal?.color ?? SWATCHES[3])
    setIcon(goal?.icon ?? 'target')
    setTouched(false)
  }, [open, goal])

  const amount = Number(target.replace(/\D/g, '') || '0')
  const nameError = touched && !name.trim() ? 'Введите название' : undefined
  const valid = name.trim().length > 0 && amount > 0

  return (
    <Sheet open={open} onClose={onClose} title={goal ? 'Изменить цель' : 'Новая цель'}>
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Название" error={nameError}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Например, поездка к морю"
            className={inputClass}
          />
        </Field>

        <Field label="Нужная сумма">
          <input
            type="text"
            inputMode="numeric"
            value={target ? num(amount) : ''}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <Field label="Срок" hint="Необязательно">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Цвет">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Цвет ${swatch}`}
                className={cx(
                  'size-8 rounded-full transition active:scale-90',
                  color === swatch && 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]',
                )}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </Field>

        <Field label="Значок">
          <div className="grid grid-cols-8 gap-1.5">
            {ICON_KEYS.map((key) => {
              const Glyph = iconOf(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={key}
                  className={cx(
                    'grid aspect-square place-items-center rounded-[var(--r-sm)] transition active:scale-90',
                    icon === key ? 'bg-surface-3 text-ink' : 'bg-surface-2 text-dim',
                  )}
                >
                  <Glyph size={18} weight={icon === key ? 'fill' : 'regular'} />
                </button>
              )
            })}
          </div>
        </Field>

        <Button
          onClick={() =>
            void onSave({
              id: goal?.id,
              name: name.trim(),
              targetAmount: amount,
              targetDate: date || undefined,
              color,
              icon,
            })
          }
          disabled={!valid}
        >
          Сохранить
        </Button>

        {onDelete && (
          <Button variant="danger" onClick={() => void onDelete()}>
            <Trash size={17} weight="bold" />
            Удалить цель
          </Button>
        )}
      </div>
    </Sheet>
  )
}
