import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true })
await page.goto('http://localhost:4173/finance-tracker/', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Всего на счетах')
await page.getByRole('button', { name: 'Добавить операцию' }).first().click()
await page.waitForTimeout(600)
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Карта')
  if (!btns.length) return { found: false, all: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,40) }
  const b = btns[0]
  const cs = getComputedStyle(b)
  return {
    found: true,
    text: b.textContent,
    color: cs.color,
    background: cs.backgroundColor,
    rect: b.getBoundingClientRect().toJSON(),
    rootBg: getComputedStyle(document.documentElement).getPropertyValue('--bg'),
    rootText: getComputedStyle(document.documentElement).getPropertyValue('--text'),
  }
})
console.log(JSON.stringify(info, null, 2))
// Does the sheet's save button sit inside the viewport without scrolling?
const fit = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  const scroller = dlg?.querySelector('div.overflow-y-auto')
  return scroller ? { scrollH: scroller.scrollHeight, clientH: scroller.clientHeight } : null
})
console.log('sheet scroll:', JSON.stringify(fit))
await browser.close()
