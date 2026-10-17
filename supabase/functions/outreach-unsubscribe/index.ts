// Baja por enlace (17/10/2026).
//
// Cierra el ciclo que el pie del correo prometía: hasta ahora la baja solo existía si
// alguien leía un "BAJA" en el buzón de Hostinger y lo pasaba a mano al Hub.
//
// Dos caminos llegan aquí, y los dos con el token de baja del lead en `?t=`:
//
//   1. La página `hub.studio32.es/baja/` (public/baja/index.html). Primero pregunta
//      con GET a quién corresponde el enlace y solo da de baja cuando la persona pulsa
//      el botón (POST). No se da de baja con un GET a propósito: los filtros de
//      seguridad de muchos correos de empresa abren los enlaces antes que la persona,
//      y una baja por GET daría de baja a gente que nunca la pidió.
//   2. La baja de un clic de Gmail y Outlook (RFC 8058). La cabecera
//      `List-Unsubscribe-Post` de `outreach-send` hace que el propio cliente de correo
//      mande un POST a esta URL. Sin cabecera de autorización: por eso esta función se
//      despliega con verify_jwt = false (supabase/config.toml).
//
// Escribe con la clave de servicio, pero solo hace una cosa: añadir direcciones a
// `outreach_suppressions`. Las direcciones que da de baja son las del lead dueño del
// token, nunca una que venga en la petición: así un token no puede dar de baja a nadie
// más que al negocio al que se le escribió.
//
// El token puede ser también el id de un mensaje: `outreach-send` lo usa de reserva si
// el lead no tiene token (`bajaTexto(lead?.unsubscribe_token ?? id)`).

import { createClient } from 'npm:@supabase/supabase-js@2'

const WORKSPACE = 'studio32'
const MOTIVO = 'baja por enlace'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// La página vive en el Hub. El POST de un clic no lleva Origin de navegador y no
// necesita CORS; esto es solo para la página.
const allowedOrigins = new Set(['https://www.hub.studio32.es', 'https://hub.studio32.es'])
const esLocal = (origin: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const permitido = allowedOrigins.has(origin) || esLocal(origin) || /^https:\/\/[a-z0-9-]+\.studio32-hub\.pages\.dev$/.test(origin)
  return {
    'Access-Control-Allow-Origin': permitido ? origin : 'https://hub.studio32.es',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// Lo justo para que la persona reconozca su dirección sin que el enlace la publique
// entera a quien lo reenvíe: "in***@clinica.es".
function enmascarar(email: string) {
  const [local, dominio] = email.split('@')
  if (!dominio) return '***'
  return `${local.slice(0, 2)}***@${dominio}`
}

// deno-lint-ignore no-explicit-any
async function direccionesDelToken(admin: any, token: string) {
  const { data: lead } = await admin
    .from('outreach_leads')
    .select('id, email')
    .eq('workspace_id', WORKSPACE)
    .eq('unsubscribe_token', token)
    .maybeSingle()

  let leadId: string | null = lead?.id ?? null
  const direcciones = new Set<string>()
  if (lead?.email) direcciones.add(lead.email.trim().toLowerCase())

  if (!leadId) {
    const { data: mensaje } = await admin
      .from('outreach_messages')
      .select('lead_id, to_email')
      .eq('workspace_id', WORKSPACE)
      .eq('id', token)
      .maybeSingle()
    if (!mensaje) return null
    leadId = mensaje.lead_id
    if (mensaje.to_email) direcciones.add(mensaje.to_email.trim().toLowerCase())
  }

  // Todas las direcciones a las que se le escribió a ese negocio, no solo la de la
  // ficha: si el correo salió a citas@ y la ficha dice info@, la baja tiene que
  // cubrir la que de verdad recibió el correo.
  const { data: mensajes } = await admin
    .from('outreach_messages')
    .select('to_email')
    .eq('workspace_id', WORKSPACE)
    .eq('lead_id', leadId)
  for (const m of mensajes ?? []) if (m.to_email) direcciones.add(m.to_email.trim().toLowerCase())

  direcciones.delete('')
  return [...direcciones]
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'GET' && request.method !== 'POST') return json(request, { error: 'Método no permitido' }, 405)

  const url = new URL(request.url)
  let token = url.searchParams.get('t')?.trim() ?? ''
  if (!token && request.method === 'POST') {
    // La página manda JSON; el POST de un clic manda el token en la URL y en el
    // cuerpo solo "List-Unsubscribe=One-Click".
    const tipo = request.headers.get('content-type') ?? ''
    if (tipo.includes('application/json')) {
      const cuerpo = await request.json().catch(() => ({}))
      token = String(cuerpo?.t ?? '').trim()
    }
  }
  if (!UUID.test(token)) return json(request, { error: 'Enlace de baja no válido.' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(request, { error: 'Servicio no configurado.' }, 500)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const direcciones = await direccionesDelToken(admin, token)
  if (!direcciones?.length) return json(request, { error: 'Este enlace de baja no corresponde a ningún envío.' }, 404)

  const { data: yaDeBaja } = await admin
    .from('outreach_suppressions')
    .select('email')
    .eq('workspace_id', WORKSPACE)
    .in('email', direcciones)
  const todasDeBaja = (yaDeBaja?.length ?? 0) >= direcciones.length

  if (request.method === 'GET') {
    return json(request, { estado: todasDeBaja ? 'de_baja' : 'pendiente', direcciones: direcciones.map(enmascarar) })
  }

  // Repetir una baja no es un error: si ya estaba, sigue estando. ignoreDuplicates
  // conserva el motivo original si la baja se había puesto a mano desde el Hub.
  const { error } = await admin
    .from('outreach_suppressions')
    .upsert(
      direcciones.map((email) => ({ workspace_id: WORKSPACE, email, reason: MOTIVO })),
      { onConflict: 'workspace_id,email', ignoreDuplicates: true },
    )
  if (error) return json(request, { error: 'No se pudo registrar la baja. Responde BAJA al correo y lo haremos a mano.' }, 500)

  return json(request, { estado: 'de_baja', direcciones: direcciones.map(enmascarar) })
})
