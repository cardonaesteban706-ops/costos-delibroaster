// Formato de pesos colombianos
export function pesos(n) {
  if (n == null || isNaN(n)) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(n)
}

// Etiqueta legible de la unidad base
export const NOMBRE_BASE = { g: 'gramos', ml: 'mililitros', und: 'unidades' }

// Unidades de compra disponibles según la unidad base del insumo.
// factor = cuántas unidades base tiene 1 de esta unidad de compra.
export const UNIDADES_COMPRA = {
  g: [
    { u: 'g', etiqueta: 'gramos (g)', factor: 1 },
    { u: 'kg', etiqueta: 'kilos (kg)', factor: 1000 },
    { u: 'lb', etiqueta: 'libras (lb)', factor: 453.592 },
  ],
  ml: [
    { u: 'ml', etiqueta: 'mililitros (ml)', factor: 1 },
    { u: 'l', etiqueta: 'litros (L)', factor: 1000 },
  ],
  und: [{ u: 'und', etiqueta: 'unidades', factor: 1 }],
}

// presentación en unidad base -> texto amigable (ej. 4000 g -> "4 kg")
export function presentacionLegible(cant, base) {
  if (base === 'g') {
    if (cant >= 1000 && cant % 1000 === 0) return `${cant / 1000} kg`
    return `${redondea(cant)} g`
  }
  if (base === 'ml') {
    if (cant >= 1000 && cant % 1000 === 0) return `${cant / 1000} L`
    return `${redondea(cant)} ml`
  }
  return cant === 1 ? '1 unidad' : `${redondea(cant)} unidades`
}

export function redondea(n) {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000
}

// iniciales para el avatar de un insumo
export function iniciales(nombre) {
  return (nombre || '').trim().slice(0, 2)
}

// Fecha ISO -> "hace 3 días", "hace 2 meses", etc. (español, sin librerías externas)
export function haceTiempo(fechaISO) {
  if (!fechaISO) return null
  const ms = Date.now() - new Date(fechaISO).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  const anios = Math.floor(meses / 12)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}

// clasificación de qué tan viejo está un precio, para resaltar visualmente
export function frescuraPrecio(fechaISO) {
  if (!fechaISO) return 'sin-dato'
  const dias = (Date.now() - new Date(fechaISO).getTime()) / 86400000
  if (dias > 90) return 'viejo'      // más de 3 meses sin tocar
  if (dias > 30) return 'tibio'      // entre 1 y 3 meses
  return 'fresco'
}
