// Envío de correos de prospección.
//
// Esta función es la única que puede marcar un mensaje como enviado: las
// políticas de la tabla se lo prohíben al cliente a propósito. Aquí viven las
// tres fronteras que protegen la reputación del dominio, que también sirve el
// correo de las citas:
//
//   1. Nadie sale sin aprobación humana explícita.
//   2. Nadie en la lista de bajas recibe nada, pase lo que pase.
//   3. A la misma dirección no se le escribe dos veces en la ventana de
//      cortesía, aunque sean leads distintos.
//
// Secretos necesarios en Supabase:
//   RESEND_API_KEY                 clave de la API de Resend
//   OUTREACH_FROM                  remitente por defecto, alias del dominio propio
//   OUTREACH_UNSUBSCRIBE_BASE      opcional: base del enlace de baja
//   OUTREACH_UNSUBSCRIBE_MAILTO    opcional: buzón de bajas, si no hay enlace

import { createClient } from 'npm:@supabase/supabase-js@2'

const RESEND_API = 'https://api.resend.com/emails'
const DIAS_DE_CORTESIA = 60
const MAXIMO_POR_TANDA = 25

const allowedOrigins = new Set([
  'https://www.hub.studio32.es',
  'https://hub.studio32.es',
  'https://feat-prospeccion-email.studio32-hub.pages.dev',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
])

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://hub.studio32.es',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function requireStudio32Member(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization) return null
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) return null
  const { data, error } = await client
    .from('workspace_members')
    .select('member_id')
    .eq('workspace_id', 'studio32')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data) return null
  return user
}

function bajaTexto(token: string) {
  const base = Deno.env.get('OUTREACH_UNSUBSCRIBE_BASE')
  if (base) return `${base}${base.includes('?') ? '&' : '?'}t=${token}`
  const mailto = Deno.env.get('OUTREACH_UNSUBSCRIBE_MAILTO') ?? 'bajas@studio32.es'
  return `mailto:${mailto}?subject=Baja%20${token}`
}

function componerCuerpo(body: string, enlaceBaja: string) {
  const pie = enlaceBaja.startsWith('mailto:')
    ? `\n\n—\nStudio32. Si no quieres recibir más correos nuestros, responde con la palabra BAJA.`
    : `\n\n—\nStudio32. Si no quieres recibir más correos nuestros: ${enlaceBaja}`
  return `${body}${pie}`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Método no permitido.' }, 405)

  const user = await requireStudio32Member(request)
  if (!user) return json(request, { error: 'No tienes acceso a la prospección de Studio32.' }, 403)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json(request, { error: 'Falta configurar RESEND_API_KEY.' }, 503)

  const remitentePorDefecto = Deno.env.get('OUTREACH_FROM') ?? ''

  let payload: { messageIds?: string[] }
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'Cuerpo de la petición no válido.' }, 400)
  }

  const ids = (payload.messageIds ?? []).filter(Boolean)
  if (!ids.length) return json(request, { error: 'No has indicado ningún mensaje.' }, 400)
  if (ids.length > MAXIMO_POR_TANDA) {
    return json(request, { error: `Máximo ${MAXIMO_POR_TANDA} correos por tanda. Es a propósito: enviar de golpe quema el dominio.` }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const resultados: Array<{ id: string; estado: string; motivo?: string }> = []

  for (const id of ids) {
    const { data: mensaje, error: readError } = await admin
      .from('outreach_messages')
      .select('id, lead_id, from_email, reply_to, to_email, to_name, subject, body, status, approved_by')
      .eq('id', id)
      .eq('workspace_id', 'studio32')
      .maybeSingle()

    if (readError || !mensaje) {
      resultados.push({ id, estado: 'omitido', motivo: 'No se ha encontrado el mensaje.' })
      continue
    }

    // Frontera 1: aprobación humana. Sin esto no sale nada.
    if (mensaje.status !== 'aprobado' || !mensaje.approved_by) {
      resultados.push({ id, estado: 'omitido', motivo: 'El mensaje no está aprobado.' })
      continue
    }

    // Frontera 2: la lista de bajas. Es innegociable.
    const { data: baja } = await admin
      .from('outreach_suppressions')
      .select('email')
      .eq('workspace_id', 'studio32')
      .eq('email', mensaje.to_email.toLowerCase())
      .maybeSingle()

    if (baja) {
      await admin.from('outreach_messages').update({ status: 'fallido', error: 'La dirección está dada de baja.' }).eq('id', id)
      resultados.push({ id, estado: 'bloqueado', motivo: 'La dirección está dada de baja.' })
      continue
    }

    // Frontera 3: no repetir a la misma persona. Va por dirección y no por
    // lead, porque dos leads distintos pueden compartir buzón.
    const desde = new Date(Date.now() - DIAS_DE_CORTESIA * 86_400_000).toISOString()
    const { data: previos } = await admin
      .from('outreach_messages')
      .select('id')
      .eq('workspace_id', 'studio32')
      .eq('status', 'enviado')
      .ilike('to_email', mensaje.to_email)
      .gte('sent_at', desde)
      .limit(1)

    if (previos?.length) {
      await admin.from('outreach_messages').update({ status: 'fallido', error: `Ya se escribió a esta dirección en los últimos ${DIAS_DE_CORTESIA} días.` }).eq('id', id)
      resultados.push({ id, estado: 'bloqueado', motivo: 'Ya se le escribió hace poco.' })
      continue
    }

    const { data: lead } = await admin
      .from('outreach_leads')
      .select('unsubscribe_token')
      .eq('id', mensaje.lead_id)
      .maybeSingle()

    await admin.from('outreach_messages').update({ status: 'enviando' }).eq('id', id)

    const enlaceBaja = bajaTexto(lead?.unsubscribe_token ?? id)
    const remitente = mensaje.from_email || remitentePorDefecto
    if (!remitente) {
      await admin.from('outreach_messages').update({ status: 'fallido', error: 'No hay remitente configurado.' }).eq('id', id)
      resultados.push({ id, estado: 'fallido', motivo: 'No hay remitente configurado.' })
      continue
    }

    try {
      const respuesta = await fetch(RESEND_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: remitente,
          to: [mensaje.to_email],
          reply_to: mensaje.reply_to || remitente,
          subject: mensaje.subject,
          text: componerCuerpo(mensaje.body, enlaceBaja),
          headers: { 'List-Unsubscribe': `<${enlaceBaja}>` },
        }),
      })

      const cuerpo = await respuesta.json().catch(() => ({}))

      if (!respuesta.ok) {
        const motivo = cuerpo?.message ?? `Resend ha respondido ${respuesta.status}.`
        await admin.from('outreach_messages').update({ status: 'fallido', error: motivo }).eq('id', id)
        resultados.push({ id, estado: 'fallido', motivo })
        continue
      }

      await admin
        .from('outreach_messages')
        .update({ status: 'enviado', provider_message_id: cuerpo?.id ?? null, sent_at: new Date().toISOString(), error: '' })
        .eq('id', id)

      await admin
        .from('outreach_leads')
        .update({ status: 'contactado' })
        .eq('id', mensaje.lead_id)
        .eq('status', 'nuevo')

      resultados.push({ id, estado: 'enviado' })
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'Error desconocido al enviar.'
      await admin.from('outreach_messages').update({ status: 'fallido', error: motivo }).eq('id', id)
      resultados.push({ id, estado: 'fallido', motivo })
    }

    // Un respiro entre envíos. Una ráfaga es la forma más rápida de que el
    // dominio empiece a caer en spam, y ese dominio también manda las citas.
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }

  const enviados = resultados.filter((r) => r.estado === 'enviado').length
  return json(request, { enviados, total: ids.length, resultados })
})
