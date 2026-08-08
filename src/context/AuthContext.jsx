import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [perfil, setPerfil] = useState(null) // { nombre, rol }
  const [cargando, setCargando] = useState(true)
  // el rol llega en una segunda consulta: hasta que no esté, no sabemos si es
  // dueño. Sin esto, App.jsx montaba el router con esDueno=false y el <Navigate>
  // mandaba al dueño a /insumos antes de que su rol llegara.
  const [perfilListo, setPerfilListo] = useState(false)
  const [errorPerfil, setErrorPerfil] = useState('')
  const usuarioActual = useRef(null)

  // Trae el perfil (nombre + rol) del usuario logueado
  async function cargarPerfil(userId) {
    usuarioActual.current = userId
    const { data, error } = await supabase
      .from('costeo_perfiles')
      .select('nombre, rol')
      .eq('id', userId)
      .single()
    // descarta respuestas que llegan tarde tras un cambio de usuario o un logout
    if (usuarioActual.current !== userId) return
    if (error) {
      console.error('No se pudo cargar el perfil:', error.message)
      setPerfil(null)
      setErrorPerfil('No pudimos cargar tu perfil. Revisa la conexión y recarga.')
    } else {
      setPerfil(data)
      setErrorPerfil('')
    }
    setPerfilListo(true)
  }

  useEffect(() => {
    // sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
      else setPerfilListo(true)
      setCargando(false)
    })

    // cambios de sesión (login / logout)
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      setSession(session)
      if (session?.user) {
        setPerfilListo(false)
        await cargarPerfil(session.user.id)
      } else {
        usuarioActual.current = null
        setPerfil(null)
        setPerfilListo(true)
      }
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
    perfilListo,
    errorPerfil,
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
