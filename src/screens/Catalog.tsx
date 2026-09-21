import { useEffect, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { useApp } from '../data/store'
import { Sheet } from '../components/Sheet'
import {
  Badge,
  Button,
  Card,
  Field,
  Segmented,
  SubScreen,
  cx,
  inputClass,
} from '../components/ui'
import { ICON_KEYS, SWATCHES, iconOf } from '../lib/icons'
import { accountBalance } from '../lib/analytics'
import { money, num, plural } from '../lib/format'
import type { Account, Category, TxKind } from '../lib/types'

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink transition active:scale-95"
    >
      <Plus size={19} weight="bold" />
    </button>
  )
}

export function Categories() {
  const { data, saveCategory, deleteCategory } = useApp()
  const [kind, setKind] = useState<TxKind>('expense')
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)

  const list = data.categories
    .filter((c) => c.kind === kind)
    .sort((a, b) => a.sort - b.sort)

  return (
    <SubScreen
      title="Категории"
      back="/more"
      action={<AddButton onClick={() => setCreating(true)} label="Новая категория" />}
    >
      <div className="flex flex-col gap-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Расходы' },
            { value: 'income', label: 'Доходы' },
          ]}
        />

        <Card className="flex flex-col gap-1 p-2">
          {list.map((category) => {
            const used = data.transactions.filter((t) => t.categoryId === category.id).length
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setEditing(category)}
                className="flex items-center gap-3 rounded-[var(--r-md)] px-2 py-2 text-left transition active:bg-surface-2"
              >
                <Badge icon={category.icon} color={category.color} size={38} />
                <span className="flex-1 truncate text-[15px] font-medium">{category.name}</span>
                <span className="text-[12.5px] text-faint">
                  {used} {plural(used, 'запись', 'записи', 'записей')}
                </span>
              </button>
            )
          })}
        </Card>
      </div>

      <CategorySheet
        open={creating || editing !== null}
        category={editing}
        kind={kind}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSave={async (input) => {
          await saveCategory(input)
          setCreating(false)
          setEditing(null)
        }}
        onDelete={
          editing
            ? async () => {
                await deleteCategory(editing.id)
                setEditing(null)
              }
            : undefined
        }
      />
    </SubScreen>
  )
}

function CategorySheet({
  open,
  category,
  kind,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  category: Category | null
  kind: TxKind
  onClose: () => void
  onSave: (input: Omit<Category, 'id'> & { id?: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const { data } = useApp()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])
  const [icon, setIcon] = useState('cart')
  const [rowKind, setRowKind] = useState<TxKind>(kind)

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setColor(category?.color ?? SWATCHES[0])
    setIcon(category?.icon ?? 'cart')
    setRowKind(category?.kind ?? kind)
  }, [open, category, kind])

  const used = category
    ? data.transactions.filter((t) => t.categoryId === category.id).length
    : 0

  return (
    <Sheet open={open} onClose={onClose} title={category ? 'Изменить категорию' : 'Новая категория'}>
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Название">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, спорт"
            className={inputClass}
          />
        </Field>

        <Segmented
          value={rowKind}
          onChange={setRowKind}
          options={[
            { value: 'expense', label: 'Расход' },
            { value: 'income', label: 'Доход' },
          ]}
        />

        <Field label="Цвет">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Цвет ${swatch}`}
                className={cx(
                  'size-8 rounded-full transition active:scale-90',
                  color === swatch && 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]',
                )}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </Field>

        <Field label="Значок">
          <div className="grid grid-cols-8 gap-1.5">
            {ICON_KEYS.map((key) => {
              const Glyph = iconOf(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={key}
                  className={cx(
                    'grid aspect-square place-items-center rounded-[var(--r-sm)] transition active:scale-90',
                    icon === key ? 'bg-surface-3 text-ink' : 'bg-surface-2 text-dim',
                  )}
                >
                  <Glyph size={18} weight={icon === key ? 'fill' : 'regular'} />
                </button>
              )
            })}
          </div>
        </Field>

        <Button
          onClick={() =>
            void onSave({
              id: category?.id,
              name: name.trim(),
              kind: rowKind,
              color,
              icon,
              sort: category?.sort ?? 100,
            })
          }
          disabled={!name.trim()}
        >
          Сохранить
        </Button>

        {onDelete && (
          <>
            <Button variant="danger" onClick={() => void onDelete()}>
              <Trash size={17} weight="bold" />
              Удалить категорию
            </Button>
            {used > 0 && (
              <p className="text-center text-[12px] leading-relaxed text-neg">
                Вместе с категорией удалятся {used}{' '}
                {plural(used, 'операция', 'операции', 'операций')}.
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}

export function Accounts() {
  const { data, saveAccount, deleteAccount } = useApp()
  const [editing, setEditing] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <SubScreen
      title="Счета"
      back="/more"
      action={<AddButton onClick={() => setCreating(true)} label="Новый счёт" />}
    >
      <Card className="flex flex-col gap-1 p-2">
        {data.accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => setEditing(account)}
            className="flex items-center gap-3 rounded-[var(--r-md)] px-2 py-2.5 text-left transition active:bg-surface-2"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: account.color }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-[15px] font-medium">{account.name}</span>
            <span className="tnum text-[15px] font-semibold">
              {money(accountBalance(account, data.transactions, data.transfers))}
            </span>
          </button>
        ))}
      </Card>

      <AccountSheet
        open={creating || editing !== null}
        account={editing}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        onSave={async (input) => {
          await saveAccount(input)
          setCreating(false)
          setEditing(null)
        }}
        onDelete={
          editing && data.accounts.length > 1
            ? async () => {
                await deleteAccount(editing.id)
                setEditing(null)
              }
            : undefined
        }
      />
    </SubScreen>
  )
}

const ACCOUNT_TYPES: Array<{ value: Account['type']; label: string }> = [
  { value: 'card', label: 'Карта' },
  { value: 'cash', label: 'Наличные' },
  { value: 'savings', label: 'Накопления' },
]

function AccountSheet({
  open,
  account,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  account: Account | null
  onClose: () => void
  onSave: (input: Omit<Account, 'id'> & { id?: string }) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('card')
  const [initial, setInitial] = useState('')
  const [color, setColor] = useState(SWATCHES[4])

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? '')
    setType(account?.type ?? 'card')
    setInitial(account ? String(account.initialBalance) : '')
    setColor(account?.color ?? SWATCHES[4])
  }, [open, account])

  const start = Number(initial.replace(/[^\d-]/g, '') || '0')

  return (
    <Sheet open={open} onClose={onClose} title={account ? 'Изменить счёт' : 'Новый счёт'}>
      <div className="flex flex-col gap-4 pb-2">
        <Field label="Название">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, Kaspi Gold"
            className={inputClass}
          />
        </Field>

        <Segmented value={type} onChange={setType} options={ACCOUNT_TYPES} />

        <Field label="Начальный остаток" hint="Сколько на счёте сейчас, до учёта операций">
          <input
            type="text"
            inputMode="numeric"
            value={initial ? num(start) : ''}
            onChange={(e) => setInitial(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>

        <Field label="Цвет">
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={`Цвет ${swatch}`}
                className={cx(
                  'size-8 rounded-full transition active:scale-90',
                  color === swatch && 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--surface)]',
                )}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </Field>

        <Button
          onClick={() =>
            void onSave({
              id: account?.id,
              name: name.trim(),
              type,
              initialBalance: start,
              color,
            })
          }
          disabled={!name.trim()}
        >
          Сохранить
        </Button>

        {onDelete && (
          <Button variant="danger" onClick={() => void onDelete()}>
            <Trash size={17} weight="bold" />
            Удалить счёт
          </Button>
        )}
      </div>
    </Sheet>
  )
}
