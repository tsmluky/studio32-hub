// Prospección: tipos y carga de datos.
//
// Vive fuera de App.tsx porque la vista que los consume también vive fuera, y
// App.tsx importa las vistas: tenerlos allí obligaría a un ciclo de imports.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import remitentesJson from './remitentes.json'
import type { HubSyncStatus, MemberId } from './types'

// Prospección. Vive en tablas propias y NO en hub_states: la lista de leads
// crece sin techo y el registro de envíos es append-only, así que se carga y se
// escribe de forma granular, igual que el calendario.

/** Quién firma cada correo. Su gemelo vive en la Edge Function, que compone la firma
 *  a partir del alias: si cambia una dirección aquí, hay que mirar allí. */
export const remitentes = remitentesJson.remitentes as Record<MemberId, { nombre: string; email: string }>

export type OutreachStatus = 'nuevo' | 'contactado' | 'respondido' | 'reunion' | 'cliente' | 'descartado'
export type OutreachMessageStatus = 'borrador' | 'aprobado' | 'enviando' | 'enviado' | 'fallido'
export type ConfianzaNivel = 'alto' | 'medio' | 'bajo'

export type HuellaPatron = { patron: string; cita: string; fuente: string; veces: number }

export type Huella = {
  detalle_ancla?: { detalle?: string; por_que_importa?: string; fuente?: string }
  voz_del_cliente?: {
    elogios_recurrentes?: HuellaPatron[]
    quejas_recurrentes?: HuellaPatron[]
    palabras_que_usan?: string[]
  }
  huecos_digitales?: string[]
  confianza?: { nivel?: ConfianzaNivel; no_encontrado?: string[] }
}

export type OutreachCampaign = {
  id: string
  name: string
  sector: string
  city: string
  oferta: string
  // 'pedida' = encolada desde el Hub y todavía sin leads. La skill corre en local,
  // así que el Hub solo puede dejar el encargo puesto.
  status: 'pedida' | 'abierta' | 'enviando' | 'cerrada'
  cantidad: number
  notas: string
  created_at: string
}

export type OutreachLead = {
  id: string
  campaign_id: string | null
  business_name: string
  city: string
  website: string
  email: string
  phone: string
  score: number
  digital_level: 'bajo' | 'medio' | 'alto'
  status: OutreachStatus
  owner_member_id: MemberId | null
  huella: Huella | null
}

export type OutreachEvidencia = { afirmacion: string; cita: string; fuente: string }

export type OutreachMessage = {
  id: string
  lead_id: string
  subject: string
  body: string
  to_email: string
  status: OutreachMessageStatus
  evidencia: OutreachEvidencia[] | null
}

export function useOutreach(enabled: boolean) {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([])
  const [leads, setLeads] = useState<OutreachLead[]>([])
  const [messages, setMessages] = useState<OutreachMessage[]>([])
  const [status, setStatus] = useState<HubSyncStatus>('idle')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    if (!supabase || !enabled) return
    const client = supabase

    let cancelled = false
    setStatus('loading')
    setError('')

    const load = async () => {
      const [campaignRows, leadRows, messageRows] = await Promise.all([
        client
          .from('outreach_campaigns')
          .select('id, name, sector, city, oferta, status, cantidad, notas, created_at')
          .eq('workspace_id', 'studio32')
          .order('created_at', { ascending: false }),
        client
          .from('outreach_leads')
          .select('id, campaign_id, business_name, city, website, email, phone, score, digital_level, status, owner_member_id, huella')
          .eq('workspace_id', 'studio32')
          .order('score', { ascending: false }),
        client
          .from('outreach_messages')
          .select('id, lead_id, subject, body, to_email, status, evidencia')
          .eq('workspace_id', 'studio32')
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      const failure = campaignRows.error ?? leadRows.error ?? messageRows.error
      if (failure) {
        // La migración puede no estar aplicada todavía; el resto del Hub no se rompe.
        setError('No se ha podido cargar la prospección. Puede que las tablas aún no existan.')
        setStatus('error')
        return
      }

      setCampaigns((campaignRows.data ?? []) as OutreachCampaign[])
      setLeads((leadRows.data ?? []) as OutreachLead[])
      setMessages((messageRows.data ?? []) as OutreachMessage[])
      setStatus('ready')
    }

    void load()
    return () => { cancelled = true }
  }, [enabled, revision])

  // La suscripción va en su propio efecto para no reabrir el canal en cada recarga.
  useEffect(() => {
    if (!supabase || !enabled) return
    const client = supabase
    const channel = client
      .channel('studio32-outreach')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_leads' }, () => setRevision((current) => current + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outreach_messages' }, () => setRevision((current) => current + 1))
      .subscribe()

    return () => { void client.removeChannel(channel) }
  }, [enabled])

  const reload = () => setRevision((current) => current + 1)

  // Aprobar no envía. La transición a 'enviado' solo la hace la Edge Function
  // con la clave de servicio; las políticas del cliente no lo permiten.
  //
  // Aprobar SÍ decide dos cosas más, y por eso recibe quién aprueba:
  //
  //   1. Quién firma. El correo sale de su alias y la firma se compone en el envío
  //      a partir de ese remitente.
  //   2. De quién es el cliente. Se marca `owner_member_id` en el lead, porque la
  //      respuesta va a caer en el buzón común y hay que saber a quién le toca.
  //
  // Es una sola decisión —"me lo quedo"— y no dos pantallas distintas.
  const approveMessage = async (messageId: string, leadId: string, memberId: MemberId) => {
    if (!supabase) return
    const remitente = remitentes[memberId]
    if (!remitente) {
      setError('No hay dirección de correo configurada para ese miembro.')
      return
    }
    const { data } = await supabase.auth.getUser()
    const { error: approveError } = await supabase
      .from('outreach_messages')
      .update({
        status: 'aprobado',
        approved_by: data.user?.id ?? null,
        approved_at: new Date().toISOString(),
        from_email: `${remitente.nombre} · Studio32 <${remitente.email}>`,
        reply_to: remitente.email,
      })
      .eq('id', messageId)
    if (approveError) {
      setError('No se ha podido aprobar el mensaje.')
      reload()
      return
    }
    // El dueño del lead se marca aparte: si esto falla, el correo ya está aprobado y
    // firmado, que es lo que no puede quedar a medias.
    await supabase.from('outreach_leads').update({ owner_member_id: memberId }).eq('id', leadId)
    reload()
  }

  // Descartar borra de verdad; no marca y deja el rastro.
  //
  // Marcarlo dejaba dos problemas, y el segundo es el que importa:
  //
  //   1. El borrador seguía vivo en 'borrador' para siempre. La portada llegó a decir
  //      "10 correos esperan tu visto bueno" con 3 en la cola. Se tapó contando solo
  //      mensajes de leads vivos, pero las filas seguían ahí.
  //   2. El negocio quedaba congelado como 'descartado'. Una tanda futura lo
  //      reconocía por dominio, le refrescaba la huella y la puntuación... y no
  //      volvía a la revisión NUNCA, porque el importador no toca el estado a
  //      propósito. Un lead descartado por evidencia floja no podía volver aunque
  //      después apareciesen reseñas buenas.
  //
  // Borrarlo lo devuelve al punto de partida: si la siguiente pasada lo encuentra y
  // pasa la puerta, entra como nuevo. El precio es que un negocio que no interesa
  // puede reaparecer y haya que descartarlo otra vez; se acepta a cambio de no perder
  // los que sí mejoran.
  //
  // **Descartar no es la baja.** Lo que no vuelve nunca es quien esté en
  // `outreach_suppressions`, que va por dirección y sobrevive a que el negocio se
  // borre, se renombre o vuelva dentro de otra campaña.
  //
  // Excepción, y no es menor: un lead con un correo ya enviado NO se borra.
  // `outreach_messages.lead_id` cuelga del lead con `on delete cascade`, y la cascada
  // no pasa por las políticas de la tabla —que prohíben borrar lo enviado—, así que
  // borrar el lead se llevaría por delante el registro del envío sin avisar. Eso es
  // historia, no un borrador. Se comprueba contra la base y no contra el estado local,
  // porque de esto no se vuelve.
  const discardLead = async (leadId: string) => {
    if (!supabase) return

    const { data: enviados, error: readError } = await supabase
      .from('outreach_messages')
      .select('id')
      .eq('lead_id', leadId)
      .in('status', ['enviado', 'enviando'])
      .limit(1)

    if (readError) {
      setError('No se ha podido comprobar si a este lead ya se le escribió.')
      return
    }

    const { error: discardError } = enviados?.length
      ? await supabase.from('outreach_leads').update({ status: 'descartado' }).eq('id', leadId)
      : await supabase.from('outreach_leads').delete().eq('id', leadId)

    if (discardError) setError('No se ha podido descartar el lead.')
    reload()
  }

  // Reescribir el correo a mano antes de aprobarlo.
  //
  // La skill acierta casi siempre, pero "casi" no basta cuando lo que sale lleva el
  // nombre de quien firma. Sin esto la única salida a un correo que no convence era
  // descartar el lead entero, que es tirar un negocio bueno por una frase mala.
  //
  // **Solo toca `subject` y `body`.** La evidencia no se edita desde aquí a propósito:
  // es el registro de lo que se comprobó del negocio, y dejar que se reescriba
  // convertiría la prueba en opinión. Por eso el editor la enseña al lado — se
  // reescribe mirando lo que se puede afirmar, no a ciegas.
  //
  // Las políticas solo permiten actualizar mientras el mensaje esté en 'borrador',
  // 'aprobado' o 'fallido', así que lo enviado es intocable por construcción.
  const updateMessageDraft = async (messageId: string, subject: string, body: string) => {
    if (!supabase) throw new Error('Reescribir necesita una sesión conectada.')
    const { error: updateError } = await supabase
      .from('outreach_messages')
      .update({ subject: subject.trim(), body: body.trim() })
      .eq('id', messageId)
    if (updateError) throw new Error('No se ha podido guardar el correo.')
    reload()
  }

  // Enviar es lo único irreversible de todo el tablero. Va en tanda y no por
  // lead: se revisa uno a uno con calma y se envía una vez, a conciencia.
  // La función comprueba bajas, repeticiones y aprobación antes de disparar.
  const sendApproved = async (messageIds: string[]) => {
    if (!supabase) throw new Error('El envío necesita una sesión conectada.')
    const { data, error: sendError } = await supabase.functions.invoke('outreach-send', { body: { messageIds } })
    if (sendError) throw new Error('La función de envío todavía no está desplegada.')
    if (data?.error) throw new Error(data.error)
    reload()
    return data as { enviados: number; total: number; resultados: Array<{ id: string; estado: string; motivo?: string }> }
  }

  return { campaigns, leads, messages, status, error, reload, approveMessage, discardLead, updateMessageDraft, sendApproved }
}

// Pulso para la portada. Deliberadamente NO reutiliza useOutreach: aquí solo
// hace falta el contador, y "Hoy" es la pantalla que se abre todos los días.
// Una consulta de cabecera (head: true) no trae filas, solo el total.
export function useOutreachPulse(enabled: boolean) {
  const [pending, setPending] = useState(0)
  const [campaign, setCampaign] = useState('')

  useEffect(() => {
    if (!supabase || !enabled) return
    const client = supabase

    let cancelled = false

    const load = async () => {
      // El `!inner` se queda como red, aunque descartar ya borra el lead y su borrador
      // con él: si alguna vez vuelve a existir un mensaje sin lead vivo, la portada no
      // volverá a inflar el contador. Fue el sintoma que destapó todo esto — decía "10
      // correos esperan tu visto bueno" con 3 en la cola.
      //
      // Además se trae el nombre de SU campaña; elegir simplemente la última abierta
      // atribuía correos de fisioterapia a una campaña de prueba sin relación con ellos.
      const pendingRows = await client
        .from('outreach_messages')
        .select('id, outreach_leads!inner(status, outreach_campaigns(name))', { count: 'exact' })
        .eq('workspace_id', 'studio32')
        .eq('status', 'borrador')
        .neq('outreach_leads.status', 'descartado')

      if (cancelled) return

      // Si las tablas aún no existen, la portada se queda como estaba.
      if (pendingRows.error) {
        setPending(0)
        return
      }

      setPending(pendingRows.count ?? 0)
      const campaignNames = new Set(
        (pendingRows.data ?? [])
          .map((row) => {
            const lead = row.outreach_leads as { outreach_campaigns?: { name?: string } | null } | null
            return lead?.outreach_campaigns?.name
          })
          .filter((name): name is string => Boolean(name)),
      )
      setCampaign(campaignNames.size === 1 ? [...campaignNames][0] : campaignNames.size > 1 ? `${campaignNames.size} campañas pendientes` : '')
    }

    void load()
    return () => { cancelled = true }
  }, [enabled])

  return { pending, campaign }
}

/**
 * Encarga una campaña desde el Hub.
 *
 * Nace vacía y en 'pedida'. El Hub no puede generar los leads: la skill corre en
 * local con la suscripción de Claude, y un sitio estático no alcanza ese portátil.
 * Lo que sí puede es dejar el encargo hecho para que local lo recoja — y eso es lo
 * que permite que Juanma o Gonzalo pidan trabajo sin saber ejecutar nada.
 */
export type PedidoCampana = {
  sector: string
  city: string
  oferta: string
  cantidad: number
  notas: string
}

export async function pedirCampana(pedido: PedidoCampana) {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('outreach_campaigns').insert({
    workspace_id: 'studio32',
    // El nombre se compone solo: es lo que se lee en la cola y en el selector, y
    // pedir que además lo escriban es una fricción sin contrapartida.
    name: `${pedido.sector} · ${pedido.city}`,
    sector: pedido.sector.trim(),
    city: pedido.city.trim(),
    oferta: pedido.oferta.trim(),
    cantidad: pedido.cantidad,
    notas: pedido.notas.trim(),
    status: 'pedida',
  })
  if (error) throw new Error(error.message)
}

/**
 * Lista de bajas: nadie de aquí vuelve a recibir un correo, pase lo que pase.
 *
 * Es por DIRECCIÓN y no por lead a propósito. Descartar un lead lo saca de esta
 * campaña, pero no impide que el mismo buzón vuelva a entrar mañana dentro de otro
 * negocio — una gestoría, una cadena, o el mismo sitio con otro nombre. La baja tiene
 * que sobrevivir a eso, y por eso vive en su propia tabla y la comprueba el envío.
 *
 * De momento se rellena a mano: cuando alguien responde BAJA, esa respuesta llega al
 * buzón de Hostinger y una persona la pasa aquí. No hay nada leyendo el correo.
 */
export async function darDeBaja(email: string, motivo = 'baja solicitada') {
  if (!supabase) throw new Error('Supabase no está configurado')
  const limpio = email.trim().toLowerCase()
  if (!limpio) throw new Error('Sin dirección no hay baja que registrar')
  const { error } = await supabase
    .from('outreach_suppressions')
    // Repetir una baja no es un error: si ya estaba, sigue estando.
    .upsert({ workspace_id: 'studio32', email: limpio, reason: motivo }, { onConflict: 'workspace_id,email' })
  if (error) throw new Error(error.message)
}

export async function fetchBajas(): Promise<Array<{ email: string; reason: string; created_at: string }>> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('outreach_suppressions')
    .select('email, reason, created_at')
    .eq('workspace_id', 'studio32')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}
