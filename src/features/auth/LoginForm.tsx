import { useState, type FormEvent } from 'react'
import { useSyncExternalStore } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/errors'
import { parseEmail, parsePassword } from '../../lib/validation'
import { MARKETS } from '../../lib/markets'
import { formatPercent, formatPrice } from '../../lib/market/format'
import { getConnectionStatus, subscribeConnectionStatus, type DisplayStatus } from '../../lib/market/stream'
import { useTickers } from '../trading/useTickers'
import { TONE_COLOR, regimeAt } from '../../lib/read/demo'
import { useMarketRead } from '../home/useMarketRead'
import { DispelMark } from '../shell/nav'
import heroArt from '../../assets/dispel-hero.svg'

type Mode = 'signin' | 'signup'

const STATUS_LABEL: Record<DisplayStatus, string> = {
  connected: 'Markets live',
  connecting: 'Connecting',
  disconnected: 'Offline',
  idle: 'Idle',
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="login">
      <img className="art" src={heroArt} alt="" aria-hidden="true" />
      <div className="scrim" />

      <div className="l-top">
        <span className="logo">
          <DispelMark />
          Dispel
        </span>
        <div className="r">
          <span className="mono">v0.1.0</span>
          <span className="pill">
            <i style={status === 'connected' ? undefined : { background: 'var(--caution)' }} />
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="l-body">
        <section className="pitch">
          <span className="eyebrow">Paper trading terminal</span>
          <h3>
            See the market clearly <em>before you trade it.</em>
          </h3>
          <p>
            Dispel reads the market for you: its mood, the setups worth a look, and what to be careful of.
            Practise on live prices with paper funds. No real money, ever.
          </p>
          <div className="teaser" aria-label="Today's market read preview (demo design data)">
            <div>
              <div className="k">Market read</div>
              <div className="v">
                <span className="dot" style={{ background: TONE_COLOR[read.biasTone] }} />
                {read.verdict}
              </div>
            </div>
            <div>
              <div className="k">Regime</div>
              <div className="v">{regime.name}</div>
            </div>
            <div>
              <div className="k">Worth a look</div>
              <div className="v">
                {read.setups.length} setups{' '}
                <svg viewBox="0 0 64 20" aria-hidden="true">
                  <polyline
                    points="0,16 8,14 16,15 24,11 32,12 40,8 48,9 56,5 64,4"
                    fill="none"
                    stroke="#59d499"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="t-note">Today · {read.time} · sign in to see the full read</div>
        </section>

        <form className="auth" onSubmit={handleSubmit} noValidate>
          <h4>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h4>
          <p className="sub">
            {mode === 'signin'
              ? 'Sign in to your paper trading account.'
              : 'Start with 10,000 USDT in paper funds.'}
          </p>

          <div className="seg" role="group" aria-label="Account mode">
            <button
              type="button"
              aria-pressed={mode === 'signin'}
              onClick={() => switchMode('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === 'signup'}
              onClick={() => switchMode('signup')}
            >
              Create account
            </button>
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

          {error ? <div className="msg err">{error}</div> : null}
          {notice ? <div className="msg ok">{notice}</div> : null}

          <button type="submit" className="primary" disabled={submitting}>
            <span>
              {submitting ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </span>
            <kbd>↵</kbd>
          </button>

          <div className="fine">
            <div>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="7" width="10" height="7" rx="1.5" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
              Paper trading only. No real funds, exchange keys or wallets.
            </div>
            <div>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M2 8h2.5l1.5-4 2.5 8 1.5-4H14" />
              </svg>
              Live public prices from Binance.
            </div>
          </div>
        </form>
      </div>

      <div className="tape" aria-hidden="true">
        <div className="tape-track">
          {[...MARKETS, ...MARKETS].map((market, index) => {
            const ticker = tickers[market.symbol]
            const change = ticker?.changePercent
            return (
              <span key={`${market.symbol}-${index}`}>
                {market.displayName}
                <b>{ticker ? formatPrice(ticker.lastPrice, market.pricePrecision) : '—'}</b>
                {change ? (
                  <span style={{ color: `var(${Number(change) >= 0 ? '--up' : '--down'})` }}>
                    {formatPercent(change)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--smoke)' }}>—</span>
                )}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
