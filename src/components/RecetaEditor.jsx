import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { UNIDADES_COMPRA } from '../lib/formato'

// esSub = true -> editor de sub-receta (pide rendimiento)
export default function RecetaEditor({ receta, esSub, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(receta?.nombre || '')
  const [categoria, setCategoria] = useState(receta?.categoria || '')
  const [rindeCant, setRindeCant] = useState(receta?.rinde_cant || '')
  const [rindeUnidad, setRindeUnidad] = useState(receta?.rinde_unidad || 'und')
  const [comps, setComps] = useState([])
  const [insumos, setInsumos] = useState([])
  const [subrecetas, setSubrecetas] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

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

  function agregar() { setComps([...comps, { tipo: 'insumo', ref: '', cantidad: '', unidad: 'g' }]) }
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
    if (esSub && !rindeCant) return setError('Indica cuánto rinde el lote.')
    const compsValidos = comps.filter((c) => c.ref && c.cantidad)
    if (compsValidos.length === 0) return setError('Agrega al menos un ingrediente.')
    setGuardando(true)

    const payload = {
      nombre: nombre.trim(), es_subreceta: esSub, categoria: categoria.trim() || null,
      rinde_cant: esSub ? Number(rindeCant) : null,
      rinde_unidad: esSub ? rindeUnidad : null,
    }

    let recetaId = receta?.id
    if (recetaId) {
      const { error } = await supabase.from('costeo_recetas').update(payload).eq('id', recetaId)
      if (error) { setGuardando(false); return setError(error.message) }
      await supabase.from('costeo_componentes').delete().eq('receta_id', recetaId)
    } else {
      const { data, error } = await supabase.from('costeo_recetas').insert(payload).select('id').single()
      if (error) { setGuardando(false); return setError(error.message.includes('duplicate') ? 'Ya existe una receta con ese nombre.' : error.message) }
      recetaId = data.id
    }

    const filas = compsValidos.map((c) => ({
      receta_id: recetaId,
      insumo_id: c.tipo === 'insumo' ? Number(c.ref) : null,
      subreceta_id: c.tipo === 'sub' ? Number(c.ref) : null,
      cantidad: Number(c.cantidad),
      unidad: unidadDe(c.tipo, c.ref),
    }))
    const { error: e2 } = await supabase.from('costeo_componentes').insert(filas)
    setGuardando(false)
    if (e2) return setError(e2.message)
    onGuardado()
  }

  const titulo = receta ? nombre : (esSub ? 'Nueva sub-receta' : 'Nueva receta')

  return (
    <Modal titulo={receta ? 'Editar' : titulo} subtitulo={esSub ? 'Una preparación que se hace en la cocina.' : 'Un plato de la carta.'} onClose={onClose} ancho={560}>
      {cargando ? <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Cargando…</div> : (
        <>
          <div className="f-row">
            <div className="f-group" style={{ flex: 2 }}>
              <label className="f-label">Nombre</label>
              <input className="f-input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
            </div>
            <div className="f-group">
              <label className="f-label">Categoría</label>
              <input className="f-input" placeholder="Broaster…" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
            </div>
          </div>

          {esSub && (
            <div className="f-group">
              <label className="f-label">¿Cuánto rinde el lote?</label>
              <div className="f-row">
                <input className="f-input" type="number" min="0" step="any" placeholder="Cantidad"
                  value={rindeCant} onChange={(e) => setRindeCant(e.target.value)} />
                <select className="f-select" value={rindeUnidad} onChange={(e) => setRindeUnidad(e.target.value)}>
                  <option value="g">gramos</option><option value="ml">mililitros</option><option value="und">unidades / porciones</option>
                </select>
              </div>
              <div className="f-hint">Ej: si de un lote salen 155 pollos apanados, escribe 155 y elige unidades.</div>
            </div>
          )}

          <div className="f-group">
            <label className="f-label">Ingredientes</label>
            <div className="comp-list">
              {comps.length === 0 && <div className="comp-empty">Todavía no hay ingredientes.</div>}
              {comps.map((c, idx) => (
                <div className="comp-row" key={idx}>
                  <select className="f-select" value={c.tipo + ':' + c.ref}
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
                    value={c.cantidad} onChange={(e) => cambiar(idx, 'cantidad', e.target.value)} />
                  <span className="comp-unit">{c.ref ? unidadDe(c.tipo, c.ref) : ''}</span>
                  <button className="comp-del" onClick={() => quitar(idx)} aria-label="Quitar">✕</button>
                </div>
              ))}
            </div>
            <button className="comp-add" onClick={agregar}>+ Agregar ingrediente</button>
          </div>

          {error && <div className="calc-box" style={{ color: '#8A2417', background: '#F7E4DF', borderColor: '#E6B8AC' }}>{error}</div>}

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
