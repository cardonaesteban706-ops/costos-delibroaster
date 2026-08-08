import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import RecetaEditor from '../components/RecetaEditor'
import Icono from '../components/Icono'
import './Recetas.css'

export default function Recetas() {
  return <ListaRecetas esSub={false} />
}

export function ListaRecetas({ esSub }) {
  const [recetas, setRecetas] = useState([])
  const [conteos, setConteos] = useState({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [creando, setCreando] = useState(false)
  const [errorCarga, setErrorCarga] = useState('')

  async function cargar() {
    setCargando(true)
    setErrorCarga('')
    const { data, error } = await supabase
      .from('costeo_recetas')
      .select('id, nombre, categoria, es_subreceta, rinde_cant, rinde_unidad, porciones_lote, costeo_componentes!costeo_componentes_receta_id_fkey(count)')
      .eq('es_subreceta', esSub)
      .order('nombre')
    if (error) {
      setErrorCarga(error.message || 'No pudimos cargar las recetas.')
      setCargando(false)
      return
    }
    setRecetas(data || [])
    const [{ count: nIns }, { count: nRec }, { count: nSub }] = await Promise.all([
      supabase.from('costeo_insumos').select('*', { count: 'exact', head: true }),
      supabase.from('costeo_recetas').select('*', { count: 'exact', head: true }).eq('es_subreceta', false),
      supabase.from('costeo_recetas').select('*', { count: 'exact', head: true }).eq('es_subreceta', true),
    ])
    setConteos({ insumos: nIns, recetas: nRec, subrecetas: nSub })
    setCargando(false)
  }

  useEffect(() => { cargar() }, [esSub])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return recetas
    return recetas.filter((r) => r.nombre.toLowerCase().includes(q))
  }, [recetas, busqueda])

  const titulo = esSub ? 'Sub-recetas' : 'Recetas'
  const sub = esSub ? 'Preparaciones base: salsas, apanados, arroces.' : 'Los platos de la carta.'

  return (
    <Layout conteos={conteos}>
      <div className="main-head">
        <div>
          <h1 className="main-title">{titulo}</h1>
          <p className="main-sub">{sub}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setCreando(true)}>+ {esSub ? 'Nueva sub-receta' : 'Nueva receta'}</button>
        </div>
      </div>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <div className="search">
          <span className="lupa"><Icono nombre="buscar" size={18} /></span>
          <input type="text" aria-label={`Buscar ${titulo.toLowerCase()}`} placeholder={`Buscar ${titulo.toLowerCase()}…`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="count-row"><span className="count-lbl">{filtradas.length} {titulo.toLowerCase()}</span></div>

      {cargando ? <div className="vacio">Cargando…</div> : errorCarga ? (
        <div className="f-error" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>No pudimos cargar {titulo.toLowerCase()}: {errorCarga}</span>
          <button className="btn btn-ghost" style={{ height: 36 }} onClick={cargar}>Reintentar</button>
        </div>
      ) : busqueda && filtradas.length === 0 ? (
        <div className="vacio">
          <div className="vacio-emoji"><Icono nombre="buscar" size={38} /></div>
          Nada por aquí con “{busqueda}”. Prueba con otro nombre.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="vacio">
          <div className="vacio-emoji"><Icono nombre="olla" size={40} /></div>
          {esSub
            ? 'Todavía no hay preparaciones base. Crea la primera con el botón de arriba.'
            : 'Todavía no hay platos en la carta. Crea el primero con el botón de arriba.'}
        </div>
      ) : filtradas.map((r) => {
        const nComp = r.costeo_componentes?.[0]?.count ?? 0
        return (
          <div className="rec-card" key={r.id}>
            {r.categoria && <div className="rec-eyebrow">{r.categoria}</div>}
            <div className="rec-line">
              <span className="rec-name">{r.nombre}</span>
              <span className="rec-leader" aria-hidden="true" />
              <span className="rec-count">{nComp} {nComp === 1 ? 'ingrediente' : 'ingredientes'}</span>
            </div>
            <div className="rec-foot">
              {esSub && r.rinde_cant && <span className="rec-rinde">rinde {Math.round(r.rinde_cant)} {r.rinde_unidad}</span>}
              <button className="rec-edit" onClick={() => setEditando(r)}>Editar</button>
            </div>
          </div>
        )
      })}

      {(editando || creando) && (
        <RecetaEditor
          receta={editando}
          esSub={esSub}
          onClose={() => { setEditando(null); setCreando(false) }}
          onGuardado={() => { setEditando(null); setCreando(false); cargar() }}
        />
      )}
    </Layout>
  )
}
