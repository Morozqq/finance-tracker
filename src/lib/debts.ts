import type { Debt, DebtPayment } from './types'

export function debtPaid(debt: Debt, payments: DebtPayment[]): number {
  return payments.reduce((sum, p) => (p.debtId === debt.id ? sum + p.amount : sum), 0)
}

/** What is still owed. A debt is closed once this reaches zero. */
export function debtRemaining(debt: Debt, payments: DebtPayment[]): number {
  return Math.max(0, debt.amount - debtPaid(debt, payments))
}

export function debtTotals(debts: Debt[], payments: DebtPayment[]) {
  let owedToMe = 0
  let iOwe = 0
  for (const debt of debts) {
    const left = debtRemaining(debt, payments)
    if (debt.direction === 'lent') owedToMe += left
    else iOwe += left
  }
  return { owedToMe, iOwe }
}

/** Names from earlier debts, most recent first, for one-tap entry. */
export function knownPeople(debts: Debt[], limit = 6): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const debt of [...debts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
    const key = debt.person.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    names.push(debt.person.trim())
    if (names.length === limit) break
  }
  return names
}
