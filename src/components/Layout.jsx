import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Layout.css'

function LogoPollo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 30 h40 a20 20 0 0 1 -40 0 z" fill="#3B2A20" />
      <circle cx="25" cy="25" r="3" fill="#3B2A20" />
      <circle cx="39" cy="25" r="3" fill="#3B2A20" />
      <path d="M24 37 q8 7 16 0" stroke="#F6E9D2" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export default function Layout({ conteos, children }) {
  const { perfil, esDueno, salir } = useAuth()
  const navigate = useNavigate()

  async function cerrar() {
    await salir()
    navigate('/')
  }

  const nombre = perfil?.nombre || (esDueno ? 'Dueño' : 'Encargado')
  const iniciales = nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="shell">
      <aside className="side">
        <div className="side-brand">
          <div className="side-logo"><LogoPollo /></div>
          <div>
            <div className="side-name">Delibroaster</div>
            <div className="side-tag">Costos</div>
          </div>
        </div>

        <nav className="side-nav">
          {esDueno && (
            <>
              <div className="side-section">Dirección</div>
              <NavLink to="/tablero" className={({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')}>
                <span className="nav-left"><span className="nav-dot" />Tablero de costos</span>
              </NavLink>
              <NavLink to="/auditoria" className={({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')}>
                <span className="nav-left"><span className="nav-dot" />Auditoría</span>
              </NavLink>
            </>
          )}

          <div className="side-section">Datos</div>
          <NavLink to="/insumos" className={({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')}>
            <span className="nav-left"><span className="nav-dot" />Insumos</span>
            <span className="nav-count">{conteos?.insumos ?? ''}</span>
          </NavLink>
          <NavLink to="/recetas" className={({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')}>
            <span className="nav-left"><span className="nav-dot" />Recetas</span>
            <span className="nav-count">{conteos?.recetas ?? ''}</span>
          </NavLink>
          <NavLink to="/subrecetas" className={({ isActive }) => 'nav-item' + (isActive ? ' activo' : '')}>
            <span className="nav-left"><span className="nav-dot" />Sub-recetas</span>
            <span className="nav-count">{conteos?.subrecetas ?? ''}</span>
          </NavLink>
        </nav>

        <div className="side-foot">
          <div className="side-user">
            <div className="side-avatar">{iniciales}</div>
            <div>
              <div className="side-uname">{nombre}</div>
              <div className="side-urole">{esDueno ? 'Dueño' : 'Encargada/o'}</div>
            </div>
            <button className="side-logout" onClick={cerrar} title="Cerrar sesión">Salir</button>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  )
}
