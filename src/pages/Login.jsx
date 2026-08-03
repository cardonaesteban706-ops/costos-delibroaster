import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

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

export default function Login() {
  const { entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [recordar, setRecordar] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const err = await entrar(email.trim(), password)
    setEnviando(false)
    if (err) {
      setError(
        err.message?.includes('Invalid login')
          ? 'Correo o contraseña incorrectos.'
          : 'No se pudo entrar. Intenta de nuevo.'
      )
    }
    // si entra bien, el AuthContext cambia la sesión y App.jsx redirige solo
  }

  return (
    <div className="login">
      <section className="login-hero">
        <div className="brand">
          <div className="brand-logo"><LogoPollo /></div>
          <div>
            <div className="brand-name">Delibroaster</div>
            <div className="brand-sub">Pollo broaster &amp; comida china</div>
          </div>
        </div>

        <div className="hero-body">
          <h1 className="hero-title">El costo de<br />cada plato,<br />al día.</h1>
          <p className="hero-copy">
            Cambias el precio de un insumo y todos los platos se recalculan solos.
            Sin fórmulas rotas, sin archivos viejos.
          </p>
        </div>

        <div className="hero-stats">
          <div><div className="stat-num">104</div><div className="stat-lab">insumos</div></div>
          <div><div className="stat-num">2</div><div className="stat-lab">platos</div></div>
          <div><div className="stat-num">6</div><div className="stat-lab">sub-recetas</div></div>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-form" onSubmit={onSubmit}>
          <h2 className="form-title">Bienvenido de vuelta</h2>
          <p className="form-sub">Ingresa con tu correo del restaurante.</p>

          <div className="field">
            <label className="field-label" htmlFor="email">Correo</label>
            <input
              id="email" className="field-input" type="email" autoComplete="email"
              placeholder="marcela@delibroaster.co"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pass">Contraseña</label>
            <input
              id="pass" className="field-input" type="password" autoComplete="current-password"
              placeholder="••••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>

          <div className="form-row">
            <label className="remember">
              <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
              Recordarme en este equipo
            </label>
            <a className="forgot" href="#" onClick={(e) => e.preventDefault()}>¿Olvidaste la clave?</a>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="submit" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar a la cocina'}
          </button>

          <div className="form-divider">uso interno</div>
          <p className="form-foot">
            ¿Problemas para entrar? Escríbele a administración.<br />
            Delibroaster S.A.S. · Cali, Colombia
          </p>
        </form>
      </section>
    </div>
  )
}
