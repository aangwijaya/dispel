import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { LoginForm } from './features/auth/LoginForm'
import { AppShell } from './features/shell/AppShell'

function BootScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas">
      <div className="text-center">
        <p className="text-heading font-semibold tracking-tight text-ink">Swift Trade</p>
        <p className="mt-1 text-caption text-faint">Connecting…</p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session ?? null)
        setBooting(false)
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setBooting(false)
      })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  if (booting) return <BootScreen />
  if (!session) return <LoginForm />

  return <AppShell userId={session.user.id} email={session.user.email ?? ''} />
}
