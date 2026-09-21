import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type {
  Account,
  Category,
  Debt,
  DebtPayment,
  Goal,
  GoalContribution,
  RecurringRule,
  Settings,
  Snapshot,
  Task,
  TaskTemplate,
  Transaction,
  Transfer,
} from '../lib/types'
import type { Repo } from './repo'
import { LocalRepo } from './localRepo'
import { SupabaseRepo } from './supabaseRepo'
import { hasCloud, supabase } from './supabase'
import { emptySnapshot } from '../lib/seed'
import { catchUp } from '../lib/recurring'
import { spawnTasks } from '../lib/tasks'
import { accrueInterest } from '../lib/interest'
import { todayISO, uid } from '../lib/format'

/** Swaps rows that share an id and appends the rest. */
function replaceRows<T extends { id: string }>(list: T[], rows: T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const kept = list.map((item) => byId.get(item.id) ?? item)
  const known = new Set(list.map((item) => item.id))
  return [...kept, ...rows.filter((row) => !known.has(row.id))]
}

interface AppValue {
  ready: boolean
  error: string | null
  mode: 'local' | 'cloud'
  needsAuth: boolean
  email: string | null
  data: Snapshot
  postedCount: number
  dismissPosted: () => void

  addTransaction: (input: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>
  updateTransaction: (tx: Transaction) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>

  addTransfer: (input: Omit<Transfer, 'id' | 'createdAt'>) => Promise<void>
  updateTransfer: (transfer: Transfer) => Promise<void>
  deleteTransfer: (id: string) => Promise<void>

  addDebt: (input: Omit<Debt, 'id' | 'createdAt'>) => Promise<void>
  deleteDebt: (id: string) => Promise<void>
  addDebtPayment: (input: Omit<DebtPayment, 'id' | 'createdAt'>) => Promise<void>
  deleteDebtPayment: (id: string) => Promise<void>

  saveCategory: (input: Omit<Category, 'id'> & { id?: string }) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  /** Takes the ids of one kind in their new order. */
  reorderCategories: (ids: string[]) => Promise<void>

  saveAccount: (input: Omit<Account, 'id' | 'sort'> & { id?: string }) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  reorderAccounts: (ids: string[]) => Promise<void>

  saveRule: (input: Omit<RecurringRule, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  toggleRule: (id: string) => Promise<void>

  saveGoal: (input: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  contribute: (goalId: string, amount: number) => Promise<void>

  addTask: (title: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  renameTask: (id: string, title: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  saveTemplate: (input: { id?: string; title: string; weekdays: number[] }) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  /** Spawns standing tasks for days that arrived while the app stayed open. */
  syncTasks: () => Promise<void>

  setTheme: (theme: Settings['theme']) => Promise<void>
  clearDemo: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AppValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(!hasCloud)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Snapshot>(() => emptySnapshot())
  const [postedCount, setPostedCount] = useState(0)
  const repoRef = useRef<Repo | null>(null)
  const loadedKey = useRef<string | null>(null)

  // Session first. Without cloud credentials this resolves immediately.
  useEffect(() => {
    if (!hasCloud || !supabase) return
    let alive = true
    supabase.auth.getSession().then(({ data: got }) => {
      if (!alive) return
      setSession(got.session)
      setAuthChecked(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setAuthChecked(true)
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const needsAuth = hasCloud && authChecked && !session

  // Load once the repo target is known.
  useEffect(() => {
    if (!authChecked || needsAuth) return

    // StrictMode mounts effects twice in development. The key guard makes the
    // load run once; there is deliberately no "cancelled" flag, because
    // cancelling the first run while the second one bails out would leave the
    // app stuck on its skeleton forever.
    const key = session?.user.id ?? 'local'
    if (loadedKey.current === key) return
    loadedKey.current = key

    const repo: Repo = hasCloud && session ? new SupabaseRepo(session.user.id) : new LocalRepo()
    repoRef.current = repo
    setReady(false)

    repo
      .load()
      .then(async (loaded) => {
        let next: Snapshot = loaded

        // Post everything the recurring rules owe since the last visit.
        const run = catchUp(loaded.recurring)
        if (run.posted > 0) {
          next = {
            ...next,
            transactions: [...run.transactions, ...next.transactions],
            recurring: run.rules,
          }
          await repo.putMany('transactions', run.transactions)
          await repo.putMany('recurring', run.rules)
          setPostedCount(run.posted)
        }

        // Deposits are paid their interest for every finished month, after the
        // recurring rules so a salary posted today already counts.
        const interest = accrueInterest(next.accounts, next, next.categories)
        if (interest.accounts.length > 0) {
          next = {
            ...next,
            transactions: [...interest.transactions, ...next.transactions],
            accounts: replaceRows(next.accounts, interest.accounts),
          }
          await repo.putMany('transactions', interest.transactions)
          await repo.putMany('accounts', interest.accounts)
        }

        // Standing tasks land on every day they were due, the same way. Done
        // before the first paint so the task list never flashes empty.
        const spawned = spawnTasks(next.taskTemplates, next.tasks)
        if (spawned.templates.length > 0) {
          next = {
            ...next,
            tasks: [...spawned.tasks, ...next.tasks],
            taskTemplates: replaceRows(next.taskTemplates, spawned.templates),
          }
          await repo.putMany('taskTemplates', spawned.templates)
          await repo.putMany('tasks', spawned.tasks)
        }

        setData(next)
        setReady(true)
      })
      .catch((e: unknown) => {
        loadedKey.current = null
        setError(e instanceof Error ? e.message : 'Не удалось загрузить данные')
        setReady(true)
      })
  }, [authChecked, needsAuth, session])

  // Theme follows the stored preference; "system" removes the stamp entirely.
  useEffect(() => {
    const root = document.documentElement
    if (data.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', data.settings.theme)
  }, [data.settings.theme])

  const repo = () => {
    const r = repoRef.current
    if (!r) throw new Error('Хранилище недоступно')
    return r
  }

  /** Applies the change locally first, then persists. */
  const commit = useCallback(
    async (next: Snapshot, write: (repo: Repo) => Promise<void>) => {
      const previous = data
      setData(next)
      try {
        await write(repo())
      } catch (e) {
        setData(previous)
        setError(e instanceof Error ? e.message : 'Не удалось сохранить')
        throw e
      }
    },
    [data],
  )

  const value = useMemo<AppValue>(() => {
    const stamp = () => new Date().toISOString()

    return {
      ready,
      error,
      mode: hasCloud ? 'cloud' : 'local',
      needsAuth,
      email: session?.user.email ?? null,
      data,
      postedCount,
      dismissPosted: () => setPostedCount(0),

      async addTransaction(input) {
        const tx: Transaction = { ...input, id: 't-' + uid(), createdAt: stamp() }
        await commit({ ...data, transactions: [tx, ...data.transactions] }, (r) =>
          r.put('transactions', tx),
        )
      },
      async updateTransaction(tx) {
        await commit(
          { ...data, transactions: data.transactions.map((t) => (t.id === tx.id ? tx : t)) },
          (r) => r.put('transactions', tx),
        )
      },
      async deleteTransaction(id) {
        await commit({ ...data, transactions: data.transactions.filter((t) => t.id !== id) }, (r) =>
          r.remove('transactions', id),
        )
      },

      async addDebt(input) {
        const row: Debt = { ...input, id: 'd-' + uid(), createdAt: stamp() }
        await commit({ ...data, debts: [row, ...data.debts] }, (r) => r.put('debts', row))
      },
      async deleteDebt(id) {
        const payments = data.debtPayments.filter((p) => p.debtId === id)
        await commit(
          {
            ...data,
            debts: data.debts.filter((d) => d.id !== id),
            debtPayments: data.debtPayments.filter((p) => p.debtId !== id),
          },
          async (r) => {
            for (const p of payments) await r.remove('debtPayments', p.id)
            await r.remove('debts', id)
          },
        )
      },
      async addDebtPayment(input) {
        const row: DebtPayment = { ...input, id: 'dp-' + uid(), createdAt: stamp() }
        await commit({ ...data, debtPayments: [...data.debtPayments, row] }, (r) =>
          r.put('debtPayments', row),
        )
      },
      async deleteDebtPayment(id) {
        await commit(
          { ...data, debtPayments: data.debtPayments.filter((p) => p.id !== id) },
          (r) => r.remove('debtPayments', id),
        )
      },

      async addTransfer(input) {
        const row: Transfer = { ...input, id: 'tr-' + uid(), createdAt: stamp() }
        await commit({ ...data, transfers: [row, ...data.transfers] }, (r) => r.put('transfers', row))
      },
      async updateTransfer(row) {
        await commit({ ...data, transfers: replaceRows(data.transfers, [row]) }, (r) =>
          r.put('transfers', row),
        )
      },
      async deleteTransfer(id) {
        await commit({ ...data, transfers: data.transfers.filter((t) => t.id !== id) }, (r) =>
          r.remove('transfers', id),
        )
      },

      async saveCategory(input) {
        const row: Category = { ...input, id: input.id ?? 'c-' + uid() }
        const exists = data.categories.some((c) => c.id === row.id)
        await commit(
          {
            ...data,
            categories: exists
              ? data.categories.map((c) => (c.id === row.id ? row : c))
              : [...data.categories, row],
          },
          (r) => r.put('categories', row),
        )
      },
      async reorderCategories(ids) {
        const position = new Map(ids.map((id, i) => [id, i]))
        const moved = data.categories
          .filter((c) => position.has(c.id) && c.sort !== position.get(c.id))
          .map((c) => ({ ...c, sort: position.get(c.id)! }))
        if (moved.length === 0) return
        await commit({ ...data, categories: replaceRows(data.categories, moved) }, (r) =>
          r.putMany('categories', moved),
        )
      },
      async deleteCategory(id) {
        await commit(
          {
            ...data,
            categories: data.categories.filter((c) => c.id !== id),
            transactions: data.transactions.filter((t) => t.categoryId !== id),
          },
          async (r) => {
            for (const t of data.transactions.filter((t) => t.categoryId === id)) {
              await r.remove('transactions', t.id)
            }
            await r.remove('categories', id)
          },
        )
      },

      async saveAccount(input) {
        const current = data.accounts.find((a) => a.id === input.id)
        // A new account goes to the end, so it never takes over as the default.
        const sort = current?.sort ?? Math.max(-1, ...data.accounts.map((a) => a.sort)) + 1
        const rate = input.interestRate && input.interestRate > 0 ? input.interestRate : undefined
        const row: Account = {
          ...input,
          id: input.id ?? 'a-' + uid(),
          sort,
          interestRate: rate,
          interestDay: rate ? input.interestDay : undefined,
          // Interest counts from the day a rate first appears; changing the
          // rate keeps the running period, clearing it stops the payments.
          interestFrom: rate
            ? (current?.interestRate ? current.interestFrom : undefined) ?? todayISO()
            : undefined,
        }
        const exists = Boolean(current)
        await commit(
          {
            ...data,
            accounts: exists
              ? data.accounts.map((a) => (a.id === row.id ? row : a))
              : [...data.accounts, row],
          },
          (r) => r.put('accounts', row),
        )
      },
      async reorderAccounts(ids) {
        const next = ids
          .map((id, sort) => {
            const account = data.accounts.find((a) => a.id === id)
            return account && { ...account, sort }
          })
          .filter((a): a is Account => Boolean(a))
        const moved = next.filter((a) => data.accounts.find((b) => b.id === a.id)?.sort !== a.sort)
        if (moved.length === 0) return
        await commit({ ...data, accounts: next }, (r) => r.putMany('accounts', moved))
      },
      async deleteAccount(id) {
        // Transfers go with the account on either end, or the other side would
        // keep money that came from nowhere.
        const touches = (t: Transfer) => t.fromAccountId === id || t.toAccountId === id
        // Debts made from this account go too, with every repayment against them.
        const goneDebts = new Set(data.debts.filter((d) => d.accountId === id).map((d) => d.id))
        const paymentGoes = (p: DebtPayment) => p.accountId === id || goneDebts.has(p.debtId)
        await commit(
          {
            ...data,
            accounts: data.accounts.filter((a) => a.id !== id),
            transactions: data.transactions.filter((t) => t.accountId !== id),
            transfers: data.transfers.filter((t) => !touches(t)),
            debts: data.debts.filter((d) => !goneDebts.has(d.id)),
            debtPayments: data.debtPayments.filter((p) => !paymentGoes(p)),
          },
          async (r) => {
            for (const t of data.transactions.filter((t) => t.accountId === id)) {
              await r.remove('transactions', t.id)
            }
            for (const t of data.transfers.filter(touches)) {
              await r.remove('transfers', t.id)
            }
            for (const p of data.debtPayments.filter(paymentGoes)) {
              await r.remove('debtPayments', p.id)
            }
            for (const debtId of goneDebts) await r.remove('debts', debtId)
            await r.remove('accounts', id)
          },
        )
      },

      async saveRule(input) {
        const row: RecurringRule = {
          ...input,
          id: input.id ?? 'r-' + uid(),
          createdAt: stamp(),
        }
        const exists = data.recurring.some((r) => r.id === row.id)
        await commit(
          {
            ...data,
            recurring: exists
              ? data.recurring.map((r) => (r.id === row.id ? row : r))
              : [...data.recurring, row],
          },
          (r) => r.put('recurring', row),
        )
      },
      async deleteRule(id) {
        await commit({ ...data, recurring: data.recurring.filter((r) => r.id !== id) }, (r) =>
          r.remove('recurring', id),
        )
      },
      async toggleRule(id) {
        const rule = data.recurring.find((r) => r.id === id)
        if (!rule) return
        const next = { ...rule, active: !rule.active }
        await commit(
          { ...data, recurring: data.recurring.map((r) => (r.id === id ? next : r)) },
          (r) => r.put('recurring', next),
        )
      },

      async saveGoal(input) {
        const row: Goal = { ...input, id: input.id ?? 'g-' + uid(), createdAt: stamp() }
        const exists = data.goals.some((g) => g.id === row.id)
        await commit(
          {
            ...data,
            goals: exists ? data.goals.map((g) => (g.id === row.id ? row : g)) : [...data.goals, row],
          },
          (r) => r.put('goals', row),
        )
      },
      async deleteGoal(id) {
        await commit(
          {
            ...data,
            goals: data.goals.filter((g) => g.id !== id),
            contributions: data.contributions.filter((c) => c.goalId !== id),
          },
          async (r) => {
            for (const c of data.contributions.filter((c) => c.goalId === id)) {
              await r.remove('contributions', c.id)
            }
            await r.remove('goals', id)
          },
        )
      },
      async contribute(goalId, amount) {
        const row: GoalContribution = {
          id: 'gc-' + uid(),
          goalId,
          amount,
          occurredAt: todayISO(),
          createdAt: stamp(),
        }
        await commit({ ...data, contributions: [...data.contributions, row] }, (r) =>
          r.put('contributions', row),
        )
      },

      async addTask(title) {
        const task: Task = {
          id: 'tk-' + uid(),
          title,
          day: todayISO(),
          done: false,
          createdAt: stamp(),
        }
        await commit({ ...data, tasks: [task, ...data.tasks] }, (r) => r.put('tasks', task))
      },
      async toggleTask(id) {
        const task = data.tasks.find((t) => t.id === id)
        if (!task) return
        const next = { ...task, done: !task.done }
        await commit({ ...data, tasks: replaceRows(data.tasks, [next]) }, (r) =>
          r.put('tasks', next),
        )
      },
      async renameTask(id, title) {
        const task = data.tasks.find((t) => t.id === id)
        if (!task) return
        const next = { ...task, title }
        await commit({ ...data, tasks: replaceRows(data.tasks, [next]) }, (r) =>
          r.put('tasks', next),
        )
      },
      async deleteTask(id) {
        // A spawned task stays deleted: the template's cursor is already past it.
        await commit({ ...data, tasks: data.tasks.filter((t) => t.id !== id) }, (r) =>
          r.remove('tasks', id),
        )
      },
      async saveTemplate(input) {
        const today = todayISO()
        const current = data.taskTemplates.find((t) => t.id === input.id)
        // Edits count from today, never backwards: the cursor steps back to
        // today at most, so a weekday added today shows up at once.
        const row: TaskTemplate = current
          ? {
              ...current,
              title: input.title,
              weekdays: input.weekdays,
              nextDay: current.nextDay > today ? today : current.nextDay,
            }
          : {
              id: 'tt-' + uid(),
              title: input.title,
              weekdays: input.weekdays,
              nextDay: today,
              createdAt: stamp(),
            }
        const spawned = spawnTasks([row], data.tasks)
        const saved = spawned.templates[0] ?? row
        // Today's unfinished copy follows a new title; history keeps the old one.
        const renamed = data.tasks
          .filter((t) => t.templateId === row.id && t.day === today && !t.done && t.title !== row.title)
          .map((t) => ({ ...t, title: row.title }))
        await commit(
          {
            ...data,
            taskTemplates: replaceRows(data.taskTemplates, [saved]),
            tasks: [...spawned.tasks, ...replaceRows(data.tasks, renamed)],
          },
          async (r) => {
            await r.put('taskTemplates', saved)
            await r.putMany('tasks', [...renamed, ...spawned.tasks])
          },
        )
      },
      async deleteTemplate(id) {
        // Past days stay in the statistics; only today's open copy goes.
        const today = todayISO()
        const dropped = new Set(
          data.tasks
            .filter((t) => t.templateId === id && t.day >= today && !t.done)
            .map((t) => t.id),
        )
        await commit(
          {
            ...data,
            taskTemplates: data.taskTemplates.filter((t) => t.id !== id),
            tasks: data.tasks.filter((t) => !dropped.has(t.id)),
          },
          async (r) => {
            for (const taskId of dropped) await r.remove('tasks', taskId)
            await r.remove('taskTemplates', id)
          },
        )
      },
      async syncTasks() {
        const spawned = spawnTasks(data.taskTemplates, data.tasks)
        if (spawned.templates.length === 0) return
        await commit(
          {
            ...data,
            tasks: [...spawned.tasks, ...data.tasks],
            taskTemplates: replaceRows(data.taskTemplates, spawned.templates),
          },
          async (r) => {
            await r.putMany('taskTemplates', spawned.templates)
            await r.putMany('tasks', spawned.tasks)
          },
        )
      },

      async setTheme(theme) {
        const settings = { ...data.settings, theme }
        await commit({ ...data, settings }, (r) => r.saveSettings(settings))
      },
      async clearDemo() {
        // Categories and accounts stay; only the sample records go.
        const next: Snapshot = {
          ...data,
          transactions: [],
          transfers: [],
          debts: [],
          debtPayments: [],
          recurring: [],
          goals: [],
          contributions: [],
          accounts: data.accounts.map((a) => ({ ...a, initialBalance: 0 })),
          settings: { ...data.settings, demo: false },
        }
        await commit(next, async (r) => {
          await r.clearRecords()
          await r.putMany('accounts', next.accounts)
        })
      },
      async signOut() {
        await supabase?.auth.signOut()
      },
    }
  }, [commit, data, error, needsAuth, postedCount, ready, session])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp вызван вне AppProvider')
  return value
}
