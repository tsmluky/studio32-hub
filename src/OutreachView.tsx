// Herramientas · Prospección — la cola de revisión.
//
// Lo que se lee primero es la historia del lead y la evidencia que sostiene cada
// afirmación del correo. Aprobar es la decisión; el envío lo hace después la Edge
// Function, que es la única que puede marcar un mensaje como enviado.

import { useState } from 'react'
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, Send, X } from 'lucide-react'
import { EmptyState, PageHeading, SectionHeader, StatusBadge } from './ui'
import type { OutreachCampaign, OutreachLead, OutreachMessage } from './outreach'
import type { HubSyncStatus } from './types'

export default function OutreachView({
  campaigns,
  leads,
  messages,
  status,
  error,
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
  onApprove: (messageId: string) => void
  onDiscard: (leadId: string) => void
  onSend: (messageIds: string[]) => Promise<{ enviados: number; total: number }>
}) {
  const [campaignId, setCampaignId] = useState<string | 'all'>('all')
  const [filter, setFilter] = useState<'review' | 'approved' | 'sent' | 'weak'>('review')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

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
        meta={<button className="secondary-action" type="button" onClick={onReload}><ArrowRight size={16} /> Actualizar</button>}
      />

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
          <section className="task-command-bar surface">
            <div className="segmented-control" aria-label="Campaña">
              <button type="button" className={campaignId === 'all' ? 'is-active' : ''} onClick={() => setCampaignId('all')}>Todas</button>
              {campaigns.map((campaign) => (
                <button key={campaign.id} type="button" className={campaignId === campaign.id ? 'is-active' : ''} onClick={() => setCampaignId(campaign.id)}>
                  {campaign.name}
                </button>
              ))}
            </div>
            <div className="task-filter-tabs" role="tablist" aria-label="Filtrar correos">
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
  onApprove,
  onDiscard,
}: {
  lead: OutreachLead
  message?: OutreachMessage
  onApprove: (messageId: string) => void
  onDiscard: (leadId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const huella = lead.huella ?? {}
  const confianza = huella.confianza?.nivel ?? 'bajo'
  const elogios = huella.voz_del_cliente?.elogios_recurrentes ?? []
  const quejas = huella.voz_del_cliente?.quejas_recurrentes ?? []
  const ancla = huella.detalle_ancla?.detalle ?? ''

  return (
    <article className="outreach-lead" data-confianza={confianza}>
      <header className="outreach-lead-head">
        <span>
          <strong>{lead.business_name}</strong>
          <small>{[lead.city, lead.website].filter(Boolean).join(' · ')}</small>
        </span>
        <span className="outreach-badges">
          <b className="outreach-score">{lead.score}</b>
          <StatusBadge>{confianza === 'alto' ? 'Evidencia alta' : confianza === 'medio' ? 'Evidencia media' : 'Evidencia floja'}</StatusBadge>
        </span>
      </header>

      {ancla && (
        <p className="outreach-anchor">{ancla}</p>
      )}

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

      <div className="outreach-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={!message || message.status !== 'borrador'}
          onClick={() => message && onApprove(message.id)}
        >
          <Check size={16} /> {message?.status === 'aprobado' ? 'Aprobado' : 'Aprobar'}
        </button>
        <button type="button" onClick={() => onDiscard(lead.id)}><X size={16} /> Descartar</button>
      </div>
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

