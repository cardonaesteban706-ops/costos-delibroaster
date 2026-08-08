import { useState } from 'react'
import { pesos } from '../lib/formato'
import './UsosDondeSeUsa.css'

// Lista compartida de "dónde se usa" un insumo o sub-receta.
// items = resultado de costeo_platos_que_usan_insumo / costeo_recetas_que_usan_subreceta
//   cada fila: { id, nombre, categoria, es_subreceta, costo, directo, vias[] }
// mostrarCosto = mostrar la columna de costo (solo dueño y solo para insumos).
export default function UsosDondeSeUsa({ items, cargando, error, mostrarCosto, vacioTexto }) {
  const [busqueda, setBusqueda] = useState('')

  if (cargando) return <div className="usos-estado">Cargando…</div>
  if (error) return <div className="f-error">{error}</div>
  if (!items || items.length === 0) return <div className="usos-estado">{vacioTexto}</div>

  const q = busqueda.trim().toLowerCase()
  const filtrados = q ? items.filter((p) => p.nombre.toLowerCase().includes(q)) : items
  const platos = filtrados.filter((p) => !p.es_subreceta)
  const subs = filtrados.filter((p) => p.es_subreceta)
  const nDirecto = items.filter((p) => p.directo).length
  const nIndirecto = items.length - nDirecto

  return (
    <div className="usos2">
      <div className="usos2-resumen">
        <b>{items.length}</b> {items.length === 1 ? 'receta usa esto' : 'recetas usan esto'}
        {nDirecto > 0 && nIndirecto > 0 && (
          <span className="usos2-resumen-detalle"> · {nDirecto} directo, {nIndirecto} vía otra receta</span>
        )}
      </div>

      {/* con listas cortas, buscar solo estorba */}
      {items.length > 6 && (
        <input
          type="text"
          className="f-input usos2-buscar"
          placeholder="Buscar por nombre…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar en la lista"
        />
      )}

      {filtrados.length === 0 ? (
        <div className="usos-estado">Nada con “{busqueda}”.</div>
      ) : (
        <>
          {platos.length > 0 && <Grupo titulo="Platos" items={platos} mostrarCosto={mostrarCosto} />}
          {subs.length > 0 && <Grupo titulo="Sub-recetas" items={subs} mostrarCosto={mostrarCosto} />}
        </>
      )}
    </div>
  )
}

function Grupo({ titulo, items, mostrarCosto }) {
  const directos = items.filter((p) => p.directo)
  const indirectos = items.filter((p) => !p.directo)

  return (
    <div className="usos2-grupo">
      <div className="usos2-grupo-titulo">
        {titulo}
        <span className="usos2-conteo">{items.length}</span>
      </div>

      {directos.length > 0 && (
        <div className="usos2-lista">
          {directos.map((p) => <Fila key={p.id} p={p} mostrarCosto={mostrarCosto} />)}
        </div>
      )}

      {indirectos.length > 0 && (
        <>
          {directos.length > 0 && <div className="usos2-sublabel">vía otra receta</div>}
          <div className="usos2-lista">
            {indirectos.map((p) => <Fila key={p.id} p={p} mostrarCosto={mostrarCosto} mostrarVia />)}
          </div>
        </>
      )}
    </div>
  )
}

function Fila({ p, mostrarCosto, mostrarVia }) {
  const via = mostrarVia && p.vias?.length > 0 ? `vía ${p.vias.join(', ')}` : null
  const meta = [p.categoria, via].filter(Boolean).join(' · ')

  return (
    <div className="usos2-fila">
      <div className="usos2-info">
        <div className="usos2-nombre">{p.nombre}</div>
        {meta && <div className="usos2-meta">{meta}</div>}
      </div>
      {mostrarCosto && p.costo != null && <div className="usos2-costo">{pesos(p.costo)}</div>}
    </div>
  )
}
