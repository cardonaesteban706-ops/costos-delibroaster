import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { pesos } from '../lib/formato'
import './Auditoria.css'

// etiqueta singular de la unidad base, para "por gramo / por ml / por unidad"
const BASE_SINGULAR = { g: 'gramo', ml: 'ml', und: 'unidad' }

/* ---------- helpers de formato ---------- */
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// parsea "2026-07-01" sin depender de la zona horaria (Date lo corre un día)
function partesMes(iso) {
  const [y, m] = String(iso).slice(0, 7).split('-').map(Number)
  return { y, m }
}
function mesCorto(iso) { const { y, m } = partesMes(iso); return `${MES_CORTO[m - 1]} ${String(y).slice(2)}` }
function mesLargo(iso) { const { y, m } = partesMes(iso); return `${MES_LARGO[m - 1]} ${y}` }

// pesos con decimales cuando el valor es pequeño (precio por gramo/ml), sin ellos si es grande
function pesosUnit(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  const dec = v !== 0 && Math.abs(v) < 100 ? 2 : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(v)
}

// etiqueta compacta para los ejes Y (sirve tanto para $7,5/g como para $25k)
function tickPesos(d) {
  const v = Number(d)
  if (v >= 1000) return `$${Math.round(v / 1000)}k`
  if (v >= 100) return `$${Math.round(v)}`
  return `$${v.toFixed(1)}`
}

export default function Auditoria() {
  const [conteos, setConteos] = useState({})

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

  return (
    <Layout conteos={conteos}>
      <div className="main-head">
        <div>
          <h1 className="main-title">Auditoría</h1>
          <p className="main-sub">Cómo se han movido los precios de compra y qué le hicieron al costo de los platos.</p>
        </div>
      </div>

      <SeccionCambios />
      <ExploradorImpacto />
    </Layout>
  )
}

/* ================= Sección: cambios de precio ================= */

const RANGOS = [
  { k: '30', etiqueta: '30 días', dias: 30 },
  { k: '90', etiqueta: '90 días', dias: 90 },
  { k: 'todo', etiqueta: 'Todo', dias: null },
]

function SeccionCambios() {
  const [historial, setHistorial] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [rango, setRango] = useState('90')
  const [conteoPlatos, setConteoPlatos] = useState({})
  const cachePlatos = useRef({}) // insumo_id -> nº platos afectados (se conserva entre rangos)

  // cargamos TODO el historial una vez; los rangos se aplican en memoria sobre los cambios ya calculados
  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setError('')
      const { data, error: e } = await supabase
        .from('costeo_precios_historial')
        .select('insumo_id, precio, presentacion_cant, vigente_desde, costeo_insumos(nombre, unidad_base)')
        .order('vigente_desde', { ascending: true })
      setCargando(false)
      if (e) { setError(e.message || 'No pudimos cargar el historial.'); return }
      setHistorial(data || [])
    }
    cargar()
  }, [])

  // calcula los cambios reales de PRECIO UNITARIO (precio / cantidad), no del precio de la
  // presentación: pasar de "1 sobre = $100" a "240 sobres = $24.000" NO es un alza, es el
  // mismo precio unitario. Comparar el precio crudo daba saltos falsos de +23.900%.
  const cambios = useMemo(() => {
    if (!historial) return []
    const porInsumo = {}
    historial.forEach((h) => {
      const cant = Number(h.presentacion_cant)
      if (!(cant > 0)) return
      const unit = Number(h.precio) / cant
      if (!Number.isFinite(unit)) return
      ;(porInsumo[h.insumo_id] ||= []).push({
        insumo_id: h.insumo_id,
        nombre: h.costeo_insumos?.nombre || '—',
        base: h.costeo_insumos?.unidad_base || 'und',
        unit,
        fecha: h.vigente_desde,
      })
    })

    const salida = []
    Object.values(porInsumo).forEach((filas) => {
      // filas ya vienen ascendentes por fecha; comparamos cada una con la anterior
      for (let i = 1; i < filas.length; i++) {
        const ant = filas[i - 1]
        const act = filas[i]
        // redondeo a centésima de peso para no reportar ruido de coma flotante
        if (Math.round(ant.unit * 100) === Math.round(act.unit * 100)) continue
        salida.push({
          insumo_id: act.insumo_id,
          nombre: act.nombre,
          base: act.base,
          unitAnterior: ant.unit,
          unitNuevo: act.unit,
          pct: ant.unit > 0 ? ((act.unit - ant.unit) / ant.unit) * 100 : 0,
          fecha: act.fecha,
        })
      }
    })
    return salida.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [historial])

  const cambiosFiltrados = useMemo(() => {
    const cfg = RANGOS.find((r) => r.k === rango)
    if (!cfg?.dias) return cambios
    const limite = Date.now() - cfg.dias * 86400000
    return cambios.filter((c) => new Date(c.fecha).getTime() >= limite)
  }, [cambios, rango])

  // nº de platos afectados por insumo (solo para los insumos visibles, en paralelo y con caché)
  useEffect(() => {
    const ids = [...new Set(cambiosFiltrados.map((c) => c.insumo_id))].filter((id) => !(id in cachePlatos.current))
    if (ids.length === 0) return
    let cancelado = false
    Promise.all(ids.map(async (id) => {
      const { data } = await supabase.rpc('costeo_platos_afectados', { p_insumo: id })
      return [id, data ?? 0]
    })).then((pares) => {
      if (cancelado) return
      pares.forEach(([id, n]) => { cachePlatos.current[id] = n })
      setConteoPlatos({ ...cachePlatos.current })
    })
    return () => { cancelado = true }
  }, [cambiosFiltrados])

  // resumen (KPIs) del período visible
  const kpis = useMemo(() => {
    if (cambiosFiltrados.length === 0) return { total: 0, alza: null, baja: null }
    let alza = cambiosFiltrados[0], baja = cambiosFiltrados[0]
    cambiosFiltrados.forEach((c) => {
      if (c.pct > alza.pct) alza = c
      if (c.pct < baja.pct) baja = c
    })
    return { total: cambiosFiltrados.length, alza: alza.pct > 0 ? alza : null, baja: baja.pct < 0 ? baja : null }
  }, [cambiosFiltrados])

  return (
    <section className="audit-sec">
      <div className="audit-sec-head">
        <div>
          <h2 className="audit-sec-title">Cambios de precio de compra</h2>
          <p className="audit-sec-sub">Comparado por precio unitario (por gramo, ml o unidad), no por el tamaño del empaque.</p>
        </div>
        <div className="seg" role="group" aria-label="Rango de fechas">
          {RANGOS.map((r) => (
            <button key={r.k} className={'seg-btn' + (rango === r.k ? ' activo' : '')} onClick={() => setRango(r.k)}>
              {r.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-lbl">Cambios en el período</div>
          <div className="kpi-num">{cargando ? '—' : kpis.total}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Mayor alza</div>
          {kpis.alza ? (
            <>
              <div className="kpi-num sube">+{kpis.alza.pct.toFixed(0)}%</div>
              <div className="kpi-pie">{kpis.alza.nombre}</div>
            </>
          ) : <div className="kpi-num apagado">—</div>}
        </div>
        <div className="kpi">
          <div className="kpi-lbl">Mayor baja</div>
          {kpis.baja ? (
            <>
              <div className="kpi-num baja">{kpis.baja.pct.toFixed(0)}%</div>
              <div className="kpi-pie">{kpis.baja.nombre}</div>
            </>
          ) : <div className="kpi-num apagado">—</div>}
        </div>
      </div>

      {error && <div className="f-error">{error}</div>}

      {cargando ? (
        <div className="audit-estado">Cargando historial…</div>
      ) : cambiosFiltrados.length === 0 ? (
        <div className="audit-estado">No hay cambios de precio en este período.</div>
      ) : (
        <div className="tabla-wrap">
          <table className="audit-tabla">
            <thead>
              <tr>
                <th>Insumo</th>
                <th className="num">Antes</th>
                <th className="num">Después</th>
                <th className="num">Cambio</th>
                <th className="num">Platos</th>
                <th className="der">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {cambiosFiltrados.map((c, i) => (
                <tr key={i}>
                  <td>
                    <div className="celda-insumo">{c.nombre}</div>
                    <div className="celda-unidad">por {BASE_SINGULAR[c.base] || c.base}</div>
                  </td>
                  <td className="num apagado">{pesosUnit(c.unitAnterior)}</td>
                  <td className="num fuerte">{pesosUnit(c.unitNuevo)}</td>
                  <td className={'num ' + (c.pct > 0 ? 'sube' : 'baja')}>
                    {c.pct > 0 ? '+' : ''}{c.pct.toFixed(1)}%
                  </td>
                  <td className="num">{conteoPlatos[c.insumo_id] ?? '…'}</td>
                  <td className="der apagado">{new Date(c.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/* ================= Explorador de impacto ================= */

function ExploradorImpacto() {
  const [insumos, setInsumos] = useState([])
  const [cargandoInsumos, setCargandoInsumos] = useState(true)
  const [error, setError] = useState('')
  const [insumoSel, setInsumoSel] = useState(null)
  const [platoSel, setPlatoSel] = useState(null)
  const [datosInsumo, setDatosInsumo] = useState(null)
  const [platosCand, setPlatosCand] = useState([])
  const [cargandoInsumo, setCargandoInsumo] = useState(false)
  const [datosPlato, setDatosPlato] = useState(null)
  const [cargandoPlato, setCargandoPlato] = useState(false)

  // insumos que tienen historial de precios (los únicos con algo que graficar)
  useEffect(() => {
    async function cargar() {
      setCargandoInsumos(true)
      const { data, error: e } = await supabase
        .from('costeo_precios_historial')
        .select('insumo_id, costeo_insumos(nombre)')
        .limit(2000)
      setCargandoInsumos(false)
      if (e) { setError(e.message); return }
      const unicos = Array.from(new Map((data || []).map((d) => [d.insumo_id, d])).values())
        .map((d) => ({ id: d.insumo_id, nombre: d.costeo_insumos?.nombre || '—' }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
      setInsumos(unicos)
    }
    cargar()
  }, [])

  // al elegir insumo: su historial de precio unitario + platos finales que lo usan
  useEffect(() => {
    setPlatoSel(null); setDatosPlato(null)
    if (!insumoSel) { setDatosInsumo(null); setPlatosCand([]); return }
    let cancelado = false
    async function cargar() {
      setCargandoInsumo(true)
      const [{ data: hist }, { data: platos }] = await Promise.all([
        supabase.rpc('costeo_promedio_mensual_insumo', { p_insumo: insumoSel }),
        supabase.rpc('costeo_platos_que_usan_insumo', { p_insumo: insumoSel }),
      ])
      if (cancelado) return
      setDatosInsumo(hist || [])
      setPlatosCand((platos || []).filter((p) => !p.es_subreceta))
      setCargandoInsumo(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [insumoSel])

  // al elegir plato: su historial de costo por porción
  useEffect(() => {
    if (!platoSel) { setDatosPlato(null); return }
    let cancelado = false
    async function cargar() {
      setCargandoPlato(true)
      const { data } = await supabase.rpc('costeo_promedio_mensual_costo', { p_receta: platoSel })
      if (cancelado) return
      setDatosPlato(data || [])
      setCargandoPlato(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [platoSel])

  // series ordenadas ascendente por mes, con el valor ya como número (sin mutar estado)
  const serieInsumo = useMemo(() => (datosInsumo || [])
    .map((d) => ({ mes: d.mes, valor: Number(d.promedio), muestras: d.muestras }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1)), [datosInsumo])
  const seriePlato = useMemo(() => (datosPlato || [])
    .map((d) => ({ mes: d.mes, valor: Number(d.promedio), muestras: d.muestras }))
    .sort((a, b) => (a.mes < b.mes ? -1 : 1)), [datosPlato])

  const insumoNombre = insumos.find((i) => i.id === insumoSel)?.nombre
  const platoNombre = platosCand.find((p) => p.id === platoSel)?.nombre

  return (
    <section className="audit-sec">
      <div className="audit-sec-head">
        <div>
          <h2 className="audit-sec-title">Impacto en el costo de los platos</h2>
          <p className="audit-sec-sub">Elige un insumo para ver cómo se movió su precio y cómo eso afectó a un plato.</p>
        </div>
      </div>

      {error && <div className="f-error">{error}</div>}

      <div className="explorador">
        <div className="f-group" style={{ marginBottom: 0 }}>
          <label className="f-label" htmlFor="exp-insumo">Insumo</label>
          <select id="exp-insumo" className="f-select" value={insumoSel || ''}
            onChange={(e) => setInsumoSel(Number(e.target.value) || null)}
            disabled={cargandoInsumos}>
            <option value="">{cargandoInsumos ? 'Cargando…' : '— elegir insumo —'}</option>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </div>

        {insumoSel && (
          <PanelSerie
            titulo={`Precio de ${insumoNombre}`}
            cargando={cargandoInsumo}
            serie={serieInsumo}
            tipo="bar"
            formatoValor={pesosUnit}
            etiquetaValor="Precio unitario"
            vacio="Este insumo todavía no tiene suficiente historial para graficar."
          />
        )}

        {insumoSel && !cargandoInsumo && (
          <div className="f-group" style={{ marginBottom: 0, marginTop: 4 }}>
            <label className="f-label" htmlFor="exp-plato">Plato afectado</label>
            {platosCand.length === 0 ? (
              <div className="audit-estado" style={{ padding: '6px 0' }}>Ningún plato final usa este insumo.</div>
            ) : (
              <select id="exp-plato" className="f-select" value={platoSel || ''}
                onChange={(e) => setPlatoSel(Number(e.target.value) || null)}>
                <option value="">— elegir plato —</option>
                {platosCand.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
          </div>
        )}

        {platoSel && (
          <PanelSerie
            titulo={`Costo por porción de ${platoNombre}`}
            cargando={cargandoPlato}
            serie={seriePlato}
            tipo="line"
            formatoValor={pesos}
            etiquetaValor="Costo por porción"
            vacio="Este plato todavía no tiene historial de costo registrado."
          />
        )}
      </div>
    </section>
  )
}

// Un panel = resumen textual (comparando mes actual vs anterior) + gráfico.
function PanelSerie({ titulo, cargando, serie, tipo, formatoValor, etiquetaValor, vacio }) {
  const resumen = useMemo(() => {
    if (serie.length === 0) return null
    const ult = serie[serie.length - 1]
    const prev = serie.length > 1 ? serie[serie.length - 2] : null
    const pct = prev && prev.valor > 0 ? ((ult.valor - prev.valor) / prev.valor) * 100 : null
    return { ult, prev, pct }
  }, [serie])

  return (
    <div className="panel-serie">
      <div className="panel-serie-titulo">{titulo}</div>

      {cargando ? (
        <div className="audit-estado">Cargando…</div>
      ) : serie.length === 0 ? (
        <div className="audit-estado">{vacio}</div>
      ) : (
        <>
          <div className="panel-resumen">
            <span className="panel-resumen-val">{formatoValor(resumen.ult.valor)}</span>
            <span className="panel-resumen-mes">en {mesLargo(resumen.ult.mes)}</span>
            {resumen.pct != null && (
              <span className={'panel-resumen-delta ' + (resumen.pct > 0 ? 'sube' : resumen.pct < 0 ? 'baja' : '')}>
                {resumen.pct > 0 ? '▲ +' : resumen.pct < 0 ? '▼ ' : ''}{resumen.pct.toFixed(1)}% vs {mesCorto(resumen.prev.mes)}
              </span>
            )}
          </div>

          <div className="grafico-wrap">
            <ResponsiveContainer width="100%" height="100%">
              {tipo === 'bar' ? (
                <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="var(--ink-soft)" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tickFormatter={tickPesos} stroke="var(--ink-soft)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip cursor={{ fill: 'var(--hairline-soft)' }} content={<TooltipCustom formatoValor={formatoValor} etiquetaValor={etiquetaValor} />} />
                  <Bar dataKey="valor" fill="var(--brick)" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              ) : (
                <LineChart data={serie} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="var(--ink-soft)" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis tickFormatter={tickPesos} stroke="var(--ink-soft)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<TooltipCustom formatoValor={formatoValor} etiquetaValor={etiquetaValor} />} />
                  <Line type="monotone" dataKey="valor" stroke="var(--brick)" strokeWidth={2.5} dot={{ fill: 'var(--brick)', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

function TooltipCustom({ active, payload, label, formatoValor, etiquetaValor }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0].payload
  return (
    <div className="grafico-tooltip">
      <div className="tt-mes">{mesLargo(label)}</div>
      <div className="tt-val">{etiquetaValor}: <b>{formatoValor(p.valor)}</b></div>
      <div className="tt-muestras">{p.muestras} {p.muestras === 1 ? 'registro' : 'registros'} ese mes</div>
    </div>
  )
}
