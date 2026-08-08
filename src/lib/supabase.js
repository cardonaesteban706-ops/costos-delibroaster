import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Faltan las variables de Supabase. Revisa el archivo .env.local (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).'
  )
}

// "Recordarme en este equipo": si el usuario lo desmarca, la sesión vive en
// sessionStorage y muere al cerrar el navegador. Antes la casilla no hacía nada
// y la sesión quedaba siempre en localStorage — en el celular compartido de la
// cocina, el siguiente turno entraba con la sesión del anterior.
const RECORDAR = 'costeo.recordar'

export function recordarSesion(valor) {
  localStorage.setItem(RECORDAR, valor ? 'si' : 'no')
}

function almacen() {
  return localStorage.getItem(RECORDAR) === 'no' ? sessionStorage : localStorage
}

const storage = {
  getItem: (k) => almacen().getItem(k),
  setItem: (k, v) => almacen().setItem(k, v),
  // al cerrar sesión limpiamos los dos, sin importar dónde quedó guardada
  removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k) },
}

export const supabase = createClient(url, key, {
  auth: { storage, persistSession: true, autoRefreshToken: true },
})
