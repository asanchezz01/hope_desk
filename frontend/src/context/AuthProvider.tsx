// Sessão do usuário (Fase 08).
//
// A fonte de verdade do perfil é `GET /auth/me`, não o corpo do login: papel,
// superuser e `mustChangePassword` podem mudar no servidor durante a sessão, e
// a autorização é sempre do backend. O corpo do login serve apenas para
// preencher a tela sem um round-trip extra.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { api, onSessionExpired, type ApiUser } from '../api/client'
import { clearSession, readSession, saveSession } from '../storage/session-storage'

export const AUTH_QUERY_KEY = ['auth', 'me'] as const

interface AuthContextValue {
  user: ApiUser | null
  isLoading: boolean
  /** `true` enquanto a API exige troca de senha antes de qualquer outra tela. */
  mustChangePassword: boolean
  isClient: boolean
  isTechnician: boolean
  isSuperuser: boolean
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  refreshUser(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [bootstrapped, setBootstrapped] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  const profile = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: api.currentUser,
    enabled: bootstrapped && hasSession,
    // Sessão inválida não se resolve tentando de novo.
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    let active = true
    readSession()
      .then((session) => {
        if (!active) return
        setHasSession(session !== null)
      })
      .finally(() => {
        if (active) setBootstrapped(true)
      })
    return () => {
      active = false
    }
  }, [])

  // O cliente HTTP avisa quando o refresh falhou de vez. Sem isto a UI ficaria
  // presa numa tela autenticada com a sessão já apagada do disco.
  useEffect(
    () =>
      onSessionExpired(() => {
        setHasSession(false)
        queryClient.setQueryData(AUTH_QUERY_KEY, null)
        queryClient.clear()
      }),
    [queryClient]
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password)
      await saveSession({ accessToken: result.accessToken, refreshToken: result.refreshToken })
      setHasSession(true)
      queryClient.setQueryData(AUTH_QUERY_KEY, result.user)
    },
    [queryClient]
  )

  const signOut = useCallback(async () => {
    const session = await readSession()
    // Falha ao revogar no servidor não pode impedir o logout local — caso
    // contrário o usuário fica preso na sessão quando a API está fora do ar.
    if (session) await api.logout(session.refreshToken).catch(() => undefined)
    await clearSession()
    setHasSession(false)
    queryClient.setQueryData(AUTH_QUERY_KEY, null)
    queryClient.clear()
  }, [queryClient])

  const refreshUser = useCallback(async () => {
    await profile.refetch()
  }, [profile])

  const user = profile.data ?? null

  const value: AuthContextValue = {
    user,
    isLoading: !bootstrapped || (hasSession && profile.isLoading),
    mustChangePassword: user?.mustChangePassword ?? false,
    isClient: user?.role === 'client',
    isTechnician: user?.role === 'technician',
    isSuperuser: user?.isSuperuser ?? false,
    signIn,
    signOut,
    refreshUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  return context
}
