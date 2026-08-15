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
  const [filter, setFilter] = useState<'review' | 'approved' | 'sent'>('review')
  const [weakOnly, setWeakOnly] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  // Lo encargado y aun sin leads: no entra en los filtros de revision porque
  // todavia no hay nada que revisar.
  const pedidas = campaigns.filter((campana) => campana.status === 'pedida')

  // Una campaña sin ningún lead vivo no se ofrece: seleccionarla solo puede llevar a
  // una lista vacía. Pasaba con las que se agotaron descartando (Alcalá, Valencia,
  // Torrejón), que seguían en el selector como si tuvieran trabajo dentro.
  //
  // Se deriva de los leads en vez de mirar `campaign.status` para que se mantenga
  // sola: en cuanto se descarta el último lead, la campaña desaparece de aquí sin que
  // nadie tenga que acordarse de cerrarla. La fila de la campaña sigue en la base —es
  // el registro de que ese sector se intentó— pero deja de estorbar.
  const campanasConLeads = new Set(
    leads.filter((lead) => lead.status !== 'descartado').map((lead) => lead.campaign_id),
  )
  const selectableCampaigns = campaigns.filter(
    (campaign) => campaign.status !== 'pedida' && campanasConLeads.has(campaign.id),
  )
  const realCampaigns = selectableCampaigns.filter((campaign) => !/^prueba\b/i.test(campaign.name.trim()))
  const testCampaigns = selectableCampaigns.filter((campaign) => /^prueba\b/i.test(campaign.name.trim()))
  const testCampaignIds = new Set(testCampaigns.map((campaign) => campaign.id))

  // Si la campaña elegida se queda sin leads mientras la miras —descartas el último—,
  // deja de estar en la lista y la selección apuntaría a la nada. Se vuelve a "todas"
  // sola en vez de enseñar una vista vacía sin explicación.
  const activeCampaignId = selectableCampaigns.some((campaign) => campaign.id === campaignId) ? campaignId : 'all'

  const latestMessageFor = (leadId: string) => messages.find((message) => message.lead_id === leadId)

  const scopedLeads = leads.filter((lead) => {
    if (lead.status === 'descartado') return false
    if (activeCampaignId !== 'all') return lead.campaign_id === activeCampaignId
    return !lead.campaign_id || !testCampaignIds.has(lead.campaign_id)
  })

  const matchesState = (lead: OutreachLead, stateFilter: typeof filter) => {
    const message = latestMessageFor(lead.id)
    if (!message) return false
    return stateFilter === 'review'
      ? message.status === 'borrador'
      : stateFilter === 'approved'
        ? message.status === 'aprobado'
        : message.status === 'enviado' || message.status === 'enviando'
  }

  const matchesFilter = (lead: OutreachLead) => {
    const matchesCurrentState = matchesState(lead, filter)
    const matchesQuality = !weakOnly || (lead.huella?.confianza?.nivel ?? 'bajo') !== 'alto'
    return matchesCurrentState && matchesQuality
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
    return scopedLeads.filter((lead) => matchesState(lead, id)).length
  }

  const filters: Array<{ id: typeof filter; label: string; count: number }> = [
    { id: 'review', label: 'Por revisar', count: countFor('review') },
    { id: 'approved', label: 'Listos para enviar', count: countFor('approved') },
    { id: 'sent', label: 'Historial', count: countFor('sent') },
  ]
  const weakCount = scopedLeads.filter((lead) => matchesState(lead, filter) && (lead.huella?.confianza?.nivel ?? 'bajo') !== 'alto').length
  const listTitle = filter === 'review' ? 'Por revisar' : filter === 'approved' ? 'Listos para enviar' : 'Historial de envíos'
  const emptyBody = weakOnly
    ? 'No hay correos con evidencia floja dentro de este estado y campaña.'
    : filter === 'review'
      ? 'No queda ningún correo pendiente de revisión en esta campaña.'
      : filter === 'approved'
        ? 'No hay correos aprobados esperando el envío.'
        : 'Todavía no hay envíos en esta campaña.'

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
            Ahora le toca a Pancho: abre Claude Code, ejecuta <code>/prospectar</code> y sigue las
            indicaciones. Cuando la tanda esté lista, el encargo desaparece de aquí y sus correos
            aparecen abajo para revisarlos.
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
          <section className="outreach-controls surface">
            <label className="outreach-campaign-picker">
              <span>Campaña</span>
              <select value={activeCampaignId} onChange={(event) => setCampaignId(event.target.value)}>
                <option value="all">Todas las campañas reales</option>
                {realCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                {testCampaigns.length > 0 && (
                  <optgroup label="Pruebas">
                    {testCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                  </optgroup>
                )}
              </select>
            </label>

            <div className="outreach-state-filter">
              <span>Estado</span>
              <div className="outreach-filters" role="tablist" aria-label="Estado del correo">
                {filters.map((item) => (
                  <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => setFilter(item.id)}>
                    {item.label}<b>{item.count}</b>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="outreach-quality-filter"
              type="button"
              aria-pressed={weakOnly}
              onClick={() => setWeakOnly((current) => !current)}
            >
              <AlertCircle size={16} />
              <span>Solo evidencia floja</span>
              <b>{weakCount}</b>
            </button>
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
            <SectionHeader icon={filter === 'sent' ? <CheckCircle2 size={18} /> : <Send size={18} />} title={listTitle} action={`${visibleLeads.length}`} />
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
                body={emptyBody}
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
      // Un correo ya enviado pertenece al historial: bloquear futuros contactos no
      // debe hacerlo desaparecer. Borradores y aprobados sí salen de la cola.
      if (message?.status !== 'enviado' && message?.status !== 'enviando') onDiscard(lead.id)
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
  const decisionLabel = message?.status === 'enviado' || message?.status === 'enviando'
    ? 'Ver correo enviado'
    : message?.status === 'aprobado'
      ? 'Revisar correo aprobado'
      : 'Leer el correo y decidir'

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
          <span className="outreach-score" aria-label={`Encaje ${lead.score} sobre 100`} title="Encaje estimado con la campaña">
            <small>Encaje</small><b>{lead.score}</b>
          </span>
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
          {decisionLabel}
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
        {open ? 'Ocultar evidencias y fuentes' : 'Ver evidencias y fuentes'}
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
        {message?.status === 'borrador' && (
          <>
            <button
              type="button"
              className="outreach-approve-action"
              onClick={() => onApprove(message.id, lead.id)}
            >
              <Check size={16} /> Aprobar y quedármelo
            </button>
            <button className="outreach-discard-action" type="button" onClick={() => onDiscard(lead.id)}><X size={16} /> Descartar</button>
          </>
        )}
        {/* La baja es deliberadamente secundaria: es poco frecuente y permanente.
            Sigue a un toque, pero no compite visualmente con la decisión normal. */}
        <details className="outreach-more-actions">
          <summary>Más opciones</summary>
          <div>
            <small>Bloquea esta dirección para todas las campañas futuras.</small>
            <button
              type="button"
              className="outreach-baja"
              disabled={!lead.email || bajando}
              title={lead.email ? `No volver a escribir a ${lead.email}` : 'Este lead no tiene correo'}
              onClick={() => void darBaja()}
            >
              <Ban size={16} /> {bajaHecha ? 'Dirección bloqueada' : 'No volver a contactar'}
            </button>
          </div>
        </details>
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

