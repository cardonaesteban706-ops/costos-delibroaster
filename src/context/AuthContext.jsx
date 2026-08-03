import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null) // { nombre, rol }
  const [cargando, setCargando] = useState(true)

  // Trae el perfil (nombre + rol) del usuario logueado
  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from('costeo_perfiles')
      .select('nombre, rol')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('No se pudo cargar el perfil:', error.message)
      setPerfil(null)
    } else {
      setPerfil(data)
    }
  }

  useEffect(() => {
    // sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
      setCargando(false)
    })

    // cambios de sesión (login / logout)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
      else setPerfil(null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function entrar(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function salir() {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    perfil,
    cargando,
    esDueno: perfil?.rol === 'dueno',
    esEncargado: perfil?.rol === 'encargado',
    entrar,
    salir,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
