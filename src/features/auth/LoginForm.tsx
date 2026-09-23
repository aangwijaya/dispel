import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/errors'
import { parseEmail, parsePassword } from '../../lib/validation'

type Mode = 'signin' | 'signup'

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const parsedEmail = parseEmail(email)
    if (!parsedEmail.ok) {
      setError(parsedEmail.error)
      return
    }

    const parsedPassword = parsePassword(password)
    if (!parsedPassword.ok) {
      setError(parsedPassword.error)
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: parsedEmail.value,
          password: parsedPassword.value,
        })
        if (authError) setError(friendlyAuthError(authError.message))
        return
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: parsedEmail.value,
        password: parsedPassword.value,
      })
      if (authError) {
        setError(friendlyAuthError(authError.message))
        return
      }
      if (!data.session) {
        setNotice('Account created. Check your email to confirm, then sign in.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="flex h-full items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-heading-lg font-semibold tracking-tight text-ink">Dispel</h1>
          <p className="mt-1 text-caption text-faint">Paper trading terminal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-card border border-edge bg-panel p-6 shadow-[inset_0_0_0_1px_var(--line-hairline)]"
        >
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-pill bg-inset p-1">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`h-7 rounded-pill text-caption font-medium transition-colors ${
                mode === 'signin' ? 'bg-panel text-ink shadow-sm' : 'text-faint hover:text-body'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`h-7 rounded-pill text-caption font-medium transition-colors ${
                mode === 'signup' ? 'bg-panel text-ink shadow-sm' : 'text-faint hover:text-body'
              }`}
            >
              Create account
            </button>
          </div>

          <label className="mb-3 block">
            <span className="mb-1 block text-caption text-faint">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              spellCheck={false}
              className="h-9 w-full rounded-md border border-edge bg-canvas px-3 text-body text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              placeholder="you@example.com"
            />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-caption text-faint">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              className="h-9 w-full rounded-md border border-edge bg-canvas px-3 text-body text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              placeholder="At least 8 characters"
            />
          </label>

          {error ? <p className="mb-3 text-caption text-sell">{error}</p> : null}
          {notice ? <p className="mb-3 text-caption text-buy">{notice}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-9 w-full rounded-pill bg-ink text-caption font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-micro text-faint">
          Paper trading only. No real funds are used.
        </p>
      </div>
    </div>
  )
}
