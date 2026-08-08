import { pesos } from '../lib/formato'
import './UsosDondeSeUsa.css'

// Lista compartida de "dónde se usa" un insumo o sub-receta.
// items = resultado de costeo_platos_que_usan_insumo / costeo_recetas_que_usan_subreceta
//   cada fila: { id, nombre, categoria, es_subreceta, costo, directo, vias[] }
// mostrarCosto = mostrar la columna de costo (solo dueño y solo para insumos).
export default function UsosDondeSeUsa({ items, cargando, error, mostrarCosto, vacioTexto }) {
  if (cargando) return <div className="usos-estado">Cargando…</div>
  if (error) return <div className="f-error">{error}</div>
  if (!items || items.length === 0) return <div className="usos-estado">{vacioTexto}</div>

  const platos = items.filter((p) => !p.es_subreceta)
  const subs = items.filter((p) => p.es_subreceta)

  return (
    <div className="usos2">
      {platos.length > 0 && (
        <Grupo titulo="Platos" items={platos} mostrarCosto={mostrarCosto} />
      )}
      {subs.length > 0 && (
        <Grupo titulo="Sub-recetas" items={subs} mostrarCosto={mostrarCosto} />
      )}
    </div>
  )
}

function Grupo({ titulo, items, mostrarCosto }) {
  return (
    <div className="usos2-grupo">
      <div className="usos2-grupo-titulo">
        {titulo}
        <span className="usos2-conteo">{items.length}</span>
      </div>
      <div className="usos2-lista">
        {items.map((p) => (
          <div className="usos2-fila" key={p.id}>
            <div className="usos2-info">
              <div className="usos2-nombre">{p.nombre}</div>
              <div className="usos2-meta">
                {p.categoria && <span className="usos2-cat">{p.categoria}</span>}
                {p.directo ? (
                  <span className="usos2-badge directo">lo usa directamente</span>
                ) : p.vias && p.vias.length > 0 ? (
                  <span className="usos2-badge via">vía {p.vias.join(' · ')}</span>
                ) : null}
              </div>
            </div>
            {mostrarCosto && p.costo != null && (
              <div className="usos2-costo">{pesos(p.costo)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
