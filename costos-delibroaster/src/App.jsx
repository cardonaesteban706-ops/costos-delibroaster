import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Insumos from './pages/Insumos'
import Recetas from './pages/Recetas'
import SubRecetas from './pages/SubRecetas'
import Tablero from './pages/Tablero'

export default function App() {
  const { session, cargando, esDueno } = useAuth()

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--cream)' }}>
        <div style={{ color: 'var(--ink-soft)' }}>Cargando…</div>
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/insumos" element={<Insumos />} />
        <Route path="/recetas" element={<Recetas />} />
        <Route path="/subrecetas" element={<SubRecetas />} />
        {esDueno && <Route path="/tablero" element={<Tablero />} />}
        <Route path="*" element={<Navigate to={esDueno ? '/tablero' : '/insumos'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
