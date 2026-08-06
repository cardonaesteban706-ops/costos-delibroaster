// Set de íconos de línea, un solo trazo, redondeados — heredan el color con
// currentColor. Reemplazan a los emoji para tener una iconografía coherente.
export default function Icono({ nombre, size = 18, className, stroke = 1.8 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': true, className,
    style: { display: 'block', flexShrink: 0 },
  }
  switch (nombre) {
    case 'buscar':
      return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20.5 20.5 16 16" /></svg>
    case 'etiqueta':
      return (
        <svg {...p}>
          <path d="M3 12.5V5.5A2 2 0 0 1 5 3.5h6.6a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L3.6 13.9A2 2 0 0 1 3 12.5Z" />
          <circle cx="7.7" cy="7.7" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'reloj':
      return <svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
    case 'candado':
      return (
        <svg {...p}>
          <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
      )
    case 'check':
      return <svg {...p}><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></svg>
    case 'alerta':
      return (
        <svg {...p}>
          <path d="M12 3.6 22 20H2Z" />
          <path d="M12 9.5v4.2" />
          <path d="M12 17.3v.01" />
        </svg>
      )
    case 'cerrar':
      return <svg {...p}><path d="M6 6 18 18M18 6 6 18" /></svg>
    case 'olla':
      // estado vacío de recetas: una olla con vapor
      return (
        <svg {...p}>
          <path d="M4 9.5h16" />
          <path d="M6 9.5v6.5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9.5" />
          <path d="M2.5 9.5h1.5M20 9.5h1.5" />
          <path d="M9.5 6c0-1.2.7-2 1.5-2M13 6c0-1.2.7-2 1.5-2" />
        </svg>
      )
    default:
      return null
  }
}
