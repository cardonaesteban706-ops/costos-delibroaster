import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import { pesos } from '../lib/formato'
import './Tablero.css'

const MARGEN_SANO = 0.30
const DIEZ_MIN = 10 * 60 * 1000

export default function Tablero() {
  const [conteos, setConteos] = useState({})
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [platos, setPlatos] = useState(null) // null = aún no cargado
  const [editando, setEditando] = useState(null)

  useEffect(() => {
    async function c() {
      const [{ count: i }, { count: r }, { count: s }] = await Promise.all([
        supabase.from('costeo_insumos').select('*', { count: 'exact', head: true }),
        supabase.from('costeo_recetas').select('*', { count: 'exact', head: true }).eq('es_subreceta', false),
        supabase.from('costeo_recetas').select('*', { count: 'exact', head: true }).eq('es_subreceta', true),
      ])
      setConteos({ insumos: i, recetas: r, subrecetas: s })
    }
    c()
  }, [])

  // vuelve a bloquear sola a los 10 minutos
  useEffect(() => {
    if (!desbloqueado) return
    const t = setTimeout(() => setDesbloqueado(false), DIEZ_MIN)
    return () => clearTimeout(t)
  }, [desbloqueado])

  async function cargarPlatos() {
    const { data, error } = await supabase.rpc('costeo_tablero')
    if (!error) setPlatos(data || [])
  }

  useEffect(() => { if (desbloqueado) cargarPlatos() }, [desbloqueado])

  const resumen = useMemo(() => {
    if (!platos || platos.length === 0) return { n: 0, margenProm: 0, bajos: 0 }
    const conVenta = platos.filter((p) => p.precio_venta != null)
    const margenProm = conVenta.length
      ? conVenta.reduce((s, p) => s + Number(p.margen || 0), 0) / conVenta.length
      : 0
    const bajos = conVenta.filter((p) => Number(p.margen) < MARGEN_SANO).length
    return { n: platos.length, margenProm, bajos }
  }, [platos])

  return (
    <Layout conteos={conteos}>
      <div className="main-head">
        <div>
          <h1 className="main-title">Tablero de costos</h1>
          <p className="main-sub">Costo, margen y precio sugerido de cada plato.</p>
        </div>
        <div className="head-actions">
          <span className={'lock-banner' + (desbloqueado ? ' abierto' : '')}>
            <span className="lock-dot" />
            {desbloqueado ? 'Costos visibles · sesión de dirección' : 'Zona sensible bloqueada'}
          </span>
          {desbloqueado && <button className="btn btn-ghost" onClick={() => setDesbloqueado(false)}>Bloquear</button>}
        </div>
      </div>

      <div className="blur-wrap" style={{ marginTop: 22 }}>
        <div className={desbloqueado ? '' : 'blur-content'}>
          <div className="resumen-grid">
            <div className="resumen-card">
              <div className="resumen-lbl">Platos en carta</div>
              <div className="resumen-num">{resumen.n}</div>
              <div className="resumen-sub">todos con receta y costo vigente</div>
            </div>
            <div className="resumen-card oscura">
              <div className="resumen-lbl">Margen promedio</div>
              <div className="resumen-num">{Math.round(resumen.margenProm * 100)}%</div>
              <div className="resumen-sub">sobre los platos con precio de venta</div>
            </div>
            <div className={'resumen-card' + (resumen.bajos > 0 ? ' alerta' : '')}>
              <div className="resumen-lbl">Bajo el margen sano</div>
              <div className="resumen-num">{resumen.bajos}</div>
              <div className="resumen-sub">platos por debajo del {Math.round(MARGEN_SANO * 100)}%</div>
            </div>
          </div>

          <div className="platos-head">
            <span className="platos-lbl">Platos · ordenados por margen</span>
            <span className="margen-sano-lbl">Margen sano: ≥ {Math.round(MARGEN_SANO * 100)}%</span>
          </div>

          <div className="platos-grid">
            {(platos || muestra).slice().sort((a, b) => (a.margen ?? -1) - (b.margen ?? -1)).map((p) => (
              <PlatoCard key={p.id ?? p.nombre} plato={p} onEditar={p.id ? () => setEditando(p) : null} />
            ))}
          </div>
        </div>

        {!desbloqueado && (
          <div className="lock-overlay">
            <ClaveForm onOk={() => setDesbloqueado(true)} />
          </div>
        )}
      </div>

      {editando && (
        <PrecioVenta plato={editando} onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargarPlatos() }} />
      )}
    </Layout>
  )
}

// datos de muestra solo para que la pantalla no se vea vacía detrás del blur
const muestra = [
  { nombre: 'Personal #8', categoria: 'Comida china', costo: 21553, precio_venta: 27000, margen: 0.2017, sugerido_40: 35922 },
  { nombre: 'Pollo broaster', categoria: 'Broaster', costo: 27981, precio_venta: 46000, margen: 0.3917, sugerido_40: 46635 },
]

function categoriaMargen(m) {
  if (m == null) return 'ambar'
  if (m < 0) return 'rojo'
  if (m < MARGEN_SANO) return 'ambar'
  return 'verde'
}

function PlatoCard({ plato, onEditar }) {
  const cat = categoriaMargen(plato.margen)
  const pct = plato.margen != null ? Math.round(plato.margen * 100) : null
  const etiqueta = plato.margen == null ? 'sin precio' : cat === 'rojo' ? 'pierde plata' : cat === 'ambar' ? 'ajustado' : 'sano'
  const barra = plato.margen != null ? Math.max(4, Math.min(100, (plato.margen / 0.5) * 100)) : 4

  return (
    <div className={'plato-card ' + cat}>
      <div className="plato-top">
        <div>
          <div className="plato-nombre">{plato.nombre}</div>
          {plato.categoria && <div className="plato-cat">{plato.categoria}</div>}
        </div>
        <div className="plato-margen">
          <div className="pct">{pct != null ? pct + '%' : '—'}</div>
          <div className="tag">{etiqueta}</div>
        </div>
      </div>
      <div className="plato-datos">
        <div><div className="plato-dato-lbl">Costo</div><div className="plato-dato-val">{pesos(plato.costo)}</div></div>
        <div><div className="plato-dato-lbl">Venta</div><div className="plato-dato-val">{plato.precio_venta != null ? pesos(plato.precio_venta) : '—'}</div></div>
        <div><div className="plato-dato-lbl">Sugerido</div><div className="plato-dato-val sugerido">{pesos(plato.sugerido_40)}</div></div>
      </div>
      <div className="plato-bar"><div className="plato-bar-fill" style={{ width: barra + '%' }} /></div>
      {onEditar && <button className="plato-edit" onClick={onEditar}>Precio de venta</button>}
    </div>
  )
}

function ClaveForm({ onOk }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(false)

  async function verificar(e) {
    e.preventDefault()
    setError('')
    setVerificando(true)
    const { data, error } = await supabase.rpc('costeo_verificar_clave', { p_clave: clave })
    setVerificando(false)
    if (error) return setError('No se pudo verificar. Intenta de nuevo.')
    if (!data) { setError('Clave incorrecta.'); setClave(''); return }
    onOk()
  }

  return (
    <form className="lock-card" onSubmit={verificar}>
      <div className="lock-icon">🔒</div>
      <h2 className="lock-title">Zona sensible bloqueada</h2>
      <p className="lock-sub">Costos, márgenes y precios sugeridos solo se ven con la clave de dirección.</p>
      <input
        className="lock-input" type="password" placeholder="Clave de dirección"
        value={clave} onChange={(e) => setClave(e.target.value)} autoFocus
      />
      <button className="lock-btn" type="submit" disabled={verificando || !clave}>
        {verificando ? 'Verificando…' : 'Desbloquear costos'}
      </button>
      {error && <div className="lock-err">{error}</div>}
      <div className="lock-hint">La sesión se vuelve a bloquear a los 10 minutos.</div>
    </form>
  )
}

function PrecioVenta({ plato, onClose, onGuardado }) {
  const [precio, setPrecio] = useState(plato.precio_venta || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setError('')
    if (!precio) return setError('Escribe un precio.')
    setGuardando(true)
    const { error } = await supabase
      .from('costeo_venta')
      .upsert({ receta_id: plato.id, precio_venta: Number(precio) }, { onConflict: 'receta_id' })
    setGuardando(false)
    if (error) return setError(error.message)
    onGuardado()
  }

  const margenProy = precio && plato.costo ? (Number(precio) - plato.costo) / Number(precio) : null

  return (
    <Modal titulo={plato.nombre} subtitulo="Precio de venta al público." onClose={onClose}>
      <div className="f-group">
        <label className="f-label">Precio de venta</label>
        <input className="f-input" type="number" min="0" step="any" value={precio}
          onChange={(e) => setPrecio(e.target.value)} autoFocus />
      </div>
      <div className="calc-box">
        Costo actual: <b>{pesos(plato.costo)}</b> · Sugerido (40% margen): <b>{pesos(plato.sugerido_40)}</b>
        {margenProy != null && <> · Con este precio, margen: <b>{Math.round(margenProy * 100)}%</b></>}
      </div>
      {error && <div className="calc-box" style={{ color: '#8A2417', background: '#F7E4DF', borderColor: '#E6B8AC' }}>{error}</div>}
      <div className="f-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar precio'}
        </button>
      </div>
    </Modal>
  )
}
