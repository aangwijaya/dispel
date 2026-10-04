import { useState, type FormEvent } from 'react'
import { useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/errors'
import { signInWithGoogle } from '../../lib/google'
import { parseEmail, parsePassword } from '../../lib/validation'
import { MARKETS } from '../../lib/markets'
import { formatPercent, formatPrice } from '../../lib/market/format'
import { getConnectionStatus, subscribeConnectionStatus, type DisplayStatus } from '../../lib/market/stream'
import { useTickers } from '../trading/useTickers'
import { STANCE_COLOR, regimeAt } from '../../lib/read/demo'
import { useMarketRead } from '../home/useMarketRead'
import { DispelMark } from '../shell/nav'
import { Sigil } from '../../components/Sigil'

type Mode = 'signin' | 'signup'

const STATUS_LABEL: Record<DisplayStatus, string> = {
  connected: 'Markets live',
  connecting: 'Connecting',
  disconnected: 'Offline',
  idle: 'Idle',
}

/** The mock draws the sign-in arc from -35° to 48°; 40 + 1.2 × 36 ≈ 83°. */
const SIGNIN_SIGIL_STRENGTH = 36

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const status = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus)
  const marketRead = useMarketRead({ positions: [], marks: {}, trackSeen: false })
  const read = marketRead.read
  const tickers = useTickers(MARKETS.map((market) => market.symbol))
  const regime = regimeAt(read.regimeIndex)

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

  async function handleGoogle() {
    setError(null)
    setNotice(null)
    setGoogleBusy(true)
    try {
      const result = await signInWithGoogle()
      if (!result.ok) setError(result.error)
    } finally {
      setGoogleBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="login">
      <div className="l-top">
        <span className="logo">
          <DispelMark />
          Dispel
        </span>
        <span className="mono">
          <span className="live">
            <i style={status === 'connected' ? undefined : { background: 'var(--caution)' }} />
            {STATUS_LABEL[status]}
          </span>
          <span className="ver"> · v0.1.6</span>
        </span>
      </div>

      <main className="l-main">
        <div className="thesis">
          <h2>
            Markets are full of illusions.
            <span>Dispel them before you trade.</span>
          </h2>
        </div>

        <div className="core">
          <Sigil mood="favorable" size={1040} strength={SIGNIN_SIGIL_STRENGTH} className="core-art" />
          <div className="box">
            <form className="auth" onSubmit={handleSubmit} noValidate>
              <h3>{mode === 'signin' ? 'Sign in to Dispel' : 'Create your account'}</h3>
              <p className="sub">
                {mode === 'signin'
                  ? 'Paper trading with live market prices.'
                  : 'Start with 10,000 USDT in paper funds.'}
              </p>

              <button
                type="button"
                className="google"
                onClick={() => void handleGoogle()}
                disabled={googleBusy || submitting}
              >
                <GoogleG />
                {googleBusy ? 'Connecting…' : 'Continue with Google'}
              </button>

              <div className="or" aria-hidden="true">
                or
              </div>

              <label className="field">
                <span>Email</span>
                <div className="input">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="you@example.com"
                    aria-invalid={error !== null}
                  />
                </div>
              </label>

              <label className="field">
                <span>Password</span>
                <div className="input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="At least 8 characters"
                    aria-invalid={error !== null}
                  />
                  <button
                    type="button"
                    className="show"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {mode === 'signup' ? (
                <div className="hint">Use 8 or more characters. You'll confirm your email before signing in.</div>
              ) : null}

              {error ? (
                <div className="msg msg-err" role="alert">
                  <i />
                  <span>{error}</span>
                </div>
              ) : null}
              {notice ? (
                <div className="msg msg-ok" role="status">
                  <i />
                  <span>{notice}</span>
                </div>
              ) : null}

              <button type="submit" className="primary" disabled={submitting}>
                <span>{submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}</span>
                <kbd>↵</kbd>
              </button>

              <p className="switch">
                {mode === 'signin' ? 'New to Dispel? ' : 'Already have an account? '}
                <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                  {mode === 'signin' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            </form>
          </div>
        </div>

        <div className="today" aria-label="Today's market read">
          <span className="dot" style={{ background: STANCE_COLOR[read.stance] }} aria-hidden="true" />
          <b>{read.verdict}</b>
          <span>{regime.name}</span>
          <span className="mono">· {read.time}</span>
        </div>
      </main>

      <div className="tape" aria-label="Live prices">
        {MARKETS.slice(0, 5).map((market) => {
          const ticker = tickers[market.symbol]
          const change = ticker?.changePercent
          const up = change === null || change === undefined ? null : Number(change) >= 0
          return (
            <span key={market.symbol}>
              {market.baseAsset}
              <b>{ticker ? formatPrice(ticker.lastPrice, market.pricePrecision) : '—'}</b>
              {up === null ? (
                <em className="flat">—</em>
              ) : (
                <em className={up ? 'up' : 'down'}>{formatPercent(change)}</em>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
