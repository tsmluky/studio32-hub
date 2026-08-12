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
//   IMAP_HOST / IMAP_PORT          opcional: copia en Enviados (imap.hostinger.com : 993)
//   IMAP_SENT_FOLDER               opcional: forzar la carpeta, si no se descubre sola
//   OUTREACH_SENT_COPY             opcional: 'off' apaga la copia en Enviados

import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { SesionImap } from './imap.ts'

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

// La firma se compone aquí, no la escribe la skill.
//
// Motivo: quien aprueba en el Hub se queda el cliente, y al aprobar cambia el
// remitente del mensaje. Si la firma viviera dentro del cuerpo, Gonzalo aprobaría un
// correo que se sigue despidiendo de Juanma. Componerla en el envío hace que reasignar
// sea seguro por construcción.
//
// El nombre sale del propio `from`: no hace falta una tabla de socios que mantener en
// dos sitios. "Gonzalo · Studio32 <gonzalo@studio32.es>" firma Gonzalo; si no hay
// nombre visible, se usa la parte local del correo en capital.
function nombreDelRemitente(from: string) {
  const visible = from.split('<')[0].split('·')[0].trim()
  if (visible) return visible
  const local = (from.match(/<([^@]+)@/) ?? from.match(/^([^@]+)@/))?.[1] ?? ''
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Studio32'
}

function componerCuerpo(body: string, enlaceBaja: string, from: string) {
  const firma = `\n\n${nombreDelRemitente(from)}\nStudio32 · Digital Systems\nstudio32.es`
  const pie = enlaceBaja.startsWith('mailto:')
    ? `\n\n—\nStudio32. Si no quieres recibir más correos nuestros, responde con la palabra BAJA.`
    : `\n\n—\nStudio32. Si no quieres recibir más correos nuestros: ${enlaceBaja}`
  return `${body.trimEnd()}${firma}${pie}`
}

// --- El correo tal y como se guarda en Enviados ------------------------------
//
// Aviso que conviene tener presente al leer una copia: NO son los bytes exactos que
// viajaron. denomailer compone el mensaje por dentro y no lo devuelve, así que aquí
// se vuelve a montar con las mismas piezas —mismo remitente, mismo destinatario,
// mismo asunto y EXACTAMENTE el mismo cuerpo, que se calcula una sola vez y se pasa a
// los dos sitios—. Lo que no coincide es el Message-ID y algún detalle de formato.
//
// La alternativa para que fuera idéntico byte a byte era componer el mensaje a mano y
// hablar SMTP crudo, tirando un camino de envío que ya está probado con envíos reales.
// No compensa: la copia es para poder releer lo que se dijo, no para un peritaje.

function base64DeBytes(bytes: Uint8Array) {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

// Las cabeceras solo admiten ASCII. "Gonzalo · Studio32" lleva un punto medio, y los
// asuntos llevan acentos: sin codificar, unos servidores lo rechazan y otros lo
// enseñan con caracteres rotos. Se parte en trozos porque cada palabra codificada no
// puede pasar de 75 caracteres.
function palabraCodificada(texto: string) {
  if (!/[^\x00-\x7F]/.test(texto)) return texto
  const encoder = new TextEncoder()
  const trozos: string[] = []
  let actual = ''
  for (const caracter of texto) {
    const tentativa = actual + caracter
    if (base64DeBytes(encoder.encode(tentativa)).length + 12 > 75 && actual) {
      trozos.push(actual)
      actual = caracter
    } else {
      actual = tentativa
    }
  }
  if (actual) trozos.push(actual)
  return trozos.map((trozo) => `=?UTF-8?B?${base64DeBytes(encoder.encode(trozo))}?=`).join('\r\n ')
}

// Solo se codifica el nombre visible. Codificar la dirección entera rompe la sintaxis
// y el mensaje deja de tener remitente legible.
function cabeceraDireccion(bruto: string) {
  const conAngulos = bruto.match(/^(.*?)\s*<([^>]+)>\s*$/)
  if (!conAngulos) return bruto.trim()
  const nombre = conAngulos[1].trim().replace(/^"|"$/g, '')
  const direccion = conAngulos[2].trim()
  if (!nombre) return `<${direccion}>`
  const visible = /[^\x00-\x7F]/.test(nombre) ? palabraCodificada(nombre) : `"${nombre.replace(/"/g, '')}"`
  return `${visible} <${direccion}>`
}

function envolverBase64(texto: string) {
  return (texto.match(/.{1,76}/g) ?? []).join('\r\n')
}

function componerRfc822(datos: {
  de: string
  para: string
  responderA: string
  asunto: string
  cuerpo: string
  enlaceBaja: string
}) {
  // El cuerpo va en base64 a propósito: el texto lleva acentos, guiones largos y
  // líneas de longitud imprevisible, y base64 evita tener que pelearse con el corte
  // de líneas y con el 8-bit.
  const cuerpo = envolverBase64(base64DeBytes(new TextEncoder().encode(datos.cuerpo)))
  const cabeceras = [
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `From: ${cabeceraDireccion(datos.de)}`,
    `To: ${datos.para}`,
    `Reply-To: ${cabeceraDireccion(datos.responderA)}`,
    `Subject: ${palabraCodificada(datos.asunto)}`,
    `Message-ID: <${crypto.randomUUID()}@studio32.es>`,
    `List-Unsubscribe: <${datos.enlaceBaja}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
  ]
  return `${cabeceras.join('\r\n')}\r\n\r\n${cuerpo}\r\n`
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

  // La copia en Enviados usa la MISMA cuenta que el envío: SMTP_USER y SMTP_PASS son
  // ya las credenciales reales del buzón, así que esto no añade ningún secreto nuevo.
  const imapHost = Deno.env.get('IMAP_HOST') ?? 'imap.hostinger.com'
  const imapPort = Number(Deno.env.get('IMAP_PORT') ?? 993)
  const carpetaForzada = Deno.env.get('IMAP_SENT_FOLDER')?.trim() || ''
  const copiaActiva = (Deno.env.get('OUTREACH_SENT_COPY') ?? '').trim().toLowerCase() !== 'off'

  // Se descubre una vez por tanda y se reutiliza: la conexión sí se abre por mensaje,
  // pero preguntar veinticinco veces cómo se llama la carpeta no tiene sentido.
  let carpetaEnviados = carpetaForzada

  // A la primera que falla, se deja de intentar en toda la tanda.
  //
  // No es pereza: son 25 mensajes y cada intento contra un IMAP que no responde se
  // lleva 15 segundos. Insistir se comería el tiempo de la función entera y la
  // respuesta no llegaría al Hub, con los correos YA enviados. Antes de que la copia
  // estorbe al envío, la copia se retira.
  let copiaRendida = ''

  // Esta función no lanza nunca. Devuelve qué ha pasado y sigue.
  const copiarAEnviados = async (mensajeRfc822: string) => {
    if (!copiaActiva) return 'desactivada'
    if (copiaRendida) return `sin copia (${copiaRendida})`
    let sesion: SesionImap | undefined
    try {
      sesion = await SesionImap.abrir(imapHost, imapPort, smtpUser, smtpPass)
      if (!carpetaEnviados) carpetaEnviados = await sesion.carpetaDeEnviados()
      await sesion.guardarEnEnviados(carpetaEnviados, mensajeRfc822)
      return 'guardada'
    } catch (error) {
      copiaRendida = error instanceof Error ? error.message : 'error desconocido'
      console.error(`Correo enviado, pero sin copia en Enviados: ${copiaRendida}`)
      return `sin copia (${copiaRendida})`
    } finally {
      if (sesion) await sesion.cerrar()
    }
  }

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

  const resultados: Array<{ id: string; estado: string; motivo?: string; copia?: string }> = []

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

    // Se calcula una sola vez y se usa en el envío y en la copia. Si cada uno lo
    // compusiera por su cuenta, la copia podría acabar diciendo algo distinto de lo
    // que recibió el prospecto, que es peor que no tener copia.
    const cuerpoFinal = componerCuerpo(mensaje.body, enlaceBaja, remitente)

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
          content: cuerpoFinal,
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

      // La copia va DESPUÉS de dar el envío por bueno en la base, y copiarAEnviados no
      // lanza nunca. El try/catch de aquí es tirantes y cinturón: el correo ya está
      // entregado y nada puede marcarlo como fallido a estas alturas. Es la misma
      // lección que dejó el close() de arriba, que llegó a marcar como fallido un
      // mensaje que había salido de verdad.
      let copia: string
      try {
        copia = await copiarAEnviados(componerRfc822({
          de: remitente,
          para: mensaje.to_email,
          responderA: mensaje.reply_to || remitente,
          asunto: mensaje.subject,
          cuerpo: cuerpoFinal,
          enlaceBaja,
        }))
      } catch (errorCopia) {
        copia = errorCopia instanceof Error ? errorCopia.message : 'no se pudo guardar la copia'
        console.error(`Enviado ${id}, pero sin copia en Enviados: ${copia}`)
      }

      resultados.push({ id, estado: 'enviado', copia })
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
