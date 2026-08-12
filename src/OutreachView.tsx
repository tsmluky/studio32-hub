// Herramientas · Prospección — la cola de revisión.
//
// Lo que se lee primero es la historia del lead y la evidencia que sostiene cada
// afirmación del correo. Aprobar es la decisión; el envío lo hace después la Edge
// Function, que es la única que puede marcar un mensaje como enviado.

import { useState } from 'react'
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, Send, X, Sparkles, Ban } from 'lucide-react'
import { EmptyState, PageHeading, SectionHeader, StatusBadge } from './ui'
import CampaignRequest from './CampaignRequest'
import { darDeBaja, remitentes } from './outreach'
import type { OutreachCampaign, OutreachLead, OutreachMessage } from './outreach'
import type { HubSyncStatus, MemberId } from './types'

export default function OutreachView({
  campaigns,
  leads,
  messages,
  status,
  error,
  activeMemberId,
  onReload,
  onApprove,
  onDiscard,
  onSend,
}: {
  campaigns: OutreachCampaign[]
  leads: OutreachLead[]
  messages: OutreachMessage[]
  status: HubSyncStatus
  error: string
  onReload: () => void
  activeMemberId: MemberId
  onApprove: (messageId: string, leadId: string) => void
  onDiscard: (leadId: string) => void
  onSend: (messageIds: string[]) => Promise<{ enviados: number; total: number }>
}) {
  const [pedirOpen, setPedirOpen] = useState(false)
  const [campaignId, setCampaignId] = useState<string | 'all'>('all')
  const [filter, setFilter] = useState<'review' | 'approved' | 'sent' | 'weak'>('review')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  // Lo encargado y aun sin leads: no entra en los filtros de revision porque
  // todavia no hay nada que revisar.
  const pedidas = campaigns.filter((campana) => campana.status === 'pedida')

  const latestMessageFor = (leadId: string) => messages.find((message) => message.lead_id === leadId)

  const scopedLeads = leads.filter((lead) => {
    if (lead.status === 'descartado') return false
    return campaignId === 'all' || lead.campaign_id === campaignId
  })

  const matchesFilter = (lead: OutreachLead) => {
    const message = latestMessageFor(lead.id)
    if (filter === 'weak') return (lead.huella?.confianza?.nivel ?? 'bajo') !== 'alto'
    if (!message) return false
    if (filter === 'review') return message.status === 'borrador'
    if (filter === 'approved') return message.status === 'aprobado'
    return message.status === 'enviado' || message.status === 'enviando'
  }

  const visibleLeads = scopedLeads.filter(matchesFilter)

  const destinatarios = scopedLeads
    .map((lead) => ({ lead, message: latestMessageFor(lead.id) }))
    .filter((item) => item.message?.status === 'aprobado')
    .map((item) => ({ id: item.message!.id, negocio: item.lead.business_name, email: item.message!.to_email }))

  const enviar = async () => {
    setEnviando(true)
    setAviso('')
    try {
      const resultado = await onSend(destinatarios.map((destinatario) => destinatario.id))
      setAviso(`Enviados ${resultado.enviados} de ${resultado.total}.`)
      setConfirmOpen(false)
    } catch (sendError) {
      setAviso(sendError instanceof Error ? sendError.message : 'No se ha podido enviar.')
    } finally {
      setEnviando(false)
    }
  }

  const countFor = (id: typeof filter) => {
    return scopedLeads.filter((lead) => {
      const message = latestMessageFor(lead.id)
      if (id === 'weak') return (lead.huella?.confianza?.nivel ?? 'bajo') !== 'alto'
      if (!message) return false
      if (id === 'review') return message.status === 'borrador'
      if (id === 'approved') return message.status === 'aprobado'
      return message.status === 'enviado' || message.status === 'enviando'
    }).length
  }

  const filters: Array<{ id: typeof filter; label: string; count: number }> = [
    { id: 'review', label: 'Por revisar', count: countFor('review') },
    { id: 'approved', label: 'Aprobados', count: countFor('approved') },
    { id: 'sent', label: 'Enviados', count: countFor('sent') },
    { id: 'weak', label: 'Evidencia floja', count: countFor('weak') },
  ]

  return (
    <div className="page outreach-page">
      <PageHeading
        eyebrow="Distribución"
        title="Prospección"
        description="Cada correo trae la evidencia que lo sostiene, para revisarlo sin tener que fiarse."
        meta={
          <>
            <button className="secondary-action" type="button" onClick={onReload}><ArrowRight size={16} /> Actualizar</button>
            <button className="primary-action" type="button" onClick={() => setPedirOpen(true)}>
              <Sparkles size={16} /> Pedir campaña
            </button>
          </>
        }
      />

      {/* Lo encargado y todavía sin generar. Va arriba del todo a propósito: es la
          única parte del tablero que espera a una persona concreta, y si no se ve,
          quien lo pidió no sabe si se le ha hecho caso. */}
      {pedidas.length > 0 && (
        <section className="surface campaign-queue">
          <SectionHeader icon={<Clock3 size={17} />} title="Encargadas, pendientes de generar" />
          {pedidas.map((campana) => (
            <article key={campana.id}>
              <span>
                <strong>{campana.name}</strong>
                <small>
                  {campana.cantidad} leads
                  {campana.oferta ? ` · ${campana.oferta}` : ''}
                </small>
                {campana.notas && <small className="campaign-queue-note">{campana.notas}</small>}
              </span>
              <StatusBadge>pedida</StatusBadge>
            </article>
          ))}
          {/* Quien pide una campaña no sabe qué pasa después, y quien la genera no
              recuerda el comando. Las dos cosas se resuelven diciéndolo aquí. */}
          <p className="campaign-queue-foot">
            Ahora le toca a Pancho: la genera en su ordenador con <code>npm run outreach</code> y
            la sube. Cuando esté, estos encargos desaparecen de aquí y sus correos salen abajo,
            listos para revisar.
          </p>
        </section>
      )}

      {pedirOpen && <CampaignRequest onClose={() => setPedirOpen(false)} onDone={onReload} />}

      {status === 'error' ? (
        <section className="surface">
          <EmptyState icon={<AlertCircle size={24} />} title="La prospección no está disponible" body={error} />
        </section>
      ) : status === 'loading' ? (
        <section className="surface">
          <EmptyState icon={<Clock3 size={24} />} title="Cargando" body="Trayendo campañas, leads y borradores." />
        </section>
      ) : (
        <>
          {/* Las campañas se acumulan mes a mes, así que esto es una fila que rueda,
              no una rejilla que crece hacia abajo. Antes usaba `segmented-control`,
              pensado para dos o tres opciones fijas, y con cinco campañas ya se
              convertía en un bloque de dos columnas. */}
          <section className="outreach-bar surface">
            <div className="outreach-campaigns" aria-label="Campaña">
              <button type="button" className={campaignId === 'all' ? 'is-active' : ''} onClick={() => setCampaignId('all')}>
                Todas
              </button>
              {campaigns.filter((campaign) => campaign.status !== 'pedida').map((campaign) => (
                <button key={campaign.id} type="button" className={campaignId === campaign.id ? 'is-active' : ''} onClick={() => setCampaignId(campaign.id)}>
                  {campaign.name}
                </button>
              ))}
            </div>
            <div className="outreach-filters" role="tablist" aria-label="Filtrar correos">
              {filters.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>
                  {item.label}<b>{item.count}</b>
                </button>
              ))}
            </div>
          </section>

          {destinatarios.length > 0 && (
            <section className="outreach-send-bar">
              <span>
                <strong>{destinatarios.length === 1 ? '1 correo aprobado' : `${destinatarios.length} correos aprobados`}</strong>
                <small>Revisados y listos. Salen cuando tú lo digas.</small>
              </span>
              <button className="primary-action" type="button" onClick={() => setConfirmOpen(true)}>
                <Send size={16} /> Enviar
              </button>
            </section>
          )}

          {aviso && <p className="outreach-aviso">{aviso}</p>}

          <section className="surface outreach-list">
            <SectionHeader icon={<Send size={18} />} title="Cola de revisión" action={`${visibleLeads.length}`} />
            {visibleLeads.map((lead) => (
              <LeadStory
                activeMemberId={activeMemberId}
                key={lead.id}
                lead={lead}
                message={latestMessageFor(lead.id)}
                onApprove={onApprove}
                onDiscard={onDiscard}
              />
            ))}
            {!visibleLeads.length && (
              <EmptyState
                icon={<CheckCircle2 size={24} />}
                title="Nada en esta vista"
                body="Cambia el filtro o la campaña. Los borradores los genera la skill de prospección."
              />
            )}
          </section>
        </>
      )}

      {confirmOpen && (
        <SendConfirmDialog
          destinatarios={destinatarios}
          enviando={enviando}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => void enviar()}
        />
      )}
    </div>
  )
}

function LeadStory({
  lead,
  message,
  activeMemberId,
  onApprove,
  onDiscard,
}: {
  lead: OutreachLead
  message?: OutreachMessage
  activeMemberId: MemberId
  onApprove: (messageId: string, leadId: string) => void
  onDiscard: (leadId: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [open, setOpen] = useState(false)
  const [bajando, setBajando] = useState(false)
  const [bajaHecha, setBajaHecha] = useState(false)
  const [bajaError, setBajaError] = useState('')

  // Se pide confirmación porque no hay vuelta atrás desde aquí: para sacar a alguien
  // de la lista de bajas hay que ir a la base de datos. Y es correcto que cueste —
  // el error caro es el contrario, volver a escribir a quien pidió que no.
  const darBaja = async () => {
    if (!lead.email) return
    if (!window.confirm(`No volver a escribir nunca a ${lead.email}.\n\nEsto vale para cualquier campaña futura, no solo esta. ¿Seguro?`)) return
    setBajando(true)
    setBajaError('')
    try {
      await darDeBaja(lead.email)
      setBajaHecha(true)
      onDiscard(lead.id)
    } catch (e) {
      setBajaError(e instanceof Error ? e.message : 'No se ha podido registrar la baja.')
    } finally {
      setBajando(false)
    }
  }

  const huella = lead.huella ?? {}
  const confianza = huella.confianza?.nivel ?? 'bajo'
  const elogios = huella.voz_del_cliente?.elogios_recurrentes ?? []
  const quejas = huella.voz_del_cliente?.quejas_recurrentes ?? []
  const ancla = huella.detalle_ancla?.detalle ?? ''
  const yo = remitentes[activeMemberId]
  const duenyo = lead.owner_member_id ? remitentes[lead.owner_member_id] : null

  // Plegado se ve el estado del correo; abierto ya lo dicen los botones.
  const estadoMensaje = !abierto && message && message.status !== 'borrador'
    ? <StatusBadge>{message.status}</StatusBadge>
    : null

  return (
    <article className="outreach-lead" data-confianza={confianza}>
      {/* La cabecera entera abre y cierra. Con la cola llena, ver cinco correos
          completos de golpe es un muro; plegados se escanea por negocio y se abre el
          que toque. Y como Aprobar vive dentro, no se puede aprobar sin abrir. */}
      <header className="outreach-lead-head">
        <button
          type="button"
          className="outreach-lead-open"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
        >
          <ChevronRight size={16} className={abierto ? 'is-open' : ''} />
          <span>
            <strong>{lead.business_name}</strong>
            <small>{[lead.city, lead.website].filter(Boolean).join(' · ')}</small>
          </span>
        </button>
        <span className="outreach-badges">
          {estadoMensaje}
          <b className="outreach-score">{lead.score}</b>
          <StatusBadge>{confianza === 'alto' ? 'Evidencia alta' : confianza === 'medio' ? 'Evidencia media' : 'Evidencia floja'}</StatusBadge>
        </span>
      </header>

      {/* El porqué se ve siempre, plegado incluido: es lo que se lee para decidir si
          merece la pena abrirlo. */}
      {ancla && (
        <p className={`outreach-anchor${abierto ? '' : ' is-clamped'}`}>{ancla}</p>
      )}

      {!abierto && (
        <button type="button" className="outreach-lead-more" onClick={() => setAbierto(true)}>
          Leer el correo y decidir
        </button>
      )}

      {abierto && (<>
      {confianza !== 'alto' && (
        <p className="outreach-warning">
          <AlertCircle size={15} /> La huella no se pudo verificar del todo. Lee el correo con calma antes de aprobarlo.
        </p>
      )}

      {message ? (
        <div className="outreach-draft">
          <span className="outreach-subject">{message.subject}</span>
          <p>{message.body}</p>
        </div>
      ) : (
        <p className="outreach-empty-draft">Sin borrador todavía.</p>
      )}

      <button className="outreach-toggle" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <ChevronRight size={15} />
        {open ? 'Ocultar de dónde sale' : 'Ver de dónde sale'}
      </button>

      {open && (
        <div className="outreach-evidence">
          {message?.evidencia?.length ? (
            <div className="outreach-quotes">
              {message.evidencia.map((item, index) => (
                <div className="outreach-quote" key={index}>
                  <small>{item.afirmacion}</small>
                  <blockquote>{item.cita}</blockquote>
                  <small>{item.fuente}</small>
                </div>
              ))}
            </div>
          ) : null}

          {elogios.length > 0 && (
            <div className="outreach-quotes">
              {elogios.map((item, index) => (
                <div className="outreach-quote" key={index}>
                  <small>{item.patron} · {item.veces} reseñas</small>
                  <blockquote>{item.cita}</blockquote>
                  <small>{item.fuente}</small>
                </div>
              ))}
            </div>
          )}

          {quejas.length > 0 && (
            <div className="outreach-quotes">
              {quejas.filter((item) => item.cita).map((item, index) => (
                <div className="outreach-quote is-complaint" key={index}>
                  <small>{item.patron} · no se menciona en el correo</small>
                  <blockquote>{item.cita}</blockquote>
                  <small>{item.fuente}</small>
                </div>
              ))}
            </div>
          )}

          {(huella.huecos_digitales?.length ?? 0) > 0 && (
            <p className="outreach-gaps">{huella.huecos_digitales?.join(' · ')}</p>
          )}
        </div>
      )}

      {/* Quién se queda el cliente. Aprobar no es solo un visto bueno: fija de quién
          sale el correo y a quién le vuelve la respuesta, porque todas caen en el
          mismo buzón y si no consta el dueño, no consta. */}
      {message?.status === 'borrador' ? (
        <p className="outreach-signer">
          Lo firmas tú: <strong>{yo?.nombre}</strong> &lt;{yo?.email}&gt;. Al aprobarlo, este
          negocio pasa a ser tuyo.
        </p>
      ) : duenyo ? (
        <p className="outreach-signer is-owned">
          Cliente de <strong>{duenyo.nombre}</strong>. El correo sale de {duenyo.email}.
        </p>
      ) : null}

      <div className="outreach-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={!message || message.status !== 'borrador'}
          onClick={() => message && onApprove(message.id, lead.id)}
        >
          <Check size={16} /> {message?.status === 'aprobado' ? 'Aprobado' : 'Aprobar y quedármelo'}
        </button>
        <button type="button" onClick={() => onDiscard(lead.id)}><X size={16} /> Descartar</button>
        {/* Descartar saca al lead de esta campaña. La baja es otra cosa: bloquea la
            dirección para siempre, aunque mañana vuelva dentro de otro negocio. */}
        <button
          type="button"
          className="outreach-baja"
          disabled={!lead.email || bajando}
          title={lead.email ? `No volver a escribir a ${lead.email}` : 'Este lead no tiene correo'}
          onClick={() => void darBaja()}
        >
          <Ban size={16} /> {bajaHecha ? 'En la lista de bajas' : 'No escribir más'}
        </button>
      </div>
      {bajaError && <p className="outreach-baja-error"><AlertCircle size={14} /> {bajaError}</p>}
      </>)}
    </article>
  )
}

function SendConfirmDialog({
  destinatarios,
  enviando,
  onClose,
  onConfirm,
}: {
  destinatarios: Array<{ id: string; negocio: string; email: string }>
  enviando: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !enviando && onClose()}>
      <section className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="send-dialog-title">
        <header>
          <span>
            <span className="dialog-icon"><Send size={18} /></span>
            <span>
              <strong id="send-dialog-title">Enviar {destinatarios.length === 1 ? 'un correo' : `${destinatarios.length} correos`}</strong>
              <small>Salen ahora mismo. No hay forma de recuperarlos.</small>
            </span>
          </span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar" disabled={enviando}><X size={17} /></button>
        </header>

        <div className="send-recipients">
          {destinatarios.map((destinatario) => (
            <div key={destinatario.id}>
              <strong>{destinatario.negocio}</strong>
              <small>{destinatario.email}</small>
            </div>
          ))}
        </div>

        <footer className="task-dialog-footer">
          <span />
          <span>
            <button className="text-button" type="button" onClick={onClose} disabled={enviando}>Cancelar</button>
            <button className="primary-action" type="button" onClick={onConfirm} disabled={enviando}>
              <Send size={16} /> {enviando ? 'Enviando…' : 'Enviar ahora'}
            </button>
          </span>
        </footer>
      </section>
    </div>
  )
}

