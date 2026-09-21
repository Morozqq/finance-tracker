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

/** Tables the app writes to. Names match the Supabase schema. */
export type TableKey =
  | 'categories'
  | 'accounts'
  | 'transactions'
  | 'transfers'
  | 'debts'
  | 'debtPayments'
  | 'recurring'
  | 'goals'
  | 'contributions'
  | 'tasks'
  | 'taskTemplates'

export type RowOf<K extends TableKey> = K extends 'categories'
  ? Category
  : K extends 'accounts'
    ? Account
    : K extends 'transactions'
      ? Transaction
      : K extends 'transfers'
        ? Transfer
        : K extends 'debts'
          ? Debt
          : K extends 'debtPayments'
            ? DebtPayment
            : K extends 'recurring'
              ? RecurringRule
              : K extends 'goals'
                ? Goal
                : K extends 'tasks'
                  ? Task
                  : K extends 'taskTemplates'
                    ? TaskTemplate
                    : GoalContribution

/**
 * One interface, two implementations. The screens never learn which one is
 * active, so moving from the phone's own storage to Supabase changes nothing
 * above this line.
 */
export interface Repo {
  readonly kind: 'local' | 'cloud'
  load(): Promise<Snapshot>
  put<K extends TableKey>(table: K, row: RowOf<K>): Promise<void>
  putMany<K extends TableKey>(table: K, rows: RowOf<K>[]): Promise<void>
  remove(table: TableKey, id: string): Promise<void>
  saveSettings(settings: Settings): Promise<void>
  replaceAll(snapshot: Snapshot): Promise<void>
  /** Drops every record but keeps categories and accounts. */
  clearRecords(): Promise<void>
}

export type { Account, Category, Goal, GoalContribution, RecurringRule, Snapshot, Transaction }
