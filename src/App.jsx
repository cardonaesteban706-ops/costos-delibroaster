import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Insumos from './pages/Insumos'
import Recetas from './pages/Recetas'
import SubRecetas from './pages/SubRecetas'
import Tablero from './pages/Tablero'
import Auditoria from './pages/Auditoria'

const pantallaCentrada = {
  minHeight: '100vh', display: 'grid', placeItems: 'center',
  background: 'var(--cream)', padding: 24, textAlign: 'center',
}

export default function App() {
  const { session, cargando, perfilListo, errorPerfil, esDueno } = useAuth()

  // esperamos también al rol: si montamos el router sin él, el catch-all manda
  // al dueño a /insumos con replace y ya no hay forma de volver al tablero.
  if (cargando || (session && !perfilListo)) {
    return (
      <div style={pantallaCentrada}>
        <div style={{ color: 'var(--ink-soft)' }}>Cargando…</div>
      </div>
    )
  }

  if (!session) return <Login />

  if (errorPerfil) {
    return (
      <div style={pantallaCentrada}>
        <div>
          <p style={{ color: 'var(--ink)', marginBottom: 14 }}>{errorPerfil}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/insumos" element={<Insumos />} />
        <Route path="/recetas" element={<Recetas />} />
        <Route path="/subrecetas" element={<SubRecetas />} />
        {esDueno && <Route path="/tablero" element={<Tablero />} />}
        {esDueno && <Route path="/auditoria" element={<Auditoria />} />}
        <Route path="*" element={<Navigate to={esDueno ? '/tablero' : '/insumos'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
