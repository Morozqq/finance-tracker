// Проверяет интерактивность графиков и удаление записей на локальной сборке.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.APP_URL ?? 'http://localhost:4321/finance-tracker/'
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
  timezoneId: 'Asia/Almaty',
  colorScheme: 'dark',
})

const problems = []
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') problems.push('console: ' + m.text())
})

const drillOpen = () => page.getByText('Открыть в списке операций').isVisible().catch(() => false)
const closeDrill = async () => {
  await page.locator('section button[aria-label="Закрыть"]').first().click()
  await page.waitForTimeout(450)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Всего на счетах', { timeout: 20000 })
await page.waitForTimeout(600)

// --- 1. Нажатие по кольцу пончика ---
await page.locator('svg[width="176"]').first().scrollIntoViewIfNeeded()
await page.waitForTimeout(350)
const ring = await page.evaluate(() => {
  const b = document.querySelector('svg[width="176"]').getBoundingClientRect()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 - (b.width - 22) / 2 }
})
await page.mouse.click(ring.x, ring.y)
await page.waitForTimeout(600)
const byRing = await drillOpen()
console.log('нажатие по кольцу:', byRing ? 'панель открылась' : 'НЕ ОТКРЫЛАСЬ')
if (!byRing) problems.push('срез пончика не открыл панель')
await page.screenshot({ path: 'shots/10-slice.png' })

// --- 2. Удаление записи из панели ---
const rowSel = 'li button[aria-label^="Удалить операцию"]'
const before = await page.locator(rowSel).count()
console.log('записей в панели:', before)
if (before === 0) problems.push('панель пуста')

if (before > 0) {
  await page.locator(rowSel).first().click()
  await page.waitForTimeout(400)
  const confirm = page.getByRole('button', { name: 'Удалить', exact: true })
  const confirmShown = await confirm.isVisible().catch(() => false)
  console.log('подтверждение удаления:', confirmShown ? 'показано' : 'НЕТ')
  if (!confirmShown) problems.push('нет подтверждения удаления')
  await page.screenshot({ path: 'shots/11-confirm.png' })

  if (confirmShown) {
    await confirm.click()
    await page.waitForTimeout(1000)
    const after = await page.locator(rowSel).count()
    console.log(`записей до ${before}, после ${after}`)
    if (after !== before - 1) problems.push(`удаление не сработало: было ${before}, стало ${after}`)
  }
}

// --- 3. Строка легенды открывает ту же панель ---
if (await drillOpen()) await closeDrill()
await page.getByRole('button', { pressed: false }).filter({ hasText: '%' }).first().click()
await page.waitForTimeout(600)
const byLegend = await drillOpen()
console.log('нажатие по строке легенды:', byLegend ? 'панель открылась' : 'НЕ ОТКРЫЛАСЬ')
if (!byLegend) problems.push('строка легенды не открыла панель')
if (byLegend) await closeDrill()

// --- 4. Столбец графика ---
const bars = page.locator('button[aria-label*="тенге"]')
const barCount = await bars.count()
console.log('столбцов:', barCount)
let opened = false
for (let i = barCount - 1; i >= 0 && !opened; i--) {
  const label = await bars.nth(i).getAttribute('aria-label')
  if (label && !/:\s*0\s*тенге/.test(label)) {
    await bars.nth(i).scrollIntoViewIfNeeded()
    await bars.nth(i).click()
    await page.waitForTimeout(600)
    opened = await page.getByText('Выбрано:').isVisible().catch(() => false)
  }
}
console.log('нажатие по столбцу:', opened ? 'панель открылась' : 'НЕ ОТКРЫЛАСЬ')
if (!opened) problems.push('столбец не открыл панель')
await page.screenshot({ path: 'shots/12-bar.png' })

console.log(problems.length ? '\nПРОБЛЕМЫ:\n' + problems.join('\n') : '\nвсё работает, ошибок нет')
await browser.close()
