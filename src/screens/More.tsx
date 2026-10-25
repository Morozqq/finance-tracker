import { useState } from 'react'
import {
  ArrowsClockwise,
  CaretRight,
  CloudCheck,
  DeviceMobile,
  DownloadSimple,
  Handshake,
  SignOut,
  SquaresFour,
  Wallet,
} from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { useApp } from '../data/store'
import { Button, Card, Field, Screen, Segmented, SectionTitle, inputClass } from '../components/ui'
import { debtRemaining } from '../lib/debts'
import { plural } from '../lib/format'

export function More() {
  const { data, mode, email, setTheme, setMonthStart, signOut, clearDemo } = useApp()

  // Поле правится посимвольно, поэтому в настройки уходит только то, что уже
  // похоже на число месяца; на выходе из поля текст возвращается к сохранённому.
  const [startDayText, setStartDayText] = useState(String(data.settings.monthStartDay))
  const startDay = data.settings.monthStartDay
  const typeStartDay = (text: string) => {
    setStartDayText(text)
    const next = Number(text)
    if (Number.isInteger(next) && next >= 1 && next <= 31 && next !== startDay) {
      void setMonthStart(next)
    }
  }

  const openDebts = data.debts.filter((d) => debtRemaining(d, data.debtPayments) > 0).length

  const links = [
    {
      to: '/more/recurring',
      Icon: ArrowsClockwise,
      label: 'Регулярные платежи',
      meta: `${data.recurring.length} ${plural(data.recurring.length, 'правило', 'правила', 'правил')}`,
    },
    {
      to: '/more/debts',
      Icon: Handshake,
      label: 'Долги',
      meta: openDebts
        ? `${openDebts} ${plural(openDebts, 'открытый', 'открытых', 'открытых')}`
        : 'нет',
    },
    {
      to: '/more/categories',
      Icon: SquaresFour,
      label: 'Категории',
      meta: `${data.categories.length} ${plural(data.categories.length, 'категория', 'категории', 'категорий')}`,
    },
    {
      to: '/more/accounts',
      Icon: Wallet,
      label: 'Счета',
      meta: `${data.accounts.length} ${plural(data.accounts.length, 'счёт', 'счёта', 'счетов')}`,
    },
  ]

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Screen title="Ещё">
      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle>Настройки</SectionTitle>
          <Card className="flex flex-col gap-3 p-3">
            {links.map(({ to, Icon, label, meta }) => (
              <Link key={to} to={to} className="flex items-center gap-3 px-1 py-1.5">
                <span className="grid size-9 place-items-center rounded-[var(--r-sm)] bg-surface-2 text-dim">
                  <Icon size={19} />
                </span>
                <span className="flex-1 text-[15px] font-medium">{label}</span>
                <span className="text-[13px] text-faint">{meta}</span>
                <CaretRight size={15} className="text-faint" />
              </Link>
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle>Оформление</SectionTitle>
          <Segmented
            value={data.settings.theme}
            onChange={(theme) => void setTheme(theme)}
            options={[
              { value: 'system', label: 'Как в системе' },
              { value: 'light', label: 'Светлая' },
              { value: 'dark', label: 'Тёмная' },
            ]}
          />
        </section>

        <section>
          <SectionTitle>Бюджетный месяц</SectionTitle>
          <Card>
            <Field
              label="Начинается с числа"
              hint={
                startDay === 1
                  ? 'Обычный календарный месяц: с 1-го по последнее число.'
                  : `Месяц идёт с ${startDay}-го по ${startDay - 1}-е следующего.` +
                    (startDay > 28
                      ? ' В коротких месяцах начало сдвигается на последний день.'
                      : '')
              }
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={startDayText}
                onChange={(e) => typeStartDay(e.target.value)}
                onBlur={() => setStartDayText(String(startDay))}
                className={inputClass}
              />
            </Field>
          </Card>
        </section>

        <section>
          <SectionTitle>Хранение данных</SectionTitle>
          <Card className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)] bg-surface-2 text-dim">
              {mode === 'cloud' ? <CloudCheck size={19} /> : <DeviceMobile size={19} />}
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-medium">
                {mode === 'cloud' ? 'Синхронизация включена' : 'Данные на этом устройстве'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-dim">
                {mode === 'cloud'
                  ? `Вы вошли как ${email}. Записи хранятся в Supabase и доступны с любого устройства.`
                  : 'Записи лежат в памяти браузера. Чтобы открывать их с других устройств, подключите Supabase.'}
              </p>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-2">
          <Button variant="soft" onClick={exportJson}>
            <DownloadSimple size={17} weight="bold" />
            Выгрузить данные в файл
          </Button>

          {data.settings.demo && (
            <Button variant="soft" onClick={() => void clearDemo()}>
              Очистить демонстрационные записи
            </Button>
          )}

          {mode === 'cloud' && (
            <Button variant="ghost" onClick={() => void signOut()}>
              <SignOut size={17} weight="bold" />
              Выйти
            </Button>
          )}
        </section>
      </div>
    </Screen>
  )
}
