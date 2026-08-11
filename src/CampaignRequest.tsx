// Pedir una campaña de prospección desde el Hub.
//
// Existe para que quien decide a quién atacar no tenga que ser quien sabe ejecutar
// la skill. Juanma rellena cuatro campos desde el móvil y el encargo queda en la
// cola; en local se recoge, se genera la tanda y vuelve al Hub ya con los correos.
//
// El Hub no puede generar nada por su cuenta: es un sitio estático y la skill corre
// en el portátil, con la suscripción de Claude. Este formulario deja el encargo
// puesto, no dispara trabajo.

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Send, Sparkles, X } from 'lucide-react'
import { pedirCampana } from './outreach'

// Los sectores que tienen arquetipo en studio32-agent van primero: si el lead
// convierte, la huella que se mine aquí arranca su configuración sin rehacerse.
const SECTORES = [
  'Clínicas dentales',
  'Barberías',
  'Restaurantes',
  'Fisioterapia',
  'Centros de estética',
  'Talleres',
]

export default function CampaignRequest({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [sector, setSector] = useState(SECTORES[0])
  const [city, setCity] = useState('')
  const [oferta, setOferta] = useState('')
  const [cantidad, setCantidad] = useState(15)
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    if (!city.trim()) {
      setError('Falta la zona: sin ella la búsqueda no acota nada.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await pedirCampana({ sector, city, oferta, cantidad, notas })
      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el encargo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && !guardando && onClose()}
    >
      <section className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="pedir-campana-title">
        <header>
          <span>
            <span className="dialog-icon"><Sparkles size={18} /></span>
            <span>
              <strong id="pedir-campana-title">Pedir una campaña</strong>
              <small>Queda encargada. Los correos llegan cuando se genere la tanda.</small>
            </span>
          </span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar" disabled={guardando}>
            <X size={17} />
          </button>
        </header>

        <form className="campaign-form" onSubmit={enviar}>
          <label>
            <span>Sector</span>
            <select value={sector} onChange={(event) => setSector(event.target.value)}>
              {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <label>
            <span>Zona</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Alcalá de Henares"
              autoFocus
            />
          </label>

          <label>
            <span>Qué les ofrecemos</span>
            <input
              value={oferta}
              onChange={(event) => setOferta(event.target.value)}
              placeholder="Asistente que coge las citas fuera de horario"
            />
            {/* La oferta condiciona el scoring y la redacción: no es decorativa. */}
            <small>Condiciona a quién se busca y cómo se escribe el correo.</small>
          </label>

          <label>
            <span>Cuántos</span>
            <input
              type="number"
              min={1}
              max={50}
              value={cantidad}
              onChange={(event) => setCantidad(Number(event.target.value))}
            />
            <small>Es una petición, no una promesa: los que no pasen el filtro no suben.</small>
          </label>

          <label>
            <span>Algo que debamos saber</span>
            <textarea
              rows={3}
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
              placeholder="Del centro no, ya les escribimos en junio. Prioriza los que no tengan web."
            />
          </label>

          {error && <p className="campaign-form-error">{error}</p>}

          <footer>
            <button type="button" className="secondary-action" onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="primary-action" disabled={guardando}>
              <Send size={16} /> {guardando ? 'Guardando…' : 'Dejar encargada'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
