import { cx } from './ui'
import type { Account } from '../lib/types'

/** A row of account pills, one selectable, with an optional note on the right. */
export function AccountChips({
  label,
  accounts,
  value,
  onPick,
  hint,
}: {
  label: string
  accounts: Account[]
  value: string
  onPick: (id: string) => void
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between px-0.5">
        <span className="text-[12.5px] font-semibold text-dim">{label}</span>
        {hint && <span className="tnum text-[12px] text-faint">{hint}</span>}
      </div>
      <div className="no-bar flex gap-2 overflow-x-auto" role="group" aria-label={label}>
        {accounts.map((account) => {
          const active = account.id === value
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onPick(account.id)}
              aria-pressed={active}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition active:scale-95',
                active ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-dim',
              )}
            >
              <span
                className="size-2 rounded-full"
                style={{ background: active ? 'currentColor' : account.color }}
                aria-hidden="true"
              />
              {account.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
