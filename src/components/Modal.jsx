import { useEffect, useRef } from 'react'
import Icono from './Icono'
import './Modal.css'

const FOCUSABLES = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({ titulo, subtitulo, onClose, children, ancho = 460 }) {
  const cardRef = useRef(null)
  // onClose suele ser una arrow nueva en cada render; si el efecto dependiera de
  // ella, se re-ejecutaría siempre y el foco saltaría mientras el usuario escribe.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const previo = document.activeElement

    function onKey(e) {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      // trampa de foco: sin esto se tabula desde el modal hacia el menú lateral
      // y la lista de atrás, que siguen siendo alcanzables por teclado.
      const focos = cardRef.current?.querySelectorAll(FOCUSABLES)
      if (!focos?.length) return
      const primero = focos[0]
      const ultimo = focos[focos.length - 1]
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
    }

    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // si ningún campo pidió autoFocus, llevamos el foco al diálogo
    if (!cardRef.current?.contains(document.activeElement)) cardRef.current?.focus()

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      if (previo instanceof HTMLElement) previo.focus()
    }
  }, [])

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: ancho }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}
        ref={cardRef}
      >
        <div className="modal-head">
          <div>
            <h3 className="modal-title" id="modal-titulo">{titulo}</h3>
            {subtitulo && <p className="modal-sub">{subtitulo}</p>}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Cerrar"><Icono nombre="cerrar" size={17} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
