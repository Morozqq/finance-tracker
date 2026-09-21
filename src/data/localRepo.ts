import { del, get, set } from 'idb-keyval'
import type { Repo, RowOf, TableKey } from './repo'
import type { Settings, Snapshot } from '../lib/types'
import { demoSnapshot } from '../lib/seed'

const KEY = 'finance-tracker:snapshot:v1'

/**
 * Keeps the whole dataset as one IndexedDB record. A personal ledger stays in
 * the low thousands of rows, so rewriting the blob on every change costs less
 * than maintaining separate object stores.
 */
export class LocalRepo implements Repo {
  readonly kind = 'local' as const
  private cache: Snapshot | null = null

  async load(): Promise<Snapshot> {
    const stored = await get<Snapshot>(KEY)
    if (stored) {
      this.cache = migrate(stored)
      return this.cache
    }
    const fresh = demoSnapshot()
    this.cache = fresh
    await set(KEY, fresh)
    return fresh
  }

  private async flush(next: Snapshot) {
    this.cache = next
    await set(KEY, next)
  }

  private snapshot(): Snapshot {
    if (!this.cache) throw new Error('Хранилище ещё не загружено')
    return this.cache
  }

  async put<K extends TableKey>(table: K, row: RowOf<K>): Promise<void> {
    await this.putMany(table, [row])
  }

  async putMany<K extends TableKey>(table: K, rows: RowOf<K>[]): Promise<void> {
    const current = this.snapshot()
    const list = [...(current[table] as RowOf<K>[])]
    for (const row of rows) {
      const at = list.findIndex((item) => item.id === row.id)
      if (at >= 0) list[at] = row
      else list.push(row)
    }
    await this.flush({ ...current, [table]: list } as Snapshot)
  }

  async remove(table: TableKey, id: string): Promise<void> {
    const current = this.snapshot()
    const list = (current[table] as Array<{ id: string }>).filter((item) => item.id !== id)
    await this.flush({ ...current, [table]: list } as Snapshot)
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.flush({ ...this.snapshot(), settings })
  }

  async replaceAll(snapshot: Snapshot): Promise<void> {
    await this.flush(snapshot)
  }

  async clearRecords(): Promise<void> {
    const current = this.snapshot()
    await this.flush({
      ...current,
      transactions: [],
      transfers: [],
      recurring: [],
      goals: [],
      contributions: [],
      accounts: current.accounts.map((a) => ({ ...a, initialBalance: 0 })),
      settings: { ...current.settings, demo: false },
    })
  }

  static async wipe(): Promise<void> {
    await del(KEY)
  }
}

/** Fills in fields added after a record was first written. */
function migrate(stored: Snapshot): Snapshot {
  return {
    categories: stored.categories ?? [],
    accounts: stored.accounts ?? [],
    transactions: stored.transactions ?? [],
    transfers: stored.transfers ?? [],
    recurring: stored.recurring ?? [],
    goals: stored.goals ?? [],
    contributions: stored.contributions ?? [],
    tasks: stored.tasks ?? [],
    taskTemplates: stored.taskTemplates ?? [],
    settings: {
      theme: stored.settings?.theme ?? 'system',
      monthStartDay: stored.settings?.monthStartDay ?? 1,
      demo: stored.settings?.demo ?? false,
    },
  }
}
