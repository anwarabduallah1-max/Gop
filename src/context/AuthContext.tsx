import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseReady } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  profileError: string | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  profileLoading: false,
  profileError: null,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true)
    setProfileError(null)
    setProfile(null)
    let timeoutId: number | undefined
    try {
      const profileRequest = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Profile request timed out')), 8000)
      })
      const { data, error } = await Promise.race([profileRequest, timeout])
      if (error) throw error
      if (data) setProfile(data as Profile)
      else setProfileError('Your profile could not be found. Please sign out and sign back in.')
    } catch (err) {
      console.error('Profile fetch error:', err)
      setProfileError('We could not load your profile. Check your connection and try again.')
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      setProfileLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  useEffect(() => {
    if (!isSupabaseReady) { setLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((err) => {
      console.error('Auth session error:', err)
      setProfileError('We could not restore your session. Please sign in again.')
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session) {
        setProfile(null)
        setProfileError(null)
        setProfileLoading(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    fetchProfile(user.id).catch(err => {
      if (!cancelled) console.error('Profile loading error:', err)
    })
    return () => { cancelled = true }
  }, [user])

  const signOut = async () => {
    try { await supabase.auth.signOut() } catch (err) { console.error('Sign out error:', err) }
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, profileLoading, profileError, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
