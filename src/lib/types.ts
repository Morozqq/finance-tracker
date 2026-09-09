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
  recurring: RecurringRule[]
  goals: Goal[]
  contributions: GoalContribution[]
  settings: Settings
}
