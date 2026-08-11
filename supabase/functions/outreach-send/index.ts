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
//   SMTP_HOST / SMTP_PORT          servidor de Hostinger (smtp.hostinger.com : 465)
//   SMTP_USER / SMTP_PASS          la cuenta real: info@studio32.es y su contrasena
//   OUTREACH_FROM                  remitente por defecto, alias del dominio propio
//   OUTREACH_UNSUBSCRIBE_BASE      opcional: base del enlace de baja
//   OUTREACH_UNSUBSCRIBE_MAILTO    opcional: buzón de bajas, si no hay enlace

import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

// Se envia por SMTP del propio Hostinger y no por una API de terceros.
//
// Studio32 tiene UNA cuenta (info@studio32.es) con alias para cada socio. El SMTP
// se autentica siempre como esa cuenta y pone en `From:` el alias que toque, que es
// exactamente lo que hace el webmail. Asi el correo sale del dominio propio, las
// respuestas caen en la bandeja real y no hay un proveedor intermedio que dependa
// de una suscripcion ni de verificar el dominio en otro sitio.
const DIAS_DE_CORTESIA = 60
const MAXIMO_POR_TANDA = 25

const allowedOrigins = new Set([
  'https://www.hub.studio32.es',
  'https://hub.studio32.es',
  'https://feat-prospeccion-email.studio32-hub.pages.dev',
])

// El dev server no siempre cae en el mismo puerto, y enumerarlos a mano ya costó una
// prueba entera: el preflight se rechazaba en silencio, el navegador ni llegaba a
// mandar el POST y en el Hub parecia que la funcion no estaba desplegada.
//
// Abrir localhost no afloja la seguridad de verdad: quien envia sigue necesitando
// una sesion valida de miembro del workspace, y eso lo comprueba requireStudio32Member
// mas abajo. CORS solo decide que pagina puede leer la respuesta, no quien puede
// enviar.
const esLocal = (origin: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const permitido = allowedOrigins.has(origin) || esLocal(origin)
  return {
    'Access-Control-Allow-Origin': permitido ? origin : 'https://hub.studio32.es',
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
  const base = Deno.env.get('OUTREACH_UNSUBSCRIBE_BASE')?.trim()
  // Solo vale si es una URL http(s) de verdad.
  //
  // Sin esta comprobacion, cualquier cosa que haya en el secreto se concatena y sale
  // en el correo. Paso: el valor quedo puesto a la palabra "opcional" y los primeros
  // envios llevaron un pie que decia "opcional?t=20d1d8d8-...". El correo se entrego
  // igual, y por eso no lo canto nada: un pie de baja roto no falla, solo queda mal
  // delante del prospecto y deja sin salida a quien quiera darse de baja.
  const esUrl = base ? /^https?:\/\/[^\s]+$/i.test(base) : false
  if (base && esUrl) return `${base}${base.includes('?') ? '&' : '?'}t=${token}`
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

  const smtpHost = Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com'
  const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? 465)
  const smtpUser = Deno.env.get('SMTP_USER')
  const smtpPass = Deno.env.get('SMTP_PASS')
  if (!smtpUser || !smtpPass) {
    return json(request, { error: 'Faltan SMTP_USER y SMTP_PASS en los secretos de la funcion.' }, 503)
  }

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
      // Una conexion por mensaje. Son 25 como mucho y con pausa entre ellos: no
      // compensa mantener el socket abierto y arriesgarse a que Hostinger lo corte
      // a mitad de tanda.
      const smtp = new SMTPClient({
        connection: { hostname: smtpHost, port: smtpPort, tls: smtpPort === 465, auth: { username: smtpUser, password: smtpPass } },
      })

      try {
        await smtp.send({
          from: remitente,
          to: mensaje.to_email,
          replyTo: mensaje.reply_to || remitente,
          subject: mensaje.subject,
          content: componerCuerpo(mensaje.body, enlaceBaja),
          headers: { 'List-Unsubscribe': `<${enlaceBaja}>` },
        })
      } finally {
        // Cerrar siempre, tambien si el envio revienta: un socket abierto mantiene
        // vivo el isolate y se arrastra al resto de la tanda.
        //
        // El try/catch envuelve el close entero y no encadena .catch() sobre su
        // resultado: denomailer devuelve void, no una promesa. Encadenar ahi hacia
        // que el finally lanzara SU PROPIO error justo despues de un envio correcto,
        // y el mensaje quedaba marcado como fallido habiendo salido de verdad.
        try {
          await smtp.close()
        } catch {
          // Cerrar mal no invalida un correo ya entregado.
        }
      }

      await admin
        .from('outreach_messages')
        .update({ status: 'enviado', provider: 'hostinger-smtp', sent_at: new Date().toISOString(), error: '' })
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
