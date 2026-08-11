// Herramientas · Prospección — la bandeja inversa de captación.
//
// La idea de la herramienta: en vez de que el equipo busque a quién escribir, la
// skill sube leads con el correo YA redactado y su porqué. Aquí solo se lee y se
// decide. Aprobar es la decisión; el envío lo hace después el script local.
//
// Dos cosas que no son negociables en esta pantalla:
//
//   1. El porqué se lee ANTES que el correo. Es lo que sostiene la decisión, y va
//      con su evidencia debajo. Si alguien aprueba sin leerlo, la herramienta ya no
//      vale nada — es lo mismo que mandar plantillas.
//   2. La huella, el porqué y los scores no se editan. Son la evidencia de por qué
//      se envió ese correo, y tienen que seguir siendo auditables después. Si están
//      mal, se corrige la skill y se vuelve a subir.

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Circle,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Send,
  ShieldQuestion,
  Sparkles,
  X,
} from 'lucide-react'
import { EmptyState, PageHeading } from './ui'
import { isSupabaseConfigured } from './supabase'
import {
  type Angulo,
  type Dolor,
  type Lead,
  type LeadEstado,
  type SenderId,
  angulos,
  citable,
  componerCorreo,
  dolores,
  fetchLeads,
  remitentes,
  subscribeToLeads,
  updateLead,
} from './leads'

type Filtro = 'pendiente' | 'aprobado' | 'enviado' | 'cerrado'

const filtros: Array<{ id: Filtro; label: string; estados: LeadEstado[] }> = [
  { id: 'pendiente', label: 'Por revisar', estados: ['pendiente'] },
  { id: 'aprobado', label: 'Listos para enviar', estados: ['aprobado', 'fallido'] },
  { id: 'enviado', label: 'Enviados', estados: ['enviado'] },
  { id: 'cerrado', label: 'Cerrados', estados: ['rechazado', 'baja', 'respondido', 'no_interesa'] },
]

const estadoLabel: Record<LeadEstado, string> = {
  pendiente: 'Por revisar',
  aprobado: 'Listo para enviar',
  rechazado: 'Rechazado',
  enviado: 'Enviado',
  fallido: 'Falló el envío',
  baja: 'No volver a escribir',
  respondido: 'Respondió',
  no_interesa: 'No le interesa',
}

const verticalLabel: Record<string, string> = {
  clinica_dental: 'Clínica dental',
  barberia: 'Barbería',
  restaurante: 'Restaurante',
  otro: 'Otro',
}

export default function ProspectingView({ activeMemberId }: { activeMemberId: SenderId }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [estado, setEstado] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('pendiente')

  const cargar = async () => {
    try {
      setLeads(await fetchLeads())
      setEstado('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
      setEstado('error')
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEstado('error')
      setError('Supabase no está configurado en este entorno.')
      return
    }
    void cargar()
    // Otro miembro puede estar decidiendo a la vez: la bandeja se refresca sola.
    return subscribeToLeads(() => void cargar())
  }, [])

  const porFiltro = useMemo(() => {
    const activos = filtros.find((f) => f.id === filtro)?.estados ?? []
    return leads.filter((l) => activos.includes(l.estado))
  }, [leads, filtro])

  // Agrupadas por tanda porque es como se sube y como se revisa: "los dentistas de
  // Alcalá del martes" es una unidad mental, no veinte leads sueltos.
  const porTanda = useMemo(() => {
    const grupos = new Map<string, Lead[]>()
    for (const lead of porFiltro) {
      const clave = lead.tanda ?? 'Sin tanda'
      grupos.set(clave, [...(grupos.get(clave) ?? []), lead])
    }
    return [...grupos.entries()]
  }, [porFiltro])

  const cuenta = (f: Filtro) => {
    const activos = filtros.find((x) => x.id === f)?.estados ?? []
    return leads.filter((l) => activos.includes(l.estado)).length
  }

  const aprobados = cuenta('aprobado')

  return (
    <div className="page narrow-page">
      <PageHeading
        eyebrow="Herramientas"
        title="Prospección"
        description="Leads con el correo ya redactado. Lee el porqué, ajusta si hace falta y aprueba."
        meta={
          aprobados > 0 ? (
            <span className="prospect-ready-pill" title="Salen en la próxima pasada del script de envío">
              <Send size={15} /> {aprobados} listos para enviar
            </span>
          ) : undefined
        }
      />

      <div className="prospect-filters" role="tablist" aria-label="Estado de los leads">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtro === f.id}
            className={filtro === f.id ? 'is-active' : ''}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
            <b>{cuenta(f.id)}</b>
          </button>
        ))}
      </div>

      {estado === 'loading' && (
        <section className="surface">
          <EmptyState icon={<Circle size={23} />} title="Cargando la bandeja" body="Consultando los leads del workspace." />
        </section>
      )}

      {estado === 'error' && (
        <section className="surface">
          <EmptyState
            icon={<AlertCircle size={23} />}
            title="No se pudo leer la bandeja"
            body={`${error.replace(/\.$/, '')}. Si la tabla "leads" aún no existe, aplícala con npm run supabase:migrate.`}
          />
        </section>
      )}

      {estado === 'ready' && porFiltro.length === 0 && (
        <section className="surface">
          <EmptyState
            icon={<Sparkles size={25} />}
            title={filtro === 'pendiente' ? 'Nada por revisar' : 'Nada aquí'}
            body={
              filtro === 'pendiente'
                ? 'Cuando se suba una tanda nueva desde la skill, aparecerá aquí.'
                : 'Cambia de pestaña para ver los leads en otro estado.'
            }
          />
        </section>
      )}

      {estado === 'ready' &&
        porTanda.map(([tanda, deTanda]) => (
          <section className="prospect-batch" key={tanda}>
            <h2 className="prospect-batch-title">
              {tanda} <small>{deTanda.length}</small>
            </h2>
            {deTanda.map((lead) => (
              <LeadCard key={lead.id} lead={lead} activeMemberId={activeMemberId} onDone={cargar} />
            ))}
          </section>
        ))}
    </div>
  )
}

function LeadCard({
  lead,
  activeMemberId,
  onDone,
}: {
  lead: Lead
  activeMemberId: SenderId
  onDone: () => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [asunto, setAsunto] = useState(lead.asunto)
  const [cuerpo, setCuerpo] = useState(lead.cuerpo)
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState('')

  const remitente = remitentes[lead.sender_id]
  const esMio = lead.sender_id === activeMemberId
  const decidible = lead.estado === 'pendiente' || lead.estado === 'aprobado' || lead.estado === 'fallido'

  const aplicar = async (cambios: Parameters<typeof updateLead>[1]) => {
    setGuardando(true)
    setFallo('')
    try {
      await updateLead(lead.id, cambios)
      await onDone()
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  // Reclamar el envío: el lead sube con un remitente sugerido, pero quien aprueba
  // puede quedárselo. Es seguro porque el cuerpo no lleva firma — la compone el
  // envío desde el sender_id. Importa porque la respuesta cae en el buzón de quien
  // firma, y quien firma debería ser quien va a seguir la conversación.
  const reclamar = () => aplicar({ sender_id: activeMemberId })

  return (
    <article className={`prospect-card estado-${lead.estado}`}>
      <header>
        <button
          type="button"
          className="prospect-card-toggle"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          <ChevronRight size={17} className={abierto ? 'is-open' : ''} />
          <span>
            <strong>{lead.nombre}</strong>
            <small>
              {verticalLabel[lead.vertical] ?? lead.vertical} · {lead.ciudad}
            </small>
          </span>
        </button>
        <span className={`prospect-estado estado-${lead.estado}`}>{estadoLabel[lead.estado]}</span>
      </header>

      {/* El porqué siempre visible, sin desplegar: es lo que se lee para decidir. */}
      <p className="prospect-porque">{lead.porque}</p>

      <div className="prospect-meta">
        {lead.opportunity_score != null && (
          <span title="Studio32 Opportunity Score: cuánto encaja como cliente">
            Oportunidad <b>{lead.opportunity_score}</b>
          </span>
        )}
        {lead.digital_score != null && (
          <span title="Digital Presence Score: qué tal está hoy su presencia. Bajo = más margen">
            Presencia <b>{lead.digital_score}</b>
          </span>
        )}
        <span className="prospect-sender" title={`El correo sale de ${remitente?.email ?? lead.sender_id}`}>
          <Mail size={13} /> {remitente?.nombre ?? lead.sender_id}
        </span>
      </div>

      {abierto && (
        <div className="prospect-detail">
          <div className="prospect-links">
            {lead.web && (
              <a href={lead.web} target="_blank" rel="noopener noreferrer">
                <Globe size={14} /> Web <ExternalLink size={12} />
              </a>
            )}
            {lead.maps_url && (
              <a href={lead.maps_url} target="_blank" rel="noopener noreferrer">
                <MapPin size={14} /> Maps <ExternalLink size={12} />
              </a>
            )}
            <span className="prospect-email">{lead.email}</span>
          </div>

          <Evidencia dolor={dolores(lead.huella)} angulo={angulos(lead.huella)} />

          <section className="prospect-mail">
            <div className="prospect-mail-head">
              <span>El correo</span>
              {decidible && (
                <button type="button" className="link-button" onClick={() => setEditando((v) => !v)}>
                  <Pencil size={13} /> {editando ? 'Ver como saldrá' : 'Editar'}
                </button>
              )}
            </div>

            {editando ? (
              <>
                <input
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  aria-label="Asunto del correo"
                  placeholder="Asunto"
                />
                <textarea
                  value={cuerpo}
                  onChange={(e) => setCuerpo(e.target.value)}
                  rows={10}
                  aria-label="Cuerpo del correo"
                />
                <small className="prospect-hint">
                  No escribas la firma: se añade sola con los datos de {remitente?.nombre ?? lead.sender_id}.
                </small>
                <div className="prospect-actions">
                  <button
                    type="button"
                    className="small-primary"
                    disabled={guardando || (asunto === lead.asunto && cuerpo === lead.cuerpo)}
                    onClick={async () => {
                      await aplicar({ asunto, cuerpo })
                      setEditando(false)
                    }}
                  >
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAsunto(lead.asunto)
                      setCuerpo(lead.cuerpo)
                      setEditando(false)
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </>
            ) : (
              <div className="prospect-preview">
                <span className="prospect-preview-from">
                  De: {remitente?.nombre} &lt;{remitente?.email}&gt;
                </span>
                <strong>{lead.asunto}</strong>
                <pre>{componerCorreo(lead)}</pre>
              </div>
            )}
          </section>

          {decidible && !esMio && (
            <button type="button" className="prospect-claim" onClick={() => void reclamar()} disabled={guardando}>
              <Send size={14} /> Lo envío yo — pasa a {remitentes[activeMemberId]?.nombre}
            </button>
          )}

          {lead.estado === 'fallido' && lead.error_envio && (
            <p className="prospect-error">
              <AlertCircle size={14} /> El envío falló: {lead.error_envio}
            </p>
          )}
        </div>
      )}

      {fallo && <p className="prospect-error"><AlertCircle size={14} /> {fallo}</p>}

      <footer className="prospect-actions">
        {lead.estado === 'pendiente' && (
          <>
            <button type="button" className="small-primary" disabled={guardando} onClick={() => void aplicar({ estado: 'aprobado' })}>
              <Check size={15} /> Aprobar
            </button>
            <button type="button" className="small-ghost" disabled={guardando} onClick={() => void aplicar({ estado: 'rechazado' })}>
              <X size={15} /> Rechazar
            </button>
          </>
        )}

        {lead.estado === 'aprobado' && (
          <>
            <span className="prospect-waiting">
              <Send size={14} /> Sale en la próxima pasada del envío
            </span>
            <button type="button" className="small-ghost" disabled={guardando} onClick={() => void aplicar({ estado: 'pendiente' })}>
              Devolver a revisión
            </button>
          </>
        )}

        {lead.estado === 'fallido' && (
          <button type="button" className="small-primary" disabled={guardando} onClick={() => void aplicar({ estado: 'aprobado' })}>
            Reintentar el envío
          </button>
        )}

        {/* Cerrar el ciclo. Sin esto la bandeja se queda en "enviado" para siempre y
            no hay forma de saber a quién ya se le hizo caso. */}
        {lead.estado === 'enviado' && (
          <>
            <button type="button" className="small-primary" disabled={guardando} onClick={() => void aplicar({ estado: 'respondido' })}>
              Respondió
            </button>
            <button type="button" className="small-ghost" disabled={guardando} onClick={() => void aplicar({ estado: 'no_interesa' })}>
              No le interesa
            </button>
          </>
        )}

        {lead.estado !== 'baja' && (
          <button
            type="button"
            className="small-ghost danger"
            disabled={guardando}
            title="No volver a escribir a este negocio nunca"
            onClick={() => void aplicar({ estado: 'baja' })}
          >
            No escribir más
          </button>
        )}
      </footer>
    </article>
  )
}

/**
 * La evidencia que sostiene el correo: qué le duele y por dónde se entra.
 *
 * Solo se muestran los dolores de confianza alta o media. Los de confianza baja
 * orientaron el ángulo pero no pueden citarse en el texto, y enseñarlos aquí invita a
 * que alguien los use al editar el correo.
 */
function Evidencia({ dolor, angulo }: { dolor: Dolor[]; angulo: Angulo[] }) {
  const visibles = dolor.filter(citable)
  if (!visibles.length && !angulo.length) return null
  return (
    <section className="prospect-evidence">
      {visibles.length > 0 && (
        <>
          <span className="prospect-evidence-title">
            <ShieldQuestion size={14} /> Qué le duele
          </span>
          <ul>
            {visibles.map((d, i) => (
              <li key={i}>
                <strong>{d.dolor}</strong>
                <small>{d.evidencia}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {angulo.length > 0 && (
        <>
          <span className="prospect-evidence-title">
            <Sparkles size={14} /> Por dónde se entra
          </span>
          <ul>
            {angulo.map((a, i) => (
              <li key={i}>
                <strong>{a.angulo}</strong>
                <small>{a.apoyado_en}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
