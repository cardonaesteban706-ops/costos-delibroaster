import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import Icono from './Icono'
import UsosDondeSeUsa from './UsosDondeSeUsa'
import { pesos, UNIDADES_COMPRA } from '../lib/formato'

// esSub = true -> editor de sub-receta (pide rendimiento)
export default function RecetaEditor({ receta, esSub, onClose, onGuardado }) {
  const { esDueno } = useAuth()
  const [nombre, setNombre] = useState(receta?.nombre || '')
  const [categoria, setCategoria] = useState(receta?.categoria || '')
  const [rindeCant, setRindeCant] = useState(receta?.rinde_cant || '')
  const [rindeUnidad, setRindeUnidad] = useState(receta?.rinde_unidad || 'und')
  const [porcionesLote, setPorcionesLote] = useState(receta?.porciones_lote || '')
  const [comps, setComps] = useState([])
  const [insumos, setInsumos] = useState([])
  const [subrecetas, setSubrecetas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  // clave = id estable de la fila, no su posición: si se indexa por posición,
  // al borrar un ingrediente las filas de abajo muestran el costo del borrado.
  const [costosLinea, setCostosLinea] = useState({}) // id -> { unitario, total } — solo se llena si esDueno
  const [verEnComponentes, setVerEnComponentes] = useState(null) // comp a ver dónde se usa
  const proximoId = useRef(0)
  const nuevoId = () => ++proximoId.current

  useEffect(() => {
    async function cargar() {
      const [ins, subs] = await Promise.all([
        supabase.from('costeo_insumos').select('id, nombre, unidad_base').order('nombre'),
        supabase.from('costeo_recetas').select('id, nombre, rinde_unidad').eq('es_subreceta', true).order('nombre'),
      ])
      setInsumos(ins.data || [])
      setSubrecetas((subs.data || []).filter((s) => s.id !== receta?.id))
      if (receta?.id) {
        const { data } = await supabase.from('costeo_componentes')
          .select('id, insumo_id, subreceta_id, cantidad, unidad').eq('receta_id', receta.id)
        setComps((data || []).map((c) => ({
          id: nuevoId(),
          tipo: c.insumo_id ? 'insumo' : 'sub',
          ref: c.insumo_id || c.subreceta_id,
          cantidad: c.cantidad, unidad: c.unidad,
        })))
      }
      setCargando(false)
    }
    cargar()
  }, [receta])

  function unidadDe(tipo, ref) {
    if (tipo === 'insumo') return insumos.find((i) => i.id === Number(ref))?.unidad_base || 'g'
    return subrecetas.find((s) => s.id === Number(ref))?.rinde_unidad || 'und'
  }

  // el dueño ve, en vivo, cuánto cuesta cada ingrediente consumido (precio unitario x cantidad)
  useEffect(() => {
    if (!esDueno) return
    let cancelado = false

    async function calcular() {
      const entradas = await Promise.all(
        comps.map(async (c) => {
          if (!c.ref || !(Number(c.cantidad) > 0)) return [c.id, null]
          const fn = c.tipo === 'insumo' ? 'costeo_costo_insumo' : 'costeo_costo_unitario_subreceta'
          const param = c.tipo === 'insumo' ? { p_insumo: Number(c.ref) } : { p_sub: Number(c.ref) }
          const { data, error } = await supabase.rpc(fn, param)
          if (error || data == null) return [c.id, null]
          const unitario = Number(data)
          return [c.id, { unitario, total: unitario * Number(c.cantidad) }]
        })
      )
      if (cancelado) return
      setCostosLinea(Object.fromEntries(entradas))
    }

    // debounce: el efecto depende de todo `comps`, así que sin esto cada tecla
    // disparaba una RPC por ingrediente (15 ingredientes x 4 dígitos = 60 idas).
    const t = setTimeout(calcular, 400)
    return () => { cancelado = true; clearTimeout(t) }
  }, [comps, esDueno])

  const costoTotalReceta = Object.values(costosLinea).reduce((s, v) => s + (v?.total || 0), 0)

  function agregar() { setComps([...comps, { id: nuevoId(), tipo: 'insumo', ref: '', cantidad: '', unidad: 'g' }]) }
  function quitar(idx) { setComps(comps.filter((_, i) => i !== idx)) }
  function cambiar(idx, campo, valor) {
    setComps(comps.map((c, i) => {
      if (i !== idx) return c
      const nc = { ...c, [campo]: valor }
      if (campo === 'ref' || campo === 'tipo') nc.unidad = unidadDe(nc.tipo, nc.ref)
      return nc
    }))
  }

  async function guardar() {
    setError('')
    if (!nombre.trim()) return setError('Ponle un nombre.')
    if (esSub && !(Number(rindeCant) > 0)) return setError('Indica cuánto rinde el lote (un número mayor que cero).')
    if (!esSub && String(porcionesLote).trim() !== '' && !(Number(porcionesLote) > 0)) {
      return setError('Las porciones del lote deben ser mayores que cero, o deja el campo vacío.')
    }
    // ojo: '0' es un string truthy. Si se cuela, la BD rechaza el insert de componentes
    // DESPUÉS de que el delete ya borró los viejos, y la receta queda sin ingredientes.
    const compsTocados = comps.filter((c) => c.ref || String(c.cantidad).trim() !== '')
    if (compsTocados.some((c) => !c.ref || !(Number(c.cantidad) > 0))) {
      return setError('Cada ingrediente necesita un producto y una cantidad mayor que cero.')
    }
    const compsValidos = compsTocados
    if (compsValidos.length === 0) return setError('Agrega al menos un ingrediente.')
    setGuardando(true)

    // Una sola RPC transaccional en vez de update + delete + insert por separado.
    // Antes, si el insert de componentes fallaba, el delete ya estaba confirmado
    // y la receta quedaba sin ingredientes (costo $0 y margen 100% "sano" en el
    // tablero). Ahora cualquier fallo revierte también el borrado.
    const { error } = await supabase.rpc('costeo_guardar_receta', {
      p_id: receta?.id ?? null,
      p_nombre: nombre.trim(),
      p_es_subreceta: esSub,
      p_categoria: categoria.trim() || null,
      p_rinde_cant: esSub ? Number(rindeCant) : null,
      p_rinde_unidad: esSub ? rindeUnidad : null,
      p_porciones_lote: !esSub && Number(porcionesLote) > 0 ? Number(porcionesLote) : null,
      p_comps: compsValidos.map((c) => ({
        tipo: c.tipo,
        ref: Number(c.ref),
        cantidad: Number(c.cantidad),
        unidad: unidadDe(c.tipo, c.ref),
      })),
    })
    setGuardando(false)
    if (error) return setError(error.message)
    onGuardado()
  }

  const titulo = receta ? nombre : (esSub ? 'Nueva sub-receta' : 'Nueva receta')

  if (verEnComponentes) {
    return (
      <VerEnComponentes
        comp={verEnComponentes}
        insumos={insumos}
        subrecetas={subrecetas}
        esDueno={esDueno}
        onClose={() => setVerEnComponentes(null)}
      />
    )
  }

  return (
    <Modal titulo={receta ? 'Editar' : titulo} subtitulo={esSub ? 'Una preparación que se hace en la cocina.' : 'Un plato de la carta.'} onClose={onClose} ancho={560}>
      {cargando ? <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Cargando…</div> : (
        <>
          <div className="f-row">
            <div className="f-group" style={{ flex: 2 }}>
              <label className="f-label" htmlFor="rec-nombre">Nombre</label>
              <input id="rec-nombre" className="f-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </div>
            <div className="f-group">
              <label className="f-label" htmlFor="rec-categoria">Categoría</label>
              <input id="rec-categoria" className="f-input" placeholder="Broaster…" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
            </div>
          </div>

          {esSub && (
            <div className="f-group">
              <label className="f-label" htmlFor="rec-rinde">¿Cuánto rinde el lote?</label>
              <div className="f-row">
                <input id="rec-rinde" className="f-input" type="number" min="0" step="any" placeholder="Cantidad"
                  value={rindeCant} onChange={(e) => setRindeCant(e.target.value)} />
                <select className="f-select" aria-label="Unidad del rendimiento" value={rindeUnidad} onChange={(e) => setRindeUnidad(e.target.value)}>
                  <option value="g">gramos</option><option value="ml">mililitros</option><option value="und">unidades / porciones</option>
                </select>
              </div>
              <div className="f-hint">Ej: si de un lote salen 155 pollos apanados, escribe 155 y elige unidades.</div>
            </div>
          )}

          {!esSub && (
            <div className="f-group">
              <label className="f-label" htmlFor="rec-porciones">¿Este plato se prepara en un lote grande? (opcional)</label>
              <input id="rec-porciones" className="f-input" type="number" min="0" step="any" placeholder="Ej: 13 porciones — déjalo vacío si ya es por porción individual"
                value={porcionesLote} onChange={(e) => setPorcionesLote(e.target.value)} />
              <div className="f-hint">
                Si los ingredientes que agregaste abajo son de un caldero/lote completo (no de una sola porción),
                escribe cuántas porciones rinde ese lote. El costo se dividirá automáticamente entre ese número.
                Ej: Arroz paisa → 13.
              </div>
            </div>
          )}

          <div className="f-group">
            {/* encabeza una lista de filas, no un campo: <label> sin destino confunde al lector */}
            <span className="f-label">Ingredientes</span>
            <div className="comp-list">
              {comps.length === 0 && <div className="comp-empty">Todavía no hay ingredientes.</div>}
              {comps.map((c, idx) => (
                <div key={c.id}>
                  <div className="comp-row">
                    <select className="f-select" aria-label="Ingrediente" value={c.tipo + ':' + c.ref}
                      onChange={(e) => {
                        const [tipo, ref] = e.target.value.split(':')
                        setComps(comps.map((cc, i) => i === idx ? { ...cc, tipo, ref, unidad: unidadDe(tipo, ref) } : cc))
                      }}>
                      <option value="insumo:">— elegir —</option>
                      <optgroup label="Insumos">
                        {insumos.map((i) => <option key={'i' + i.id} value={'insumo:' + i.id}>{i.nombre}</option>)}
                      </optgroup>
                      {subrecetas.length > 0 && (
                        <optgroup label="Sub-recetas">
                          {subrecetas.map((s) => <option key={'s' + s.id} value={'sub:' + s.id}>{s.nombre}</option>)}
                        </optgroup>
                      )}
                    </select>
                    <input className="f-input" type="number" min="0" step="any" placeholder="Cant."
                      aria-label="Cantidad del ingrediente"
                      value={c.cantidad} onChange={(e) => cambiar(idx, 'cantidad', e.target.value)} />
                    <span className="comp-unit">{c.ref ? unidadDe(c.tipo, c.ref) : ''}</span>
                    {c.ref && (
                      <button className="comp-del" onClick={() => setVerEnComponentes(c)} aria-label="Ver en qué recetas se usa" title="Ver en qué recetas se usa">
                        <Icono nombre="buscar" size={16} />
                      </button>
                    )}
                    <button className="comp-del" onClick={() => quitar(idx)} aria-label="Quitar"><Icono nombre="cerrar" size={16} /></button>
                  </div>
                  {esDueno && c.ref && Number(c.cantidad) > 0 && costosLinea[c.id] && (
                    <div className="comp-costo">
                      {pesos(costosLinea[c.id].unitario)} / {unidadDe(c.tipo, c.ref)} · total: <b>{pesos(costosLinea[c.id].total)}</b>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="comp-add" onClick={agregar}>+ Agregar ingrediente</button>
          </div>

          {esDueno && comps.some((c) => c.ref && Number(c.cantidad) > 0) && (
            <div className="calc-box">
              Costo total de esta receta: <b>{pesos(costoTotalReceta)}</b>
              {!esSub && Number(porcionesLote) > 0 && (
                <> · por porción (÷{porcionesLote}): <b>{pesos(costoTotalReceta / Number(porcionesLote))}</b></>
              )}
            </div>
          )}

          {error && <div className="f-error">{error}</div>}

          <div className="f-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

function VerEnComponentes({ comp, insumos, subrecetas, esDueno, onClose }) {
  const [usos, setUsos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  const esInsumo = comp.tipo === 'insumo'

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setError('')
      // insumo -> platos_que_usan_insumo; sub-receta -> recetas_que_usan_subreceta
      // (antes se llamaba la de insumos con null para las sub-recetas y salía vacío).
      const { data, error: e } = esInsumo
        ? await supabase.rpc('costeo_platos_que_usan_insumo', { p_insumo: Number(comp.ref) })
        : await supabase.rpc('costeo_recetas_que_usan_subreceta', { p_sub: Number(comp.ref) })
      setCargando(false)
      if (e) {
        setError(e.message || 'No pudimos cargar dónde se usa.')
        return
      }
      setUsos(data || [])
    }
    cargar()
  }, [comp, esInsumo])

  const nombre = esInsumo
    ? insumos.find((i) => i.id === Number(comp.ref))?.nombre || '—'
    : subrecetas.find((s) => s.id === Number(comp.ref))?.nombre || '—'

  return (
    <Modal titulo="¿Dónde más se usa?" subtitulo={nombre} onClose={onClose} ancho={480}>
      <UsosDondeSeUsa
        items={usos}
        cargando={cargando}
        error={error}
        mostrarCosto={esDueno}
        vacioTexto="Este ingrediente no se usa en ninguna otra receta todavía."
      />
      <div className="f-actions" style={{ marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
