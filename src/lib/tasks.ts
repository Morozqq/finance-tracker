import { addDays, addWeeks, format, parseISO, startOfWeek, subDays } from 'date-fns'
import type { Task, TaskTemplate } from './types'

const day = (d: Date) => format(d, 'yyyy-MM-dd')

/** Monday-first week, the way a Russian calendar reads. Values are Date.getDay(). */
export const WEEK: Array<{ value: number; short: string }> = [
  { value: 1, short: 'Пн' },
  { value: 2, short: 'Вт' },
  { value: 3, short: 'Ср' },
  { value: 4, short: 'Чт' },
  { value: 5, short: 'Пт' },
  { value: 6, short: 'Сб' },
  { value: 0, short: 'Вс' },
]

export const ALL_WEEKDAYS = WEEK.map((w) => w.value)

/** "Каждый день" / "Будни" / "Выходные" / "Пн, Ср, Пт" */
export function weekdaysLabel(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Каждый день'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Будни'
  if (set.size === 2 && set.has(6) && set.has(0)) return 'Выходные'
  return WEEK.filter((w) => set.has(w.value))
    .map((w) => w.short)
    .join(', ')
}

/** Id of a spawned task. Deterministic, so a second run or a second device
 *  upserts the same row instead of adding a duplicate. */
export function spawnedId(templateId: string, iso: string): string {
  return `tk-${templateId}-${iso}`
}

export interface SpawnResult {
  tasks: Task[]
  /** Only the templates whose cursor moved. */
  templates: TaskTemplate[]
}

// A template left alone for months must not flood the list; older gaps stay empty.
const MAX_BACKFILL_DAYS = 60

/**
 * Puts every template's task on each matching day since its cursor, then moves
 * the cursor to tomorrow. Runs when the app opens, the same trade as recurring
 * payments: missed days are filled in on the next visit, not at midnight.
 */
export function spawnTasks(
  templates: TaskTemplate[],
  existing: Task[],
  today = new Date(),
): SpawnResult {
  const todayIso = day(today)
  const earliest = day(subDays(today, MAX_BACKFILL_DAYS - 1))
  const tomorrow = day(addDays(today, 1))
  const have = new Set(existing.map((t) => t.id))
  const stamp = new Date().toISOString()
  const tasks: Task[] = []
  const moved: TaskTemplate[] = []

  for (const template of templates) {
    if (template.nextDay > todayIso) continue
    let cursor = template.nextDay < earliest ? earliest : template.nextDay
    while (cursor <= todayIso) {
      const id = spawnedId(template.id, cursor)
      if (template.weekdays.includes(parseISO(cursor).getDay()) && !have.has(id)) {
        tasks.push({
          id,
          title: template.title,
          day: cursor,
          done: false,
          templateId: template.id,
          createdAt: stamp,
        })
        have.add(id)
      }
      cursor = day(addDays(parseISO(cursor), 1))
    }
    moved.push({ ...template, nextDay: tomorrow })
  }

  return { tasks, templates: moved }
}

export interface DayStat {
  done: number
  total: number
}

export function statsByDay(tasks: Task[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>()
  for (const task of tasks) {
    const stat = map.get(task.day) ?? { done: 0, total: 0 }
    stat.total += 1
    if (task.done) stat.done += 1
    map.set(task.day, stat)
  }
  return map
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4

/** Only a fully finished day earns the brightest green. */
export function heatLevel(stat?: DayStat): HeatLevel {
  if (!stat || stat.total === 0 || stat.done === 0) return 0
  if (stat.done >= stat.total) return 4
  const share = stat.done / stat.total
  return share < 1 / 3 ? 1 : share < 2 / 3 ? 2 : 3
}

/**
 * Days in a row with everything done. Days without tasks neither extend nor
 * break the run, and today does not break it while it is still in progress.
 */
export function streak(stats: Map<string, DayStat>, today = new Date()): number {
  let count = 0
  for (let i = 0; i < 400; i++) {
    const stat = stats.get(day(subDays(today, i)))
    if (!stat || stat.total === 0) continue
    if (stat.done >= stat.total) count += 1
    else if (i === 0) continue
    else break
  }
  return count
}

/** Done versus planned over the last seven days, today included. */
export function weekCompletion(stats: Map<string, DayStat>, today = new Date()): DayStat {
  const sum = { done: 0, total: 0 }
  for (let i = 0; i < 7; i++) {
    const stat = stats.get(day(subDays(today, i)))
    if (!stat) continue
    sum.done += stat.done
    sum.total += stat.total
  }
  return sum
}

/**
 * Columns of Monday-first weeks ending with the current one. Days after today
 * are null, so the last column stops where the calendar does.
 */
export function heatmapWeeks(today = new Date(), count = 20): Array<Array<string | null>> {
  const todayIso = day(today)
  const first = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), -(count - 1))
  return Array.from({ length: count }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const iso = day(addDays(first, w * 7 + d))
      return iso > todayIso ? null : iso
    }),
  )
}
