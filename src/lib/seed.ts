import { addDays, format, subDays } from 'date-fns'
import type { Account, Category, Goal, RecurringRule, Snapshot, Transaction, Transfer } from './types'
import { uid } from './format'

const day = (d: Date) => format(d, 'yyyy-MM-dd')

export function defaultCategories(): Category[] {
  const expense: Array<[string, string, string]> = [
    ['Продукты', 'cart', '#8BB33D'],
    ['Кафе', 'fork', '#E4572E'],
    ['Транспорт', 'bus', '#3D93D6'],
    ['Жильё', 'house', '#B98A5A'],
    ['Связь', 'wifi', '#6C74DB'],
    ['Здоровье', 'aid', '#2FAF8C'],
    ['Одежда', 'shirt', '#DE5D8F'],
    ['Досуг', 'film', '#A863C9'],
    ['Учёба', 'cap', '#F2A93B'],
    ['Прочее', 'dots', '#7C8794'],
  ]
  const income: Array<[string, string, string]> = [
    ['Зарплата', 'briefcase', '#2FAF8C'],
    ['Подработка', 'laptop', '#3D93D6'],
    ['Подарки', 'gift', '#DE5D8F'],
    ['Проценты', 'piggy', '#8BB33D'],
  ]
  return [
    ...expense.map(([name, icon, color], i) => ({
      id: 'c-' + uid(),
      name,
      icon,
      color,
      kind: 'expense' as const,
      sort: i,
    })),
    ...income.map(([name, icon, color], i) => ({
      id: 'c-' + uid(),
      name,
      icon,
      color,
      kind: 'income' as const,
      sort: i,
    })),
  ]
}

export function defaultAccounts(): Account[] {
  return [
    { id: 'a-' + uid(), name: 'Карта', type: 'card', initialBalance: 0, color: '#3D93D6', sort: 0 },
    { id: 'a-' + uid(), name: 'Наличные', type: 'cash', initialBalance: 0, color: '#8BB33D', sort: 1 },
    {
      id: 'a-' + uid(),
      name: 'Накопления',
      type: 'savings',
      initialBalance: 0,
      color: '#2FAF8C',
      sort: 2,
    },
  ]
}

/** Plausible two months of spending so the app opens on a working screen
 *  instead of an empty shell. Cleared in one tap from the dashboard banner. */
export function demoSnapshot(): Snapshot {
  const categories = defaultCategories()
  const accounts = defaultAccounts()
  const byName = (n: string) => categories.find((c) => c.name === n)!.id
  const card = accounts[0].id
  const cash = accounts[1].id
  const now = new Date()
  const stamp = new Date().toISOString()

  const transactions: Transaction[] = []
  const push = (
    kind: 'expense' | 'income',
    amount: number,
    category: string,
    account: string,
    daysAgo: number,
    note?: string,
  ) => {
    transactions.push({
      id: 't-' + uid(),
      kind,
      amount,
      categoryId: byName(category),
      accountId: account,
      occurredAt: day(subDays(now, daysAgo)),
      note,
      createdAt: stamp,
    })
  }

  push('income', 720000, 'Зарплата', card, 4)
  push('income', 720000, 'Зарплата', card, 34)
  push('income', 145000, 'Подработка', card, 18, 'Вёрстка лендинга')

  push('expense', 210000, 'Жильё', card, 3, 'Аренда')
  push('expense', 210000, 'Жильё', card, 33, 'Аренда')
  push('expense', 18400, 'Жильё', card, 6, 'Коммуналка')
  push('expense', 5900, 'Связь', card, 6)
  push('expense', 5900, 'Связь', card, 36)

  const grocery = [14200, 8600, 22400, 11800, 6300, 19500, 9100, 16700, 12400, 7800, 24100, 10300]
  grocery.forEach((amount, i) =>
    push('expense', amount, 'Продукты', i % 3 === 0 ? cash : card, i * 4 + 1),
  )

  const cafe = [4800, 12300, 3200, 7600, 5400, 9800, 2900, 6100]
  cafe.forEach((amount, i) => push('expense', amount, 'Кафе', card, i * 6 + 2))

  push('expense', 3400, 'Транспорт', cash, 1)
  push('expense', 1200, 'Транспорт', cash, 5)
  push('expense', 8900, 'Транспорт', card, 12, 'Такси')
  push('expense', 2800, 'Транспорт', cash, 21)

  push('expense', 34600, 'Здоровье', card, 9, 'Стоматолог')
  push('expense', 7200, 'Здоровье', card, 26)
  push('expense', 46800, 'Одежда', card, 14)
  push('expense', 5500, 'Досуг', card, 7, 'Кино')
  push('expense', 18900, 'Досуг', card, 23)
  push('expense', 62000, 'Учёба', card, 29, 'Курс английского')
  push('expense', 4300, 'Прочее', cash, 11)

  const transfers: Transfer[] = [
    {
      id: 'tr-' + uid(),
      fromAccountId: card,
      toAccountId: accounts[2].id,
      amount: 150000,
      occurredAt: day(subDays(now, 3)),
      note: 'Отложить с зарплаты',
      createdAt: stamp,
    },
  ]

  const recurring: RecurringRule[] = [
    {
      id: 'r-' + uid(),
      title: 'Аренда квартиры',
      kind: 'expense',
      amount: 210000,
      categoryId: byName('Жильё'),
      accountId: card,
      freq: 'month',
      interval: 1,
      nextRunAt: day(addDays(now, 12)),
      active: true,
      createdAt: stamp,
    },
    {
      id: 'r-' + uid(),
      title: 'Интернет и связь',
      kind: 'expense',
      amount: 5900,
      categoryId: byName('Связь'),
      accountId: card,
      freq: 'month',
      interval: 1,
      nextRunAt: day(addDays(now, 5)),
      active: true,
      createdAt: stamp,
    },
    {
      id: 'r-' + uid(),
      title: 'Зарплата',
      kind: 'income',
      amount: 720000,
      categoryId: byName('Зарплата'),
      accountId: card,
      freq: 'month',
      interval: 1,
      nextRunAt: day(addDays(now, 26)),
      active: true,
      createdAt: stamp,
    },
  ]

  const goals: Goal[] = [
    {
      id: 'g-' + uid(),
      name: 'Поездка в Грузию',
      targetAmount: 900000,
      targetDate: day(addDays(now, 160)),
      color: '#2FAF8C',
      icon: 'plane',
      createdAt: subDays(now, 62).toISOString(),
    },
    {
      id: 'g-' + uid(),
      name: 'Новый ноутбук',
      targetAmount: 1400000,
      color: '#6C74DB',
      icon: 'laptop',
      createdAt: subDays(now, 48).toISOString(),
    },
  ]

  const contributions = [
    {
      id: 'gc-' + uid(),
      goalId: goals[0].id,
      amount: 150000,
      occurredAt: day(subDays(now, 40)),
      createdAt: stamp,
    },
    {
      id: 'gc-' + uid(),
      goalId: goals[0].id,
      amount: 120000,
      occurredAt: day(subDays(now, 12)),
      createdAt: stamp,
    },
    {
      id: 'gc-' + uid(),
      goalId: goals[1].id,
      amount: 300000,
      occurredAt: day(subDays(now, 25)),
      createdAt: stamp,
    },
  ]

  accounts[1] = { ...accounts[1], initialBalance: 140000 }
  accounts[2] = { ...accounts[2], initialBalance: 570000 }

  return {
    categories,
    accounts,
    transactions,
    transfers,
    debts: [],
    debtPayments: [],
    recurring,
    goals,
    contributions,
    tasks: [],
    taskTemplates: [],
    settings: { theme: 'system', monthStartDay: 1, demo: true },
  }
}

export function emptySnapshot(): Snapshot {
  return {
    categories: defaultCategories(),
    accounts: defaultAccounts(),
    transactions: [],
    transfers: [],
    debts: [],
    debtPayments: [],
    recurring: [],
    goals: [],
    contributions: [],
    tasks: [],
    taskTemplates: [],
    settings: { theme: 'system', monthStartDay: 1, demo: false },
  }
}
