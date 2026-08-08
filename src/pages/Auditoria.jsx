import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Modal from '../components/Modal'
import Icono from '../components/Icono'
import { pesos } from '../lib/formato'
import './Auditoria.css'

const DIEZ_MIN = 10 * 60 * 1000

export default function Auditoria() {
  const { perfil } = useAuth()
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [desbloqueadoHasta, setDesbloqueadoHasta] = useState(null)
  const [mostrarClave, setMostrarClave] = useState(false)
  const [conteos, setConteos] = useState({})

  // intenta recuperar el desbloqueado del sessionStorage
  useEffect(() => {
    const guardado = sessionStorage.getItem('costeo_zona_sensible_hasta')
    if (guardado) {
      const hasta = Number(guardado)
      if (Date.now() < hasta) {
        setDesbloqueadoHasta(hasta)
        setDesbloqueado(true)
      } else {
        sessionStorage.removeItem('costeo_zona_sensible_hasta')
      }
    }
  }, [])

  // refresca el estado de desbloqueado cada segundo
  useEffect(() => {
    if (!desbloqueadoHasta) return
    const timer = setInterval(() => {
      if (Date.now() >= desbloqueadoHasta) {
        setDesbloqueado(false)
        setDesbloqueadoHasta(null)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [desbloqueadoHasta])

  // carga conteos
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

  function desbloquearClave() {
    setMostrarClave(true)
  }

  return (
    <Layout conteos={conteos}>
      <div className="main-head">
        <div>
          <h1 className="main-title">Auditoría</h1>
          <p className="main-sub">Historial de cambios en precios e impacto en costos.</p>
        </div>
      </div>

      {!desbloqueado ? (
        <div className="blur-content" onClick={desbloquearClave} style={{ cursor: 'pointer', textAlign: 'center', paddingTop: 60 }}>
          <Icono nombre="candado" size={48} style={{ marginBottom: 20, opacity: 0.5 }} />
          <p style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>Ingresa la clave de dirección para ver esta información.</p>
          <button className="btn btn-primary">Desbloquear</button>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 22 }}>
            <SeccionCambiosPrecio />
            <SeccionImpactoPlatos />
          </div>
        </>
      )}

      {mostrarClave && (
        <ClaveForm
          onClose={() => setMostrarClave(false)}
          onDesbloqueado={() => {
            const hasta = Date.now() + DIEZ_MIN
            setDesbloqueadoHasta(hasta)
            setDesbloqueado(true)
            sessionStorage.setItem('costeo_zona_sensible_hasta', hasta.toString())
            setMostrarClave(false)
          }}
        />
      )}
    </Layout>
  )
}

function ClaveForm({ onClose, onDesbloqueado }) {
  const [clave, setClave] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [error, setError] = useState('')

  async function verificar() {
    setError('')
    if (!clave.trim()) return setError('Ingresa la clave.')
    setVerificando(true)
    const { data, error: e } = await supabase.rpc('costeo_verificar_clave', { p_clave: clave })
    setVerificando(false)
    if (e || !data) return setError('Clave incorrecta.')
    onDesbloqueado()
  }

  return (
    <Modal titulo="Clave de dirección" onClose={onClose} ancho={380}>
      <div className="f-group">
        <label className="f-label" htmlFor="clave-input">Clave</label>
        <input
          id="clave-input"
          className="f-input"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && verificar()}
          autoFocus
        />
      </div>
      {error && <div className="f-error">{error}</div>}
      <div className="f-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={verificar} disabled={verificando}>
          {verificando ? 'Verificando…' : 'Desbloquear'}
        </button>
      </div>
    </Modal>
  )
}

function SeccionCambiosPrecio() {
  const [historial, setHistorial] = useState(null)
  const [insumos, setInsumos] = useState({})
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [filtroFecha, setFiltroFecha] = useState('30')

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setError('')
      const diasAtras = Number(filtroFecha)
      const fechaLimite = new Date()
      fechaLimite.setDate(fechaLimite.getDate() - diasAtras)

      const { data, error: e } = await supabase
        .from('costeo_precios_historial')
        .select('*, costeo_insumos(id, nombre)')
        .gte('vigente_desde', fechaLimite.toISOString())
        .order('vigente_desde', { ascending: false })

      setCargando(false)
      if (e) {
        setError(e.message || 'No pudimos cargar el historial.')
        return
      }

      setHistorial(data || [])

      // pre-cargar conteos de platos afectados
      const ids = [...new Set((data || []).map((p) => p.insumo_id))]
      const conteos = {}
      for (const id of ids) {
        const { data: n } = await supabase.rpc('costeo_platos_afectados', { p_insumo: id })
        conteos[id] = n ?? 0
      }
      setInsumos(
        ids.reduce((acc, id) => {
          acc[id] = conteos[id]
          return acc
        }, {})
      )
    }
    cargar()
  }, [filtroFecha])

  // agrupa por insumo_id y calcula cambio anterior → nuevo
  const cambios = useMemo(() => {
    if (!historial) return []
    const porInsumo = {}
    historial.forEach((h) => {
      if (!porInsumo[h.insumo_id]) porInsumo[h.insumo_id] = []
      porInsumo[h.insumo_id].push(h)
    })

    const resultado = []
    Object.entries(porInsumo).forEach(([insId, filas]) => {
      // filas ya están ordenadas desc por vigente_desde
      for (let i = 0; i < filas.length - 1; i++) {
        const actual = filas[i]
        const anterior = filas[i + 1]
        // solo muestra cambios reales (precio diferente)
        if (Number(actual.precio) !== Number(anterior.precio)) {
          resultado.push({
            insumo_id: Number(insId),
            insumo_nombre: actual.costeo_insumos?.nombre || '—',
            precio_anterior: Number(anterior.precio),
            precio_nuevo: Number(actual.precio),
            fecha: actual.vigente_desde,
            platos_afectados: insumos[insId] || 0,
          })
        }
      }
    })
    return resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [historial, insumos])

  return (
    <div style={{ marginBottom: 40 }}>
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 4 }}>Cambios de precios de insumos</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>Precio anterior → nuevo, con cantidad de platos afectados.</p>
        </div>
        <select
          className="f-select"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          style={{ width: 150 }}
        >
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="365">Todo el año</option>
          <option value="99999">Todo el tiempo</option>
        </select>
      </div>

      {cargando && <div className="f-hint">Cargando…</div>}
      {error && <div className="f-error">{error}</div>}

      {!cargando && !error && cambios.length === 0 && (
        <div className="vacio">No hay cambios de precio en este período.</div>
      )}

      {!cargando && !error && cambios.length > 0 && (
        <div className="cambios-tabla">
          <div className="cambios-head">
            <div className="cambios-col insumo">Insumo</div>
            <div className="cambios-col precio">Precio anterior</div>
            <div className="cambios-col precio">Precio nuevo</div>
            <div className="cambios-col cambio">% cambio</div>
            <div className="cambios-col fecha">Fecha</div>
            <div className="cambios-col platos">Platos afectados</div>
          </div>
          {cambios.map((c, i) => {
            const pctCambio = c.precio_anterior > 0 ? ((c.precio_nuevo - c.precio_anterior) / c.precio_anterior) * 100 : 0
            const fecha = new Date(c.fecha)
            return (
              <div className="cambios-row" key={i}>
                <div className="cambios-col insumo">{c.insumo_nombre}</div>
                <div className="cambios-col precio">{pesos(c.precio_anterior)}</div>
                <div className="cambios-col precio">{pesos(c.precio_nuevo)}</div>
                <div className={'cambios-col cambio ' + (pctCambio > 0 ? 'sube' : 'baja')}>
                  {pctCambio > 0 ? '+' : ''}{pctCambio.toFixed(1)}%
                </div>
                <div className="cambios-col fecha">{fecha.toLocaleDateString('es-CO')}</div>
                <div className="cambios-col platos">{c.platos_afectados}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SeccionImpactoPlatos() {
  const [insumos, setInsumos] = useState([])
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null)
  const [platoSeleccionado, setPlatoSeleccionado] = useState(null)
  const [platosCandidatos, setPlatosCandidatos] = useState([])
  const [datosInsumo, setDatosInsumo] = useState(null)
  const [datosPlato, setDatosPlato] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // carga insumos que tienen historial de precios
  useEffect(() => {
    async function cargar() {
      setCargando(true)
      setError('')
      const { data, error: e } = await supabase
        .from('costeo_precios_historial')
        .select('insumo_id, costeo_insumos(id, nombre)')
        .limit(1000)

      setCargando(false)
      if (e) {
        setError(e.message)
        return
      }

      const unicos = Array.from(new Map((data || []).map((d) => [d.insumo_id, d])).values())
        .map((d) => ({ id: d.insumo_id, nombre: d.costeo_insumos?.nombre }))
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))

      setInsumos(unicos)
    }
    cargar()
  }, [])

  // cuando selecciona insumo, carga platos que lo usan
  useEffect(() => {
    if (!insumoSeleccionado) {
      setPlatosCandidatos([])
      setDatosInsumo(null)
      setPlatoSeleccionado(null)
      return
    }

    async function cargar() {
      setCargando(true)
      // historial del insumo
      const { data: hist } = await supabase.rpc('costeo_promedio_mensual_insumo', {
        p_insumo: insumoSeleccionado,
      })
      setDatosInsumo(hist || [])

      // platos que lo usan
      const { data: platos } = await supabase.rpc('costeo_platos_que_usan_insumo', {
        p_insumo: insumoSeleccionado,
      })
      const finales = (platos || []).filter((p) => !p.es_subreceta)
      setPlatosCandidatos(finales)
      setCargando(false)
    }
    cargar()
  }, [insumoSeleccionado])

  // cuando selecciona plato, carga su historial de costo
  useEffect(() => {
    if (!platoSeleccionado) {
      setDatosPlato(null)
      return
    }

    async function cargar() {
      const { data } = await supabase.rpc('costeo_promedio_mensual_costo', {
        p_receta: platoSeleccionado,
      })
      setDatosPlato(data || [])
    }
    cargar()
  }, [platoSeleccionado])

  const insumoNombre = insumos.find((i) => i.id === insumoSeleccionado)?.nombre
  const platoNombre = platosCandidatos.find((p) => p.id === platoSeleccionado)?.nombre

  return (
    <div>
      <div className="section-head">
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 4 }}>Impacto en costos de platos</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)' }}>Historial de precios e impacto en costo de platos.</p>
        </div>
      </div>

      {cargando ? (
        <div className="f-hint">Cargando…</div>
      ) : (
        <>
          <div className="f-group" style={{ marginBottom: 20 }}>
            <label className="f-label">Selecciona un insumo</label>
            <select
              className="f-select"
              value={insumoSeleccionado || ''}
              onChange={(e) => setInsumoSeleccionado(Number(e.target.value) || null)}
              style={{ width: '100%' }}
            >
              <option value="">— elegir —</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && <div className="f-error">{error}</div>}

          {insumoSeleccionado && (
            <>
              <div className="audit-chart" style={{ marginBottom: 30 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Historial de precio: {insumoNombre}</div>
                {datosInsumo && datosInsumo.length > 0 ? (
                  <>
                    <div style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 16 }}>
                      <p style={{ marginBottom: 8 }}>
                        Promedio: <b>{pesos(Number(datosInsumo[0].promedio))}</b> en el mes más reciente · {datosInsumo.length} mes{datosInsumo.length === 1 ? '' : 'es'} de datos
                      </p>
                    </div>
                    <div style={{ width: '100%', height: 300, marginBottom: 16 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={datosInsumo.reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                          <XAxis
                            dataKey="mes"
                            stroke="var(--ink-soft)"
                            tickFormatter={(d) => new Date(d).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
                            style={{ fontSize: '0.85rem' }}
                          />
                          <YAxis
                            stroke="var(--ink-soft)"
                            tickFormatter={(d) => `$${Math.round(d / 1000)}k`}
                            style={{ fontSize: '0.85rem' }}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}
                            labelFormatter={(d) => new Date(d).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                            formatter={(value) => [pesos(Number(value)), 'Promedio']}
                          />
                          <Bar dataKey="promedio" fill="var(--brick)" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="f-hint">No hay datos de historial para este insumo.</div>
                )}
              </div>

              <div className="f-group" style={{ marginBottom: 20 }}>
                <label className="f-label">Selecciona un plato afectado</label>
                <select
                  className="f-select"
                  value={platoSeleccionado || ''}
                  onChange={(e) => setPlatoSeleccionado(Number(e.target.value) || null)}
                  style={{ width: '100%' }}
                >
                  <option value="">— elegir —</option>
                  {platosCandidatos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {platoSeleccionado && (
                <div className="audit-chart">
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Historial de costo: {platoNombre}</div>
                  {datosPlato && datosPlato.length > 0 ? (
                    <>
                      <div style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', marginBottom: 16 }}>
                        <p style={{ marginBottom: 8 }}>
                          Promedio: <b>{pesos(Number(datosPlato[0].promedio))}</b> en el mes más reciente · {datosPlato.length} mes{datosPlato.length === 1 ? '' : 'es'} de datos
                        </p>
                        {datosPlato.length > 1 && (
                          <p>
                            Variación: <b>{((Number(datosPlato[0].promedio) - Number(datosPlato[datosPlato.length - 1].promedio)) / Number(datosPlato[datosPlato.length - 1].promedio) * 100).toFixed(1)}%</b> desde el mes más antiguo
                          </p>
                        )}
                      </div>
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={datosPlato.reverse()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                            <XAxis
                              dataKey="mes"
                              stroke="var(--ink-soft)"
                              tickFormatter={(d) => new Date(d).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })}
                              style={{ fontSize: '0.85rem' }}
                            />
                            <YAxis
                              stroke="var(--ink-soft)"
                              tickFormatter={(d) => `$${Math.round(d / 1000)}k`}
                              style={{ fontSize: '0.85rem' }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}
                              labelFormatter={(d) => new Date(d).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                              formatter={(value) => [pesos(Number(value)), 'Costo por porción']}
                            />
                            <Line type="monotone" dataKey="promedio" stroke="var(--brick)" strokeWidth={2} dot={{ fill: 'var(--brick)', r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div className="f-hint">No hay datos de costo para este plato.</div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
