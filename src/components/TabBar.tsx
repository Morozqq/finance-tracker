import { ChartPieSlice, DotsThreeCircle, ListChecks, Plus, Receipt, Target } from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { cx } from './ui'

const TABS = [
  { to: '/', label: 'Обзор', Icon: ChartPieSlice },
  { to: '/transactions', label: 'Операции', Icon: Receipt },
  { to: '/goals', label: 'Цели', Icon: Target },
  { to: '/tasks', label: 'Задачи', Icon: ListChecks },
  { to: '/more', label: 'Ещё', Icon: DotsThreeCircle },
]

export function TabBar({
  onAdd,
  hideAdd = false,
  addLabel = 'Добавить операцию',
}: {
  onAdd: () => void
  hideAdd?: boolean
  addLabel?: string
}) {
  return (
    <>
      {/* Уходит с дороги, когда под графиком открыт разбор: там в правом
          нижнем углу живут кнопки удаления. */}
      <motion.button
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        tabIndex={hideAdd ? -1 : 0}
        animate={{ scale: hideAdd ? 0 : 1, opacity: hideAdd ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="fixed right-5 z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-ink active:scale-95"
        style={{
          bottom: 'calc(78px + env(safe-area-inset-bottom))',
          boxShadow: 'var(--shadow-fab)',
          pointerEvents: hideAdd ? 'none' : 'auto',
        }}
      >
        <Plus size={26} weight="bold" />
      </motion.button>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-[520px]">
          {TABS.map(({ to, label, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition',
                    isActive ? 'text-accent' : 'text-faint',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={23} weight={isActive ? 'fill' : 'regular'} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
