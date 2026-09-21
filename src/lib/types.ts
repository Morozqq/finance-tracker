export type TxKind = 'expense' | 'income'

export type Freq = 'day' | 'week' | 'month' | 'year'

/** Amounts are whole tenge. Kazakhstan has no circulating subunit, so there is
 *  no reason to carry cents through the whole app. */
export type Tenge = number

export interface Category {
  id: string
  name: string
  kind: TxKind
  color: string
  icon: string
  sort: number
  archived?: boolean
}

export interface Account {
  id: string
  name: string
  type: 'cash' | 'card' | 'savings'
  initialBalance: Tenge
  color: string
  /** Position set by dragging in Счета; the first account is the default one. */
  sort: number
  archived?: boolean
}

export interface Transaction {
  id: string
  kind: TxKind
  amount: Tenge
  categoryId: string
  accountId: string
  /** ISO calendar day, YYYY-MM-DD. */
  occurredAt: string
  note?: string
  recurringId?: string
  createdAt: string
}

/** Money moved between two of the user's own accounts. It is neither income
 *  nor spending: balances move, totals and categories do not. */
export interface Transfer {
  id: string
  fromAccountId: string
  toAccountId: string
  amount: Tenge
  /** ISO calendar day, YYYY-MM-DD. */
  occurredAt: string
  note?: string
  createdAt: string
}

export interface RecurringRule {
  id: string
  title: string
  kind: TxKind
  amount: Tenge
  categoryId: string
  accountId: string
  freq: Freq
  interval: number
  /** ISO calendar day of the next posting. */
  nextRunAt: string
  endsAt?: string
  active: boolean
  createdAt: string
}

export interface Goal {
  id: string
  name: string
  targetAmount: Tenge
  targetDate?: string
  color: string
  icon: string
  createdAt: string
}

export interface GoalContribution {
  id: string
  goalId: string
  amount: Tenge
  occurredAt: string
  createdAt: string
}

/** A standing task that puts itself on the list on chosen weekdays. */
export interface TaskTemplate {
  id: string
  title: string
  /** Weekdays it appears on, as Date.getDay(): 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  /** ISO calendar day the next spawn starts from; every day before it is done. */
  nextDay: string
  createdAt: string
}

/** One task on one calendar day. */
export interface Task {
  id: string
  title: string
  /** ISO calendar day the task belongs to, YYYY-MM-DD. */
  day: string
  done: boolean
  /** Set when the task was spawned from a template. */
  templateId?: string
  createdAt: string
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  /** Day the budgeting month rolls over on. 1 for calendar months. */
  monthStartDay: number
  /** True while the sample data from first launch is still in place. */
  demo: boolean
}

export interface Snapshot {
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  transfers: Transfer[]
  recurring: RecurringRule[]
  goals: Goal[]
  contributions: GoalContribution[]
  tasks: Task[]
  taskTemplates: TaskTemplate[]
  settings: Settings
}
