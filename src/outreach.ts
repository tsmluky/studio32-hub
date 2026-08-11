// Prospección: tipos y carga de datos.
//
// Vive fuera de App.tsx porque la vista que los consume también vive fuera, y
// App.tsx importa las vistas: tenerlos allí obligaría a un ciclo de imports.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { HubSyncStatus, MemberId } from './types'

// Prospección. Vive en tablas propias y NO en hub_states: la lista de leads
// crece sin techo y el registro de envíos es append-only, así que se carga y se
// escribe de forma granular, igual que el calendario.

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
  status: 'abierta' | 'enviando' | 'cerrada'
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
          .select('id, name, sector, city, oferta, status')
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
  const approveMessage = async (messageId: string) => {
    if (!supabase) return
    const { data } = await supabase.auth.getUser()
    const { error: approveError } = await supabase
      .from('outreach_messages')
      .update({ status: 'aprobado', approved_by: data.user?.id ?? null, approved_at: new Date().toISOString() })
      .eq('id', messageId)
    if (approveError) setError('No se ha podido aprobar el mensaje.')
    reload()
  }

  const discardLead = async (leadId: string) => {
    if (!supabase) return
    const { error: discardError } = await supabase
      .from('outreach_leads')
      .update({ status: 'descartado' })
      .eq('id', leadId)
    if (discardError) setError('No se ha podido descartar el lead.')
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

  return { campaigns, leads, messages, status, error, reload, approveMessage, discardLead, sendApproved }
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
      const [pendingRows, campaignRows] = await Promise.all([
        client
          .from('outreach_messages')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', 'studio32')
          .eq('status', 'borrador'),
        client
          .from('outreach_campaigns')
          .select('name')
          .eq('workspace_id', 'studio32')
          .eq('status', 'abierta')
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      if (cancelled) return

      // Si las tablas aún no existen, la portada se queda como estaba.
      if (pendingRows.error) {
        setPending(0)
        return
      }

      setPending(pendingRows.count ?? 0)
      setCampaign(campaignRows.data?.[0]?.name ?? '')
    }

    void load()
    return () => { cancelled = true }
  }, [enabled])

  return { pending, campaign }
}
