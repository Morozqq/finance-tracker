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
import { Accounts, Categories } from './screens/Catalog'
import { SignIn } from './screens/SignIn'
import type { Transaction } from './lib/types'

export function App() {
  const { needsAuth, error } = useApp()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const location = useLocation()
  const reduce = useReducedMotion()

  if (needsAuth) return <SignIn />

  const openNew = () => {
    setEditing(null)
    setSheetOpen(true)
  }
  const openEdit = (tx: Transaction) => {
    setEditing(tx)
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
            <Route path="/" element={<Dashboard onAdd={openNew} />} />
            <Route
              path="/transactions"
              element={<Transactions onAdd={openNew} onEdit={openEdit} />}
            />
            <Route path="/goals" element={<Goals />} />
            <Route path="/more" element={<More />} />
            <Route path="/more/recurring" element={<Recurring />} />
            <Route path="/more/categories" element={<Categories />} />
            <Route path="/more/accounts" element={<Accounts />} />
            <Route path="*" element={<Dashboard onAdd={openNew} />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <TabBar onAdd={openNew} />

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
