import { useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useApp } from './data/store'
import { TabBar } from './components/TabBar'
import { AmountSheet } from './components/AmountSheet'
import { Dashboard } from './screens/Dashboard'
import { Transactions } from './screens/Transactions'
import { Goals } from './screens/Goals'
import { More } from './screens/More'
import { Recurring } from './screens/Recurring'
import { Tasks } from './screens/Tasks'
import { Accounts, Categories } from './screens/Catalog'
import { SignIn } from './screens/SignIn'
import type { Transaction, Transfer } from './lib/types'

export function App() {
  const { needsAuth, error } = useApp()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | Transfer | null>(null)
  const [drillOpen, setDrillOpen] = useState(false)
  const [taskSheetOpen, setTaskSheetOpen] = useState(false)
  const location = useLocation()
  const reduce = useReducedMotion()

  if (needsAuth) return <SignIn />

  // On the tasks tab the round button adds a task; everywhere else, an operation.
  const onTasks = location.pathname.startsWith('/tasks')

  const openNew = () => {
    setEditing(null)
    setSheetOpen(true)
  }
  const openEdit = (entry: Transaction | Transfer) => {
    setEditing(entry)
    setSheetOpen(true)
  }

  return (
    <div className="mx-auto max-w-[520px]">
      {error && (
        <div className="fixed inset-x-0 top-0 z-50 bg-neg px-4 py-2 text-center text-[13px] font-medium text-white">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard onAdd={openNew} onDrill={setDrillOpen} />} />
            <Route
              path="/transactions"
              element={<Transactions onAdd={openNew} onEdit={openEdit} />}
            />
            <Route path="/goals" element={<Goals />} />
            <Route
              path="/tasks"
              element={<Tasks adding={taskSheetOpen} onAddingChange={setTaskSheetOpen} />}
            />
            <Route path="/more" element={<More />} />
            <Route path="/more/recurring" element={<Recurring />} />
            <Route path="/more/categories" element={<Categories />} />
            <Route path="/more/accounts" element={<Accounts />} />
            <Route path="*" element={<Dashboard onAdd={openNew} onDrill={setDrillOpen} />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <TabBar
        onAdd={onTasks ? () => setTaskSheetOpen(true) : openNew}
        addLabel={onTasks ? 'Добавить задачу' : undefined}
        hideAdd={drillOpen}
      />

      <AmountSheet
        open={sheetOpen}
        editing={editing}
        onClose={() => {
          setSheetOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}
