import type { Repo, RowOf, TableKey } from './repo'
import type {
  Account,
  Category,
  Goal,
  GoalContribution,
  RecurringRule,
  Settings,
  Snapshot,
  Task,
  TaskTemplate,
  Transaction,
} from '../lib/types'
import { requireClient } from './supabase'
import { defaultAccounts, defaultCategories } from '../lib/seed'

/** Logical table name to the physical table in Postgres. */
const TABLE: Record<TableKey, string> = {
  categories: 'categories',
  accounts: 'accounts',
  transactions: 'transactions',
  recurring: 'recurring_rules',
  goals: 'goals',
  contributions: 'goal_contributions',
  tasks: 'tasks',
  taskTemplates: 'task_templates',
}

type Row = Record<string, unknown>

const toDb = {
  categories: (c: Category, user_id: string) => ({
    id: c.id,
    user_id,
    name: c.name,
    kind: c.kind,
    color: c.color,
    icon: c.icon,
    sort_order: c.sort,
    archived: c.archived ?? false,
  }),
  accounts: (a: Account, user_id: string) => ({
    id: a.id,
    user_id,
    name: a.name,
    type: a.type,
    initial_balance: a.initialBalance,
    color: a.color,
    archived: a.archived ?? false,
  }),
  transactions: (t: Transaction, user_id: string) => ({
    id: t.id,
    user_id,
    kind: t.kind,
    amount: t.amount,
    category_id: t.categoryId,
    account_id: t.accountId,
    occurred_at: t.occurredAt,
    note: t.note ?? null,
    recurring_id: t.recurringId ?? null,
    created_at: t.createdAt,
  }),
  recurring: (r: RecurringRule, user_id: string) => ({
    id: r.id,
    user_id,
    title: r.title,
    kind: r.kind,
    amount: r.amount,
    category_id: r.categoryId,
    account_id: r.accountId,
    freq: r.freq,
    interval_n: r.interval,
    next_run_at: r.nextRunAt,
    ends_at: r.endsAt ?? null,
    active: r.active,
    created_at: r.createdAt,
  }),
  goals: (g: Goal, user_id: string) => ({
    id: g.id,
    user_id,
    name: g.name,
    target_amount: g.targetAmount,
    target_date: g.targetDate ?? null,
    color: g.color,
    icon: g.icon,
    created_at: g.createdAt,
  }),
  contributions: (c: GoalContribution, user_id: string) => ({
    id: c.id,
    user_id,
    goal_id: c.goalId,
    amount: c.amount,
    occurred_at: c.occurredAt,
    created_at: c.createdAt,
  }),
  tasks: (t: Task, user_id: string) => ({
    id: t.id,
    user_id,
    title: t.title,
    day: t.day,
    done: t.done,
    template_id: t.templateId ?? null,
    created_at: t.createdAt,
  }),
  taskTemplates: (t: TaskTemplate, user_id: string) => ({
    id: t.id,
    user_id,
    title: t.title,
    weekdays: t.weekdays,
    next_day: t.nextDay,
    created_at: t.createdAt,
  }),
}

const fromDb = {
  categories: (r: Row): Category => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as Category['kind'],
    color: r.color as string,
    icon: r.icon as string,
    sort: (r.sort_order as number) ?? 0,
    archived: (r.archived as boolean) ?? false,
  }),
  accounts: (r: Row): Account => ({
    id: r.id as string,
    name: r.name as string,
    type: r.type as Account['type'],
    initialBalance: Number(r.initial_balance ?? 0),
    color: r.color as string,
    archived: (r.archived as boolean) ?? false,
  }),
  transactions: (r: Row): Transaction => ({
    id: r.id as string,
    kind: r.kind as Transaction['kind'],
    amount: Number(r.amount ?? 0),
    categoryId: r.category_id as string,
    accountId: r.account_id as string,
    occurredAt: r.occurred_at as string,
    note: (r.note as string) ?? undefined,
    recurringId: (r.recurring_id as string) ?? undefined,
    createdAt: r.created_at as string,
  }),
  recurring: (r: Row): RecurringRule => ({
    id: r.id as string,
    title: r.title as string,
    kind: r.kind as RecurringRule['kind'],
    amount: Number(r.amount ?? 0),
    categoryId: r.category_id as string,
    accountId: r.account_id as string,
    freq: r.freq as RecurringRule['freq'],
    interval: Number(r.interval_n ?? 1),
    nextRunAt: r.next_run_at as string,
    endsAt: (r.ends_at as string) ?? undefined,
    active: (r.active as boolean) ?? true,
    createdAt: r.created_at as string,
  }),
  goals: (r: Row): Goal => ({
    id: r.id as string,
    name: r.name as string,
    targetAmount: Number(r.target_amount ?? 0),
    targetDate: (r.target_date as string) ?? undefined,
    color: r.color as string,
    icon: r.icon as string,
    createdAt: r.created_at as string,
  }),
  contributions: (r: Row): GoalContribution => ({
    id: r.id as string,
    goalId: r.goal_id as string,
    amount: Number(r.amount ?? 0),
    occurredAt: r.occurred_at as string,
    createdAt: r.created_at as string,
  }),
  tasks: (r: Row): Task => ({
    id: r.id as string,
    title: r.title as string,
    day: r.day as string,
    done: Boolean(r.done),
    templateId: (r.template_id as string) ?? undefined,
    createdAt: r.created_at as string,
  }),
  taskTemplates: (r: Row): TaskTemplate => ({
    id: r.id as string,
    title: r.title as string,
    weekdays: ((r.weekdays as number[]) ?? []).map(Number),
    nextDay: r.next_day as string,
    createdAt: r.created_at as string,
  }),
}

/**
 * Task tables came after the first schema. Until schema.sql is re-run they do
 * not exist, and the finance screens must keep working in the meantime.
 */
function optionalRows(result: { data: Row[] | null; error: { code?: string; message: string } | null }): Row[] {
  if (!result.error) return result.data ?? []
  if (result.error.code === '42P01' || result.error.code === 'PGRST205') return []
  throw new Error(result.error.message)
}

export class SupabaseRepo implements Repo {
  readonly kind = 'cloud' as const
  private readonly userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  async load(): Promise<Snapshot> {
    const db = requireClient()
    const [cats, accs, txs, recs, goals, contribs, settings, tasks, templates] = await Promise.all([
      db.from('categories').select('*').order('sort_order'),
      db.from('accounts').select('*').order('name'),
      db.from('transactions').select('*').order('occurred_at', { ascending: false }),
      db.from('recurring_rules').select('*').order('next_run_at'),
      db.from('goals').select('*').order('created_at'),
      db.from('goal_contributions').select('*').order('occurred_at'),
      db.from('app_settings').select('*').eq('user_id', this.userId).maybeSingle(),
      // Newest first: if the row cap ever bites, it is old history that drops.
      db.from('tasks').select('*').order('day', { ascending: false }),
      db.from('task_templates').select('*').order('created_at'),
    ])

    const failure = [cats, accs, txs, recs, goals, contribs].find((r) => r.error)
    if (failure?.error) throw new Error(failure.error.message)

    const snapshot: Snapshot = {
      categories: (cats.data ?? []).map(fromDb.categories),
      accounts: (accs.data ?? []).map(fromDb.accounts),
      transactions: (txs.data ?? []).map(fromDb.transactions),
      recurring: (recs.data ?? []).map(fromDb.recurring),
      goals: (goals.data ?? []).map(fromDb.goals),
      contributions: (contribs.data ?? []).map(fromDb.contributions),
      tasks: optionalRows(tasks).map(fromDb.tasks),
      taskTemplates: optionalRows(templates).map(fromDb.taskTemplates),
      settings: {
        theme: (settings.data?.theme as Settings['theme']) ?? 'system',
        monthStartDay: (settings.data?.month_start_day as number) ?? 1,
        demo: false,
      },
    }

    // A brand new account has no rows at all. Give it something to spend from.
    if (snapshot.categories.length === 0) {
      snapshot.categories = defaultCategories()
      snapshot.accounts = defaultAccounts()
      await this.putMany('categories', snapshot.categories)
      await this.putMany('accounts', snapshot.accounts)
    }

    return snapshot
  }

  async put<K extends TableKey>(table: K, row: RowOf<K>): Promise<void> {
    await this.putMany(table, [row])
  }

  async putMany<K extends TableKey>(table: K, rows: RowOf<K>[]): Promise<void> {
    if (rows.length === 0) return
    const map = toDb[table] as (row: RowOf<K>, userId: string) => Row
    const payload = rows.map((row) => map(row, this.userId))
    const { error } = await requireClient().from(TABLE[table]).upsert(payload)
    if (error) throw new Error(error.message)
  }

  async remove(table: TableKey, id: string): Promise<void> {
    const { error } = await requireClient().from(TABLE[table]).delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async saveSettings(settings: Settings): Promise<void> {
    const { error } = await requireClient().from('app_settings').upsert({
      user_id: this.userId,
      theme: settings.theme,
      month_start_day: settings.monthStartDay,
    })
    if (error) throw new Error(error.message)
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    await Promise.all([
      this.putMany('categories', snapshot.categories),
      this.putMany('accounts', snapshot.accounts),
    ])
    await Promise.all([
      this.putMany('transactions', snapshot.transactions),
      this.putMany('recurring', snapshot.recurring),
      this.putMany('goals', snapshot.goals),
    ])
    await this.putMany('contributions', snapshot.contributions)
    await this.putMany('taskTemplates', snapshot.taskTemplates)
    await this.putMany('tasks', snapshot.tasks)
    await this.saveSettings(snapshot.settings)
  }

  async clearRecords(): Promise<void> {
    const db = requireClient()
    for (const table of ['goal_contributions', 'goals', 'transactions', 'recurring_rules']) {
      const { error } = await db.from(table).delete().eq('user_id', this.userId)
      if (error) throw new Error(error.message)
    }
  }
}
