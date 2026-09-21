import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowsClockwise, CaretLeft, CaretRight, Check, Trash } from '@phosphor-icons/react'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useApp } from '../data/store'
import { Sheet } from '../components/Sheet'
import { Heatmap, ProgressRing } from '../components/Charts'
import {
  Button,
  Card,
  Empty,
  Field,
  Screen,
  SectionTitle,
  Segmented,
  Skeleton,
  cx,
  inputClass,
} from '../components/ui'
import {
  ALL_WEEKDAYS,
  WEEK,
  heatLevel,
  heatmapWeeks,
  statsByDay,
  streak,
  weekCompletion,
  weekdaysLabel,
  type DayStat,
} from '../lib/tasks'
import { fullDayLabel, plural, shortDate, todayISO, weekdayShort } from '../lib/format'
import type { Task, TaskTemplate } from '../lib/types'

/** Weeks in the activity grid: about five months, and it fits a phone without scrolling. */
const HEATMAP_WEEKS = 20

const iso = (d: Date) => format(d, 'yyyy-MM-dd')
const percent = (stat?: DayStat) =>
  stat && stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0

export function Tasks({
  adding,
  onAddingChange,
}: {
  adding: boolean
  onAddingChange: (open: boolean) => void
}) {
  const { data, ready, toggleTask, syncTasks } = useApp()
  // null follows the clock, so "today" rolls over by itself after midnight.
  const [selected, setSelected] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null)
  const [, setWake] = useState(0)

  const today = todayISO()
  const day = selected ?? today
  const isToday = day === today

  // Coming back to the app on a new day re-renders, which moves `today` and
  // lets the effect below spawn that day's standing tasks.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible') setWake((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])

  useEffect(() => {
    if (ready) syncTasks().catch(() => {})
    // syncTasks changes with every edit; only a new day or the first load matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, today])

  const stats = useMemo(() => statsByDay(data.tasks), [data.tasks])
  const weeks = useMemo(() => heatmapWeeks(parseISO(today), HEATMAP_WEEKS), [today])
  const templates = useMemo(
    () => new Map(data.taskTemplates.map((t) => [t.id, t])),
    [data.taskTemplates],
  )
  const dayTasks = useMemo(
    () =>
      data.tasks
        .filter((t) => t.day === day)
        .sort((a, b) => (a.createdAt === b.createdAt ? a.title.localeCompare(b.title) : a.createdAt < b.createdAt ? -1 : 1)),
    [data.tasks, day],
  )

  const dayStat = stats.get(day)
  const week = weekCompletion(stats, parseISO(today))
  const run = streak(stats, parseISO(today))
  const openTask = data.tasks.find((t) => t.id === openTaskId) ?? null
  const openTemplate = data.taskTemplates.find((t) => t.id === openTemplateId) ?? null

  const statLine = (d: string) => {
    const stat = stats.get(d)
    return stat ? `${stat.done} из ${stat.total}` : 'задач нет'
  }

  if (!ready) {
    return (
      <Screen title="Задачи">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[96px]" />
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[220px]" />
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="Задачи">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <Card className="flex items-center gap-3.5">
            <ProgressRing
              progress={dayStat ? dayStat.done / dayStat.total : 0}
              color="var(--positive)"
              size={64}
              thickness={6}
            >
              <span className="tnum text-[15px] font-bold tracking-[-0.02em]">
                {percent(dayStat)}%
              </span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] leading-snug font-semibold text-balance">{fullDayLabel(day)}</p>
              <p className="mt-0.5 text-[13px] text-dim">
                {dayStat ? `${dayStat.done} из ${dayStat.total} выполнено` : 'Задач нет'}
              </p>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink"
                >
                  Сегодня
                </button>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setSelected(iso(subDays(parseISO(day), 1)))}
                aria-label="Предыдущий день"
                className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink transition active:scale-95"
              >
                <CaretLeft size={17} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = iso(addDays(parseISO(day), 1))
                  setSelected(next >= today ? null : next)
                }}
                disabled={isToday}
                aria-label="Следующий день"
                className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink transition active:scale-95 disabled:text-faint disabled:active:scale-100"
              >
                <CaretRight size={17} weight="bold" />
              </button>
            </div>
          </Card>

          {dayTasks.length === 0 ? (
            isToday ? (
              <Empty
                icon="spark"
                title="На сегодня задач нет"
                hint="Добавьте первую, например «Отжаться 20 раз». Постоянные задачи будут появляться сами."
                action={<Button onClick={() => onAddingChange(true)}>Добавить задачу</Button>}
              />
            ) : (
              <Card className="py-6 text-center text-[14px] text-dim">
                В этот день задач не было
              </Card>
            )
          ) : (
            <Card className="px-4 py-1">
              <ul className="divide-y divide-line">
                {dayTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    template={task.templateId ? templates.get(task.templateId) : undefined}
                    onToggle={() => void toggleTask(task.id)}
                    onOpen={() => setOpenTaskId(task.id)}
                  />
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <SectionTitle>Активность</SectionTitle>
          <Card>
            <Heatmap
              weeks={weeks}
              levelOf={(d) => heatLevel(stats.get(d))}
              labelOf={(d) => `${fullDayLabel(d)}: ${statLine(d)}`}
              activeDay={day}
              onSelect={(d) => setSelected(d === today ? null : d)}
              caption={
                <>
                  <span className="font-semibold text-dim">
                    {capitalize(weekdayShort(parseISO(day)))}, {shortDate(day)}
                  </span>
                  {' · '}
                  {statLine(day)}
                  {dayStat ? ` · ${percent(dayStat)}%` : ''}
                </>
              }
            />
          </Card>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Card>
              <p className="text-[12.5px] text-dim">За 7 дней</p>
              <p className="tnum mt-1 text-[22px] leading-none font-bold tracking-[-0.02em]">
                {week.total > 0 ? `${percent(week)}%` : '—'}
              </p>
              <p className="mt-1.5 text-[12px] text-faint">
                {week.total > 0
                  ? `${week.done} из ${week.total} ${plural(week.total, 'задачи', 'задач', 'задач')}`
                  : 'пока нет задач'}
              </p>
            </Card>
            <Card>
              <p className="text-[12.5px] text-dim">Серия</p>
              <p className="tnum mt-1 text-[22px] leading-none font-bold tracking-[-0.02em]">
                {run} {plural(run, 'день', 'дня', 'дней')}
              </p>
              <p className="mt-1.5 text-[12px] text-faint">всё выполнено подряд</p>
            </Card>
          </div>
        </section>

        <section>
          <SectionTitle>Постоянные задачи</SectionTitle>
          {data.taskTemplates.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-dim">
              При добавлении задачи выберите «Постоянная» и дни недели: она будет появляться сама.
            </p>
          ) : (
            <Card className="px-4 py-1">
              <ul className="divide-y divide-line">
                {data.taskTemplates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => setOpenTemplateId(template.id)}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <ArrowsClockwise size={17} className="shrink-0 text-faint" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                        {template.title}
                      </span>
                      <span className="shrink-0 text-[12.5px] text-faint">
                        {weekdaysLabel(template.weekdays)}
                      </span>
                      <CaretRight size={14} className="shrink-0 text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      <NewTaskSheet
        open={adding}
        onClose={() => onAddingChange(false)}
        onAdded={() => {
          setSelected(null)
          onAddingChange(false)
        }}
      />

      <TaskSheet
        task={openTask}
        template={openTask?.templateId ? templates.get(openTask.templateId) : undefined}
        onClose={() => setOpenTaskId(null)}
        onEditTemplate={(id) => {
          setOpenTaskId(null)
          setOpenTemplateId(id)
        }}
      />

      <TemplateSheet template={openTemplate} onClose={() => setOpenTemplateId(null)} />
    </Screen>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function TaskRow({
  task,
  template,
  onToggle,
  onOpen,
}: {
  task: Task
  template?: TaskTemplate
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.title}
        onClick={onToggle}
        className={cx(
          'grid size-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90',
          task.done ? 'border-pos bg-pos text-bg' : 'border-line-strong text-transparent',
        )}
      >
        <Check size={15} weight="bold" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-0.5 text-left">
        <span
          className={cx(
            'block truncate text-[15px] font-medium transition',
            task.done && 'text-faint line-through',
          )}
        >
          {task.title}
        </span>
        {template && (
          <span className="mt-0.5 block truncate text-[12px] text-faint">
            {weekdaysLabel(template.weekdays)}
          </span>
        )}
      </button>
    </li>
  )
}

function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (next: number[]) => void
}) {
  return (
    <div className="flex gap-1.5">
      {WEEK.map(({ value: weekday, short }) => {
        const on = value.includes(weekday)
        return (
          <button
            key={weekday}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== weekday) : [...value, weekday])}
            className={cx(
              'h-10 min-w-0 flex-1 rounded-full text-[13px] font-semibold transition active:scale-95',
              on ? 'bg-ink text-bg' : 'bg-surface-2 text-dim',
            )}
          >
            {short}
          </button>
        )
      })}
    </div>
  )
}

function NewTaskSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const { addTask, saveTemplate } = useApp()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'once' | 'standing'>('once')
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS)

  useEffect(() => {
    if (!open) return
    setTitle('')
    setKind('once')
    setWeekdays(ALL_WEEKDAYS)
  }, [open])

  const valid = title.trim().length > 0 && (kind === 'once' || weekdays.length > 0)
  const todayIncluded = weekdays.includes(new Date().getDay())

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (kind === 'once') await addTask(title.trim())
    else await saveTemplate({ title: title.trim(), weekdays })
    onAdded()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Новая задача">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 pb-2">
        <Field label="Что сделать">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например, отжаться 20 раз"
            autoFocus
            className={inputClass}
          />
        </Field>

        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'once', label: 'Разовая' },
            { value: 'standing', label: 'Постоянная' },
          ]}
        />

        {kind === 'standing' ? (
          <Field
            label="Дни недели"
            hint={
              weekdays.length === 0
                ? 'Выберите хотя бы один день'
                : `${weekdaysLabel(weekdays)}${todayIncluded ? ', начиная с сегодня' : ''}`
            }
          >
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          </Field>
        ) : (
          <p className="text-[12.5px] text-faint">Задача появится в списке на сегодня.</p>
        )}

        <Button type="submit" disabled={!valid}>
          Добавить
        </Button>
      </form>
    </Sheet>
  )
}

function TaskSheet({
  task,
  template,
  onClose,
  onEditTemplate,
}: {
  task: Task | null
  template?: TaskTemplate
  onClose: () => void
  onEditTemplate: (id: string) => void
}) {
  const { renameTask, deleteTask } = useApp()
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (task) setTitle(task.title)
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const trimmed = title.trim()
  const changed = task !== null && trimmed.length > 0 && trimmed !== task.title

  return (
    <Sheet open={task !== null} onClose={onClose} title="Задача">
      {task && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!changed) return
            await renameTask(task.id, trimmed)
            onClose()
          }}
          className="flex flex-col gap-4 pb-2"
        >
          <Field label="Название">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-col gap-1 text-[13px] text-dim">
            <p>Создана: {format(parseISO(task.createdAt), 'EEEE, d MMMM, HH:mm', { locale: ru })}</p>
            {task.templateId && (
              <p>
                Постоянная
                {template ? ` · ${weekdaysLabel(template.weekdays)}` : ' (правило удалено)'}
              </p>
            )}
          </div>

          <Button type="submit" disabled={!changed}>
            Сохранить
          </Button>

          {template && (
            <Button type="button" variant="soft" onClick={() => onEditTemplate(template.id)}>
              <ArrowsClockwise size={17} weight="bold" />
              Изменить постоянную задачу
            </Button>
          )}

          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              await deleteTask(task.id)
              onClose()
            }}
          >
            <Trash size={17} weight="bold" />
            {task.templateId ? 'Удалить на этот день' : 'Удалить задачу'}
          </Button>
        </form>
      )}
    </Sheet>
  )
}

function TemplateSheet({
  template,
  onClose,
}: {
  template: TaskTemplate | null
  onClose: () => void
}) {
  const { saveTemplate, deleteTemplate } = useApp()
  const [title, setTitle] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS)

  useEffect(() => {
    if (!template) return
    setTitle(template.title)
    setWeekdays(template.weekdays)
  }, [template?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const valid = title.trim().length > 0 && weekdays.length > 0

  return (
    <Sheet open={template !== null} onClose={onClose} title="Постоянная задача">
      {template && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!valid) return
            await saveTemplate({ id: template.id, title: title.trim(), weekdays })
            onClose()
          }}
          className="flex flex-col gap-4 pb-2"
        >
          <Field label="Название">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Дни недели"
            hint={weekdays.length === 0 ? 'Выберите хотя бы один день' : weekdaysLabel(weekdays)}
          >
            <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          </Field>

          <p className="text-[12.5px] text-faint">
            Изменения действуют с сегодняшнего дня, прошлые дни остаются как были.
          </p>

          <Button type="submit" disabled={!valid}>
            Сохранить
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              await deleteTemplate(template.id)
              onClose()
            }}
          >
            <Trash size={17} weight="bold" />
            Удалить постоянную задачу
          </Button>
        </form>
      )}
    </Sheet>
  )
}
