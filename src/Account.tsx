import { LanguageSelect, useLanguage } from './language'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { accountBoard, supabase } from './supabase'
import type { AccountBoard } from './supabase'

const guestKey = 'nextstep:guest'

export function Account({ children }: {
  children: (board?: AccountBoard, email?: string, signOut?: () => Promise<void>, owner?: string, exitGuest?: () => void) => ReactNode
}) {
  const { t } = useLanguage()
  const [user, setUser] = useState<{ id: string; email?: string } | null>()
  const [guest, setGuest] = useState(() => {
    try {
      return (localStorage.getItem(guestKey) ?? sessionStorage.getItem(guestKey)) === 'true'
    } catch {
      try {
        return sessionStorage.getItem(guestKey) === 'true'
      } catch {
        return false
      }
    }
  })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const client = supabase
  const owner = user?.id
  const board = useMemo(() => client && owner ? accountBoard(client, owner) : undefined, [client, owner])

  useEffect(() => {
    if (!client) return
    const { data } = client.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
      if (session) changeGuest(false)
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  function changeGuest(enabled: boolean) {
    setGuest(enabled)
    try {
      localStorage.setItem(guestKey, String(enabled))
    } catch {
      try {
        sessionStorage.setItem(guestKey, String(enabled))
      } catch {
        // Guest mode still works for the current page.
      }
    }
  }

  if (!client) return children()
  if (user === undefined) return <main role="status">{t('Checking your session…')}</main>
  if (board) return children(board, user?.email, async () => {
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) throw error
  }, owner)
  if (guest) return children(undefined, undefined, undefined, undefined, () => {
    setMode('login')
    changeGuest(false)
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || busy) return
    setBusy(true)
    setMessage('')
    try {
      const credentials = { email: email.trim(), password }
      const { error, data } = mode === 'signup'
        ? await client.auth.signUp({ ...credentials, options: { emailRedirectTo: window.location.origin } })
        : await client.auth.signInWithPassword(credentials)
      if (error) throw error
      setPassword('')
      if (!data.session) setMessage('Check your email for a confirmation link, then sign in.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to connect. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="account-page">
    <div className="account-actions"><LanguageSelect /></div>
    <header className="account-intro">
      <p className="eyebrow"><span className="live-dot" /> {t('Career workspace')}</p>
      <h1>{t('Take your next step')}</h1>
      <p>{t('Keep your opportunities organized and your next steps clear.')}</p>
    </header>
    <form onSubmit={submit} className="account-form" aria-labelledby="account-title">
      <h2 id="account-title">{mode === 'login' ? t('Sign in') : t('Create an account')}</h2>
      <label>{t('Email')}<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
      <label>{t('Password')}<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 6 : undefined} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <button className="primary" disabled={busy}>{mode === 'login' ? t('Sign in') : t('Create account')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => {
        setMode(mode === 'login' ? 'signup' : 'login')
        setMessage('')
      }}>{mode === 'login' ? t('Create an account') : t('Back to sign in')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => {
        setPassword('')
        setMessage('')
        changeGuest(true)
      }}>{t('Continue as guest')}</button>
      <p>{t('Guest applications are saved in this browser.')}</p>
      {message && <p role="status">{t(message)}</p>}
    </form>
  </main>
}
