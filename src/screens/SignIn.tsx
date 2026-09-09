import { useState } from 'react'
import { GoogleLogo, Wallet } from '@phosphor-icons/react'
import { supabase } from '../data/supabase'
import { Button, Field, inputClass } from '../components/ui'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const redirectTo = window.location.origin + import.meta.env.BASE_URL

  const withGoogle = async () => {
    setError(null)
    setBusy(true)
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  const withPassword = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase!.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        })
        if (error) throw error
        setNotice('Проверьте почту и подтвердите адрес, чтобы войти.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="mx-auto flex min-h-[100dvh] max-w-[420px] flex-col justify-center gap-7 px-6"
      style={{
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex flex-col gap-3">
        <span className="grid size-12 place-items-center rounded-[var(--r-md)] bg-accent text-accent-ink">
          <Wallet size={24} weight="fill" />
        </span>
        <h1 className="text-[30px] leading-[1.1] font-bold tracking-[-0.03em]">
          Ваши финансы,
          <br />
          на всех устройствах
        </h1>
        <p className="text-[14.5px] leading-relaxed text-dim">
          Войдите один раз. Дальше приложение будет открываться сразу на обзоре.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={() => void withGoogle()} disabled={busy}>
          <GoogleLogo size={19} weight="bold" />
          Войти через Google
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[12px] text-faint">или по почте</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Field label="Почта">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>

        <Field label="Пароль" hint={mode === 'up' ? 'Минимум 6 символов' : undefined}>
          <input
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error && (
          <p className="rounded-[var(--r-sm)] bg-neg-soft px-3 py-2 text-[13px] text-neg">{error}</p>
        )}
        {notice && (
          <p className="rounded-[var(--r-sm)] bg-pos-soft px-3 py-2 text-[13px] text-pos">
            {notice}
          </p>
        )}

        <Button
          variant="soft"
          onClick={() => void withPassword()}
          disabled={busy || !email || password.length < 6}
        >
          {mode === 'in' ? 'Войти' : 'Создать аккаунт'}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
          className="py-1 text-[13px] font-medium text-dim"
        >
          {mode === 'in' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
      </div>
    </div>
  )
}
