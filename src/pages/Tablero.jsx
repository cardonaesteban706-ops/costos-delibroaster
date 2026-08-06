import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import RecetaEditor from '../components/RecetaEditor'
import { pesos } from '../lib/formato'
import './Tablero.css'

const MARGEN_SANO = 0.30
const MARGEN_PROMO_DEFAULT = 40 // %

export default function Tablero() {
  const [conteos, setConteos] = useState({})
  const [platos, setPlatos] = useState(null) // null = aún no cargado
  const [editando, setEditando] = useState(null)
  const [editandoReceta, setEditandoReceta] = useState(null) // receta completa a editar
  const [busqueda, setBusqueda] = useState('')
  const [mostrarPromos, setMostrarPromos] = useState(false)
  const [margenObjetivo, setMargenObjetivo] = useState(MARGEN_PROMO_DEFAULT) // en %

  // trae la receta completa (con es_subreceta, categoria, etc.) y abre el editor
  async function abrirReceta(platoId) {
    const { data } = await supabase
      .from('costeo_recetas')
      .select('id, nombre, categoria, es_subreceta, rinde_cant, rinde_unidad, porciones_lote')
      .eq('id', platoId)
      .single()
    if (data) setEditandoReceta(data)
  }

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

  async function cargarPlatos() {
    const { data, error } = await supabase.rpc('costeo_tablero')
    if (!error) setPlatos(data || [])
  }

  useEffect(() => { cargarPlatos() }, [])

  const resumen = useMemo(() => {
    if (!platos || platos.length === 0) return { n: 0, margenProm: 0, bajos: 0 }
    const conVenta = platos.filter((p) => p.precio_venta != null)
    const margenProm = conVenta.length
      ? conVenta.reduce((s, p) => s + Number(p.margen || 0), 0) / conVenta.length
      : 0
    const bajos = conVenta.filter((p) => Number(p.margen) < MARGEN_SANO).length
    return { n: platos.length, margenProm, bajos }
  }, [platos])

  const platosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = platos || []
    if (!q) return base
    return base.filter((p) =>
      p.nombre.toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q)
    )
  }, [platos, busqueda])

  // candidatos a promoción: platos con precio de venta y margen actual por encima
  // del margen objetivo -> tienen espacio para bajar el precio y seguir dejando ese margen.
  const candidatosPromo = useMemo(() => {
    const objetivo = Number(margenObjetivo) / 100
    if (!platos || !objetivo || objetivo <= 0 || objetivo >= 1) return []
    return platos
      .filter((p) => p.precio_venta != null && p.margen != null && p.margen > objetivo)
      .map((p) => {
        const precioPromo = Math.ceil((p.costo / (1 - objetivo)) / 100) * 100
        const rebaja = p.precio_venta - precioPromo
        return { ...p, precioPromo, rebaja, rebajaPct: rebaja / p.precio_venta }
      })
      .sort((a, b) => b.rebajaPct - a.rebajaPct)
  }, [platos, margenObjetivo])

  return (
    <Layout conteos={conteos}>
      <div className="main-head">
        <div>
          <h1 className="main-title">Tablero de costos</h1>
          <p className="main-sub">Costo, margen y precio sugerido de cada plato.</p>
        </div>
        <div className="head-actions">
          <button className={'btn' + (mostrarPromos ? ' btn-primary' : ' btn-ghost')}
            onClick={() => setMostrarPromos((v) => !v)}>
            🏷️ Promociones
          </button>
        </div>
      </div>

      {mostrarPromos && (
        <PromoPanel
          margenObjetivo={margenObjetivo}
          setMargenObjetivo={setMargenObjetivo}
          candidatos={candidatosPromo}
          onEditar={(p) => setEditando(p)}
        />
      )}

      <div style={{ marginTop: 22 }}>
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

        <div className="toolbar">
          <div className="search">
            <span className="lupa">⌕</span>
            <input
              type="text" placeholder="Buscar plato… (nombre o categoría)"
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="platos-head">
          <span className="platos-lbl">Platos · ordenados por margen{busqueda ? ` · ${platosFiltrados.length} resultado(s)` : ''}</span>
          <span className="margen-sano-lbl">Margen sano: ≥ {Math.round(MARGEN_SANO * 100)}%</span>
        </div>

        {platos && platosFiltrados.length === 0 ? (
          <div className="vacio">
            <div className="vacio-emoji">🔍</div>
            No hay platos que coincidan con "{busqueda}".
          </div>
        ) : (
          <div className="platos-grid">
            {platosFiltrados.slice().sort((a, b) => (a.margen ?? -1) - (b.margen ?? -1)).map((p) => (
              <PlatoCard key={p.id ?? p.nombre} plato={p}
                onEditar={p.id ? () => setEditando(p) : null}
                onVerReceta={p.id ? () => abrirReceta(p.id) : null} />
            ))}
          </div>
        )}
      </div>

      {editando && (
        <PrecioVenta plato={editando} onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); cargarPlatos() }} />
      )}

      {editandoReceta && (
        <RecetaEditor
          receta={editandoReceta}
          esSub={editandoReceta.es_subreceta}
          onClose={() => setEditandoReceta(null)}
          onGuardado={() => { setEditandoReceta(null); cargarPlatos() }}
        />
      )}
    </Layout>
  )
}

function categoriaMargen(m) {
  if (m == null) return 'ambar'
  if (m < 0) return 'rojo'
  if (m < MARGEN_SANO) return 'ambar'
  return 'verde'
}

function PlatoCard({ plato, onEditar, onVerReceta }) {
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
      {plato.porciones_lote && (
        <div className="plato-lote-hint">Costo del lote ÷ {Math.round(plato.porciones_lote)} porciones</div>
      )}
      <div className="plato-bar"><div className="plato-bar-fill" style={{ width: barra + '%' }} /></div>
      <div className="plato-acciones">
        {onVerReceta && <button className="plato-edit ghost" onClick={onVerReceta}>Ver receta</button>}
        {onEditar && <button className="plato-edit" onClick={onEditar}>Precio de venta</button>}
      </div>
    </div>
  )
}

function PromoPanel({ margenObjetivo, setMargenObjetivo, candidatos, onEditar }) {
  return (
    <div className="promo-panel">
      <div className="promo-head">
        <div>
          <div className="promo-title">Candidatos a promoción</div>
          <div className="promo-sub">Platos con margen actual por encima del objetivo — hay espacio para bajar el precio y seguir dejando ese margen.</div>
        </div>
        <div className="promo-control">
          <label className="f-label" style={{ marginBottom: 4 }}>Margen objetivo</label>
          <div className="promo-input-wrap">
            <input type="number" min="1" max="90" value={margenObjetivo}
              onChange={(e) => setMargenObjetivo(e.target.value)} />
            <span>%</span>
          </div>
        </div>
      </div>

      {candidatos.length === 0 ? (
        <div className="promo-vacio">Ningún plato tiene hoy margen por encima del {margenObjetivo}% con ese precio de venta.</div>
      ) : (
        <div className="promo-list">
          {candidatos.map((p) => (
            <div className="promo-row" key={p.id}>
              <div className="promo-nombre">
                {p.nombre}
                <span className="promo-margen-actual">margen actual: {Math.round(p.margen * 100)}%</span>
              </div>
              <div className="promo-precios">
                <span className="promo-actual">{pesos(p.precio_venta)}</span>
                <span className="promo-flecha">→</span>
                <span className="promo-nuevo">{pesos(p.precioPromo)}</span>
              </div>
              <div className="promo-rebaja">
                -{Math.round(p.rebajaPct * 100)}% <span>({pesos(p.rebaja)})</span>
              </div>
              <button className="plato-edit ghost" onClick={() => onEditar({ ...p, precio_venta: p.precioPromo })}>Aplicar precio</button>
            </div>
          ))}
        </div>
      )}
    </div>
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
