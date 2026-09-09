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
  Goal,
  GoalContribution,
  RecurringRule,
  Settings,
  Snapshot,
  Transaction,
} from '../lib/types'
import type { Repo } from './repo'
import { LocalRepo } from './localRepo'
import { SupabaseRepo } from './supabaseRepo'
import { hasCloud, supabase } from './supabase'
import { emptySnapshot } from '../lib/seed'
import { catchUp } from '../lib/recurring'
import { todayISO, uid } from '../lib/format'

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

  saveCategory: (input: Omit<Category, 'id'> & { id?: string }) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  saveAccount: (input: Omit<Account, 'id'> & { id?: string }) => Promise<void>
  deleteAccount: (id: string) => Promise<void>

  saveRule: (input: Omit<RecurringRule, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  toggleRule: (id: string) => Promise<void>

  saveGoal: (input: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  contribute: (goalId: string, amount: number) => Promise<void>

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
        // Post everything the recurring rules owe since the last visit.
        const run = catchUp(loaded.recurring)
        if (run.posted > 0) {
          const next: Snapshot = {
            ...loaded,
            transactions: [...run.transactions, ...loaded.transactions],
            recurring: run.rules,
          }
          await repo.putMany('transactions', run.transactions)
          await repo.putMany('recurring', run.rules)
          setData(next)
          setPostedCount(run.posted)
        } else {
          setData(loaded)
        }
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
        const row: Account = { ...input, id: input.id ?? 'a-' + uid() }
        const exists = data.accounts.some((a) => a.id === row.id)
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
      async deleteAccount(id) {
        await commit(
          {
            ...data,
            accounts: data.accounts.filter((a) => a.id !== id),
            transactions: data.transactions.filter((t) => t.accountId !== id),
          },
          async (r) => {
            for (const t of data.transactions.filter((t) => t.accountId === id)) {
              await r.remove('transactions', t.id)
            }
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

      async setTheme(theme) {
        const settings = { ...data.settings, theme }
        await commit({ ...data, settings }, (r) => r.saveSettings(settings))
      },
      async clearDemo() {
        // Categories and accounts stay; only the sample records go.
        const next: Snapshot = {
          ...data,
          transactions: [],
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
