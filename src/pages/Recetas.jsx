import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import RecetaEditor from '../components/RecetaEditor'
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

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('costeo_recetas')
      .select('id, nombre, categoria, es_subreceta, rinde_cant, rinde_unidad, costeo_componentes!costeo_componentes_receta_id_fkey(count)')
      .eq('es_subreceta', esSub)
      .order('nombre')
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
          <span className="lupa">⌕</span>
          <input type="text" placeholder={`Buscar ${titulo.toLowerCase()}…`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <div className="count-row"><span className="count-lbl">{filtradas.length} {titulo.toLowerCase()}</span></div>

      {cargando ? <div className="vacio">Cargando…</div> : filtradas.length === 0 ? (
        <div className="vacio"><div className="vacio-emoji">🍲</div>No hay {titulo.toLowerCase()} todavía.</div>
      ) : filtradas.map((r) => (
        <div className="rec-card" key={r.id}>
          <div className="rec-top">
            <div>
              <div className="rec-name">{r.nombre}</div>
              {r.categoria && <div className="rec-cat">{r.categoria}</div>}
              {esSub && r.rinde_cant && <span className="rec-rinde">rinde {Math.round(r.rinde_cant)} {r.rinde_unidad}</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button className="rec-edit" onClick={() => setEditando(r)}>Editar</button>
              <div className="rec-count" style={{ marginTop: 8 }}>{r.costeo_componentes?.[0]?.count ?? 0} ingredientes</div>
            </div>
          </div>
        </div>
      ))}

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
