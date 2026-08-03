import { useEffect } from 'react'
import './Modal.css'

export default function Modal({ titulo, subtitulo, onClose, children, ancho = 460 }) {
  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" style={{ maxWidth: ancho }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 className="modal-title">{titulo}</h3>
            {subtitulo && <p className="modal-sub">{subtitulo}</p>}
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
