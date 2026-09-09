// Drives the installed Chrome against the preview build: catches console
// errors, checks for horizontal overflow, and captures each screen.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = process.env.APP_URL ?? 'http://localhost:4173/finance-tracker/'
const OUT = process.env.SCHEME === 'light' ? 'shots/light' : 'shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
  timezoneId: 'Asia/Almaty',
  colorScheme: process.env.SCHEME === 'light' ? 'light' : 'dark',
})

const problems = []
const page = await context.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('console: ' + m.text())
})
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))

async function overflow(label) {
  const wide = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  if (wide.scroll > wide.client + 1) {
    problems.push(`overflow on ${label}: scrollWidth ${wide.scroll} > ${wide.client}`)
  }
}

async function shot(name, label) {
  await page.waitForTimeout(700)
  await overflow(label)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('captured', name)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Всего на счетах', { timeout: 15000 })
await shot('01-dashboard', 'dashboard')

await page.getByRole('button', { name: 'Добавить операцию' }).first().click()
await page.waitForTimeout(500)
const fit = await page.evaluate(() => {
  const scroller = document.querySelector('[role="dialog"] div.overflow-y-auto')
  return scroller ? { scroll: scroller.scrollHeight, client: scroller.clientHeight } : null
})
if (fit && fit.scroll > fit.client + 1) {
  problems.push(`entry sheet scrolls: content ${fit.scroll} vs ${fit.client}`)
}
await shot('02-entry', 'entry sheet')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

await page.getByRole('link', { name: 'Операции' }).click()
await page.waitForSelector('text=Сегодня, Вчера, Категория', { timeout: 5000 }).catch(() => {})
await shot('03-transactions', 'transactions')

await page.getByRole('link', { name: 'Цели' }).click()
await shot('04-goals', 'goals')

await page.getByRole('link', { name: 'Ещё' }).click()
await shot('05-more', 'more')

await page.getByRole('link', { name: 'Регулярные платежи' }).click()
await shot('06-recurring', 'recurring')

if (problems.length) {
  console.log('\nPROBLEMS:')
  for (const p of problems) console.log(' -', p)
} else {
  console.log('\nno console errors, no horizontal overflow')
}

await browser.close()
