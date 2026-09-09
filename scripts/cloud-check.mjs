import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true, locale: 'ru-RU' })
const errs = []
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
await page.goto('http://localhost:4173/finance-tracker/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const heading = await page.locator('h1').first().innerText().catch(() => '(нет)')
console.log('заголовок экрана:', JSON.stringify(heading))
console.log('кнопка Google:', await page.getByRole('button', { name: /Google/ }).count())
await page.screenshot({ path: 'shots/07-signin.png' })
console.log(errs.length ? 'ОШИБКИ:\n' + errs.join('\n') : 'ошибок в консоли нет')
await browser.close()
