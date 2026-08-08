import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Icono from '../components/Icono'
import { pesos, presentacionLegible, iniciales, UNIDADES_COMPRA, NOMBRE_BASE, redondea, haceTiempo, frescuraPrecio } from '../lib/formato'
import './Insumos.css'

export default function Insumos() {
  const { esDueno } = useAuth()
  const [insumos, setInsumos] = useState([])
  const [conteos, setConteos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [ordenAntiguos, setOrdenAntiguos] = useState(false)
  const [editando, setEditando] = useState(null)   // insumo a editar
  const [creando, setCreando] = useState(false)
  const [eliminando, setEliminando] = useState(null)  // insumo a eliminar
  const [verEnPlatos, setVerEnPlatos] = useState(null)  // insumo a ver en platos
  const [toast, setToast] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')

  async function cargar() {
    setCargando(true)
    setErrorCarga('')
    const { data, error } = await supabase.from('costeo_insumos').select('*').order('nombre')
    // sin esto, un fallo de red se veía igual que "no hay insumos" e invitaba
    // a volver a crearlos todos duplicados.
    if (error) {
      setErrorCarga(error.message || 'No pudimos cargar los insumos.')
      setCargando(false)
      return
    }
    setInsumos(data || [])
    const [{ count: nRec }, { count: nSub }] = await Promise.all([
      supabase.from('costeo_recetas').select('*', { count: 'exact', head: true }).eq('es_subreceta', false),
      supabase.from('costeo_recetas').select('*', { count: 'exact', head: true }).eq('es_subreceta', true),
    ])
    setConteos({ insumos: (data || []).length, recetas: nRec, subrecetas: nSub })
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    let lista = q ? insumos.filter((i) => i.nombre.toLowerCase().includes(q)) : insumos
    if (ordenAntiguos) {
      lista = [...lista].sort((a, b) => new Date(a.actualizado_en || 0) - new Date(b.actualizado_en || 0))
    }
    return lista
  }, [insumos, busqueda, ordenAntiguos])

  function mostrarToast(msg, platos) {
    setToast({ msg, platos })
    setTimeout(() => setToast(null), 4200)
  }

  return (
    <Layout conteos={conteos}>
      <div className="main-head">
        <div>
          <h1 className="main-title">Actualizar precios</h1>
          <p className="main-sub">Cambia el precio de compra y los platos se recalculan solos.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setCreando(true)}>+ Nuevo insumo</button>
        </div>
      </div>

      {!esDueno && (
        <div className="aviso">
          <span className="cand"><Icono nombre="candado" size={16} /></span>
          Esta vista no muestra costos de plato, márgenes ni precios de venta. Solo precios de compra.
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <span className="lupa"><Icono nombre="buscar" size={18} /></span>
          <input
            type="text" aria-label="Buscar insumo" placeholder="Buscar insumo… (tomate, aceite, pollo)"
            value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <button
          className={'btn' + (ordenAntiguos ? ' btn-primary' : ' btn-ghost')}
          onClick={() => setOrdenAntiguos((v) => !v)}
          title="Ordenar por los que más tiempo llevan sin actualizar precio"
        >
          <Icono nombre="reloj" size={16} /> Más antiguos primero
        </button>
      </div>

      <div className="count-row">
        <span className="count-lbl">{filtrados.length} insumos</span>
      </div>

      {cargando ? (
        <div className="vacio">Cargando insumos…</div>
      ) : errorCarga ? (
        <div className="f-error" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>No pudimos cargar los insumos: {errorCarga}</span>
          <button className="btn btn-ghost" style={{ height: 36 }} onClick={cargar}>Reintentar</button>
        </div>
      ) : filtrados.length === 0 && busqueda ? (
        <div className="vacio">
          <div className="vacio-emoji"><Icono nombre="buscar" size={38} /></div>
          Nada por aquí con “{busqueda}”. Prueba con otro nombre.
        </div>
      ) : filtrados.length === 0 ? (
        <div className="vacio">
          <div className="vacio-emoji"><Icono nombre="olla" size={38} /></div>
          Todavía no hay insumos. Crea el primero con “+ Nuevo insumo”.
        </div>
      ) : (
        filtrados.map((i) => (
          <div className="ins-card" key={i.id}>
            <div className="ins-avatar">{iniciales(i.nombre)}</div>
            <div className="ins-info">
              <div className="ins-name">{i.nombre}</div>
              <div className="ins-meta">
                <span>{presentacionLegible(Number(i.presentacion_cant), i.unidad_base)} · presentación</span>
                {Number(i.merma_pct) > 0 && <span className="chip-merma">merma {Math.round(i.merma_pct * 100)}%</span>}
                <span className={'chip-fecha ' + frescuraPrecio(i.actualizado_en)}>
                  {frescuraPrecio(i.actualizado_en) === 'viejo' && <Icono nombre="alerta" size={12} />}
                  precio {haceTiempo(i.actualizado_en) || 'sin registro'}
                </span>
              </div>
            </div>
            <div className="ins-price">
              <div className="val">{pesos(i.presentacion_precio)}</div>
              <div className="lbl">por presentación</div>
            </div>
            <div className="ins-actions">
              <button className="ins-edit" onClick={() => setEditando(i)}>Editar</button>
              <button className="ins-edit ghost" onClick={() => setVerEnPlatos(i)} title="Ver en platos">
                <Icono nombre="buscar" size={16} />
              </button>
              <button className="ins-delete" onClick={() => setEliminando(i)} title="Eliminar insumo">
                <Icono nombre="papelera" size={16} />
              </button>
            </div>
          </div>
        ))
      )}

      {editando && (
        <EditarPrecio
          insumo={editando}
          onClose={() => setEditando(null)}
          onGuardado={(nPlatos) => {
            setEditando(null)
            cargar()
            mostrarToast('Precio al día', nPlatos)
          }}
        />
      )}

      {creando && (
        <CrearInsumo
          onClose={() => setCreando(false)}
          onCreado={() => { setCreando(false); cargar(); mostrarToast('Insumo anotado', null) }}
        />
      )}

      {eliminando && (
        <EliminarInsumo
          insumo={eliminando}
          onClose={() => setEliminando(null)}
          onEliminado={() => { setEliminando(null); cargar(); mostrarToast('Insumo eliminado', null) }}
        />
      )}

      {verEnPlatos && (
        <VerEnPlatos
          insumo={verEnPlatos}
          onClose={() => setVerEnPlatos(null)}
        />
      )}

      {toast && (
        <div className="toast">
          <span className="ok"><Icono nombre="check" size={16} /></span>
          {toast.msg}
          {toast.platos != null && toast.platos > 0 && <> · <b>{toast.platos}</b> {toast.platos === 1 ? 'plato recalculado' : 'platos recalculados'}</>}
        </div>
      )}
    </Layout>
  )
}

/* ---------- editar precio de un insumo ---------- */
function EditarPrecio({ insumo, onClose, onGuardado }) {
  const opciones = UNIDADES_COMPRA[insumo.unidad_base]
  const [nombre, setNombre] = useState(insumo.nombre)
  const [precio, setPrecio] = useState(insumo.presentacion_precio)
  const [merma, setMerma] = useState(insumo.merma_pct ? redondea(Number(insumo.merma_pct) * 100) : '')
  const [cantCompra, setCantCompra] = useState(() => {
    // si ya sabemos en qué unidad se compró, la respetamos tal cual
    if (insumo.unidad_compra) {
      const o = opciones.find((op) => op.u === insumo.unidad_compra)
      if (o) return redondea(insumo.presentacion_cant / o.factor)
    }
    // fallback para insumos viejos sin unidad_compra guardada: adivina con este umbral
    const kg = opciones.find((o) => o.u === 'kg')
    const l = opciones.find((o) => o.u === 'l')
    if (kg && insumo.presentacion_cant >= 1000) return redondea(insumo.presentacion_cant / 1000)
    if (l && insumo.presentacion_cant >= 1000) return redondea(insumo.presentacion_cant / 1000)
    return redondea(insumo.presentacion_cant)
  })
  const [unidad, setUnidad] = useState(() => {
    if (insumo.unidad_compra && opciones.some((o) => o.u === insumo.unidad_compra)) {
      return insumo.unidad_compra
    }
    if (insumo.presentacion_cant >= 1000 && (insumo.unidad_base === 'g' || insumo.unidad_base === 'ml')) {
      return insumo.unidad_base === 'g' ? 'kg' : 'l'
    }
    return insumo.unidad_base
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const factor = opciones.find((o) => o.u === unidad)?.factor || 1
  const cantBase = Number(cantCompra) * factor
  const mermaFrac = Math.min(Math.max(Number(merma) || 0, 0), 99) / 100
  const costoUnit = cantBase > 0 ? precio / cantBase / (1 - mermaFrac) : 0

  async function guardar() {
    setError('')
    if (!nombre.trim()) { setError('Ponle un nombre al insumo.'); return }
    // la BD ahora exige presentacion_precio > 0; validamos aquí para dar un
    // mensaje claro en vez de dejar salir el error crudo de Postgres en inglés.
    if (!(cantBase > 0)) { setError('La cantidad debe ser mayor que cero.'); return }
    if (!(Number(precio) > 0)) { setError('El precio debe ser mayor que cero.'); return }
    setGuardando(true)
    const { error: e } = await supabase
      .from('costeo_insumos')
      .update({
        nombre: nombre.trim(), presentacion_precio: Number(precio), presentacion_cant: cantBase,
        merma_pct: mermaFrac, unidad_compra: unidad,
        // guardar = "revisé este precio hoy", aunque no haya cambiado. El trigger
        // solo toca actualizado_en cuando el valor cambia, así que confirmar un
        // precio que sigue igual nunca lograba quitarle el chip rojo de "viejo".
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', insumo.id)
    if (e) {
      setGuardando(false)
      setError(e.message?.includes('duplicate') ? 'Ya existe un insumo con ese nombre.' : 'No se pudo guardar. Revisa la conexión e intenta otra vez.')
      return
    }
    const { data: n } = await supabase.rpc('costeo_platos_afectados', { p_insumo: insumo.id })
    setGuardando(false)
    onGuardado(n ?? 0)
  }

  return (
    <Modal titulo={nombre || insumo.nombre} subtitulo="Actualiza el nombre, la presentación, el precio y la merma." onClose={onClose}>
      <div className="f-group">
        <label className="f-label" htmlFor="ep-nombre">Nombre</label>
        <input id="ep-nombre" className="f-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>

      <div className="f-group">
        <label className="f-label" htmlFor="ep-cant">¿Cómo lo compras?</label>
        <div className="f-row">
          <input id="ep-cant" className="f-input" type="number" min="0" step="any" value={cantCompra}
            onChange={(e) => setCantCompra(e.target.value)} />
          <select className="f-select" aria-label="Unidad de compra" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            {opciones.map((o) => <option key={o.u} value={o.u}>{o.etiqueta}</option>)}
          </select>
        </div>
      </div>

      <div className="f-row">
        <div className="f-group">
          <label className="f-label" htmlFor="ep-precio">Precio de esa presentación</label>
          <input id="ep-precio" className="f-input" type="number" min="0" step="any" value={precio}
            onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div className="f-group">
          <label className="f-label" htmlFor="ep-merma">Merma % (opcional)</label>
          <input id="ep-merma" className="f-input" type="number" min="0" max="99" step="any" placeholder="0"
            value={merma} onChange={(e) => setMerma(e.target.value)} />
        </div>
      </div>

      <div className="calc-box">
        Costo por {NOMBRE_BASE[insumo.unidad_base]}: <b>{pesos(costoUnit)}</b>
        {mermaFrac > 0 && <> · incluye merma del {Math.round(mermaFrac * 100)}%</>}
      </div>

      {error && <div className="f-error">{error}</div>}

      <div className="f-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando || !(cantBase > 0) || !(Number(precio) > 0) || !nombre.trim()}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}

/* ---------- crear un insumo nuevo ---------- */
function CrearInsumo({ onClose, onCreado }) {
  const [nombre, setNombre] = useState('')
  const [base, setBase] = useState('g')
  const [cantCompra, setCantCompra] = useState('')
  const [unidad, setUnidad] = useState('g')
  const [precio, setPrecio] = useState('')
  const [merma, setMerma] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const opciones = UNIDADES_COMPRA[base]
  const factor = opciones.find((o) => o.u === unidad)?.factor || 1
  const cantBase = Number(cantCompra) * factor
  const mermaFrac = Math.min(Math.max(Number(merma) || 0, 0), 99) / 100
  const costoUnit = cantBase > 0 ? Number(precio) / cantBase / (1 - mermaFrac) : 0

  function cambiarBase(b) {
    setBase(b)
    setUnidad(UNIDADES_COMPRA[b][0].u)
  }

  async function guardar() {
    setError('')
    if (!nombre.trim()) return setError('Ponle un nombre al insumo.')
    if (!(cantBase > 0)) return setError('La cantidad debe ser mayor que cero.')
    if (!(Number(precio) > 0)) return setError('El precio debe ser mayor que cero.')
    setGuardando(true)
    const { error } = await supabase.from('costeo_insumos').insert({
      nombre: nombre.trim(), unidad_base: base,
      presentacion_cant: cantBase, presentacion_precio: Number(precio),
      merma_pct: mermaFrac, origen_dato: 'usuario', unidad_compra: unidad,
    })
    setGuardando(false)
    if (error) return setError(error.message.includes('duplicate') ? 'Ya existe un insumo con ese nombre.' : error.message)
    onCreado()
  }

  return (
    <Modal titulo="Nuevo insumo" subtitulo="Registra algo que se compra para la cocina." onClose={onClose} ancho={500}>
      <div className="f-group">
        <label className="f-label" htmlFor="ci-nombre">Nombre</label>
        <input id="ci-nombre" className="f-input" placeholder="Tomate, aceite, pechuga…" value={nombre}
          onChange={(e) => setNombre(e.target.value)} autoFocus />
      </div>

      <div className="f-group">
        {/* son botones, no un campo: se anuncian como grupo con estado */}
        <span className="f-label" id="ci-medida">¿En qué se mide?</span>
        <div className="f-row" role="group" aria-labelledby="ci-medida">
          <button type="button" className={'f-select' + (base === 'g' ? ' sel' : '')} aria-pressed={base === 'g'}
            style={selBtn(base === 'g')} onClick={() => cambiarBase('g')}>Peso (g / kg / lb)</button>
          <button type="button" aria-pressed={base === 'ml'} style={selBtn(base === 'ml')} onClick={() => cambiarBase('ml')}>Volumen (ml / L)</button>
          <button type="button" aria-pressed={base === 'und'} style={selBtn(base === 'und')} onClick={() => cambiarBase('und')}>Unidad</button>
        </div>
      </div>

      <div className="f-group">
        <label className="f-label" htmlFor="ci-cant">¿Cómo lo compras?</label>
        <div className="f-row">
          <input id="ci-cant" className="f-input" type="number" min="0" step="any" placeholder="Cantidad"
            value={cantCompra} onChange={(e) => setCantCompra(e.target.value)} />
          <select className="f-select" aria-label="Unidad de compra" value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            {opciones.map((o) => <option key={o.u} value={o.u}>{o.etiqueta}</option>)}
          </select>
        </div>
        <div className="f-hint">Ejemplo: si compras un bulto de 25 kilos, escribe 25 y elige kilos.</div>
      </div>

      <div className="f-row">
        <div className="f-group">
          <label className="f-label" htmlFor="ci-precio">Precio de compra</label>
          <input id="ci-precio" className="f-input" type="number" min="0" step="any" placeholder="$"
            value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div className="f-group">
          <label className="f-label" htmlFor="ci-merma">Merma % (opcional)</label>
          <input id="ci-merma" className="f-input" type="number" min="0" max="99" step="any" placeholder="0"
            value={merma} onChange={(e) => setMerma(e.target.value)} />
        </div>
      </div>

      {cantBase > 0 && precio && (
        <div className="calc-box">Costo por {NOMBRE_BASE[base]}: <b>{pesos(costoUnit)}</b></div>
      )}
      {error && <div className="f-error">{error}</div>}

      <div className="f-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear insumo'}
        </button>
      </div>
    </Modal>
  )
}

/* ---------- eliminar un insumo ---------- */
function EliminarInsumo({ insumo, onClose, onEliminado }) {
  const [verificando, setVerificando] = useState(true)
  const [usos, setUsos] = useState([])   // recetas/sub-recetas donde se usa
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState('')
  const [fallo, setFallo] = useState(false)  // la verificación no pudo completarse

  useEffect(() => {
    async function verificar() {
      const { data, error: e } = await supabase.rpc('costeo_componentes_insumo', { p_insumo: insumo.id })
      setVerificando(false)
      if (e) {
        // sin este flag, usos quedaba [] y la UI afirmaba "no está en uso,
        // está bien eliminarlo" justo cuando no tiene forma de saberlo.
        setFallo(true)
        setError('No se pudo verificar si está en uso. Revisa la conexión e intenta de nuevo.')
        return
      }
      setUsos(data || [])
    }
    verificar()
  }, [insumo.id])

  async function eliminarConfirmado() {
    setError('')
    setEliminando(true)
    const { error: e } = await supabase.from('costeo_insumos').delete().eq('id', insumo.id)
    setEliminando(false)
    if (e) {
      setError(e.message || 'No se pudo eliminar. Intenta de nuevo.')
      return
    }
    onEliminado()
  }

  const enUso = usos.length > 0
  const platos = usos.filter((u) => !u.es_subreceta)
  const subs = usos.filter((u) => u.es_subreceta)

  return (
    <Modal titulo="¿Eliminar este insumo?" subtitulo={insumo.nombre} onClose={onClose} ancho={450}>
      {verificando && <div className="f-hint">Verificando si está en uso…</div>}

      {!verificando && enUso && (
        <>
          <div className="f-error" style={{ marginBottom: 14 }}>
            <Icono nombre="alerta" size={18} style={{ marginRight: 8 }} />
            No se puede eliminar todavía: este insumo se usa en {usos.length} receta{usos.length === 1 ? '' : 's'}.
          </div>

          <div className="usos-lista">
            {platos.length > 0 && (
              <>
                <div className="usos-titulo">En estos platos:</div>
                {platos.map((u) => (
                  <div className="usos-item" key={'p' + u.receta_id}>
                    <Icono nombre="olla" size={15} />
                    <span>{u.receta_nombre}</span>
                  </div>
                ))}
              </>
            )}
            {subs.length > 0 && (
              <>
                <div className="usos-titulo">En estas sub-recetas:</div>
                {subs.map((u) => (
                  <div className="usos-item" key={'s' + u.receta_id}>
                    <Icono nombre="etiqueta" size={15} />
                    <span>{u.receta_nombre}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <p className="f-hint" style={{ marginTop: 12 }}>
            Ve a {platos.length > 0 && subs.length > 0 ? 'Recetas y Sub-recetas' : subs.length > 0 ? 'Sub-recetas' : 'Recetas'},
            edita {usos.length === 1 ? 'esa' : 'esas'} preparaci{usos.length === 1 ? 'ón' : 'ones'} y cambia este insumo por el nuevo.
            Cuando ya no lo use nadie, podrás borrarlo aquí.
          </p>
        </>
      )}

      {!verificando && fallo && <div className="f-error">{error}</div>}

      {!verificando && !fallo && !enUso && (
        <>
          <p className="f-hint">Este insumo no está siendo usado en ninguna receta. Está bien eliminarlo.</p>
          {error && <div className="f-error">{error}</div>}
        </>
      )}

      <div className="f-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={eliminando}>
          Cancelar
        </button>
        {!enUso && !verificando && !fallo && (
          <button
            className="btn btn-danger"
            onClick={eliminarConfirmado}
            disabled={eliminando}
            style={{ background: '#C0392B', color: '#fff' }}
          >
            {eliminando ? 'Eliminando…' : 'Eliminar insumo'}
          </button>
        )}
      </div>
    </Modal>
  )
}

function VerEnPlatos({ insumo, onClose }) {
  const { esDueno } = useAuth()
  const [platos, setPlatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setError('')
      const { data, error: e } = await supabase.rpc('costeo_platos_que_usan_insumo', { p_insumo: insumo.id })
      setCargando(false)
      if (e) {
        setError(e.message || 'No pudimos cargar los platos.')
        return
      }
      setPlatos(data || [])
    }
    cargar()
  }, [insumo.id])

  const platosFinales = (platos || []).filter((p) => !p.es_subreceta)
  const subrecetas = (platos || []).filter((p) => p.es_subreceta)

  return (
    <Modal titulo="Ver en platos" subtitulo={insumo.nombre} onClose={onClose} ancho={500}>
      {cargando && <div className="f-hint">Cargando…</div>}

      {error && <div className="f-error">{error}</div>}

      {!cargando && !error && platos && platos.length === 0 && (
        <div className="f-hint">Este insumo no se usa en ninguna receta todavía.</div>
      )}

      {!cargando && !error && platos && platos.length > 0 && (
        <>
          {platosFinales.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.95rem', color: 'var(--ink)' }}>Platos</div>
              <div className="usos-lista">
                {platosFinales.map((p) => (
                  <div className="usos-item" key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                      {p.categoria && <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{p.categoria}</div>}
                    </div>
                    {esDueno && p.costo != null && (
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--brick)', whiteSpace: 'nowrap', marginLeft: 12 }}>
                        {pesos(p.costo)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {subrecetas.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.95rem', color: 'var(--ink)' }}>Usado en sub-recetas</div>
              <div className="usos-lista">
                {subrecetas.map((p) => (
                  <div className="usos-item" key={p.id}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                      {p.categoria && <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{p.categoria}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="f-actions" style={{ marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}

function selBtn(activo) {
  return {
    height: 48, cursor: 'pointer', fontWeight: 500, fontSize: '0.86rem',
    background: activo ? 'var(--brick)' : 'var(--cream-soft)',
    color: activo ? '#fff' : 'var(--ink-soft)',
    border: '1.5px solid ' + (activo ? 'var(--brick)' : 'var(--hairline)'),
    borderRadius: 'var(--radius)',
  }
}
