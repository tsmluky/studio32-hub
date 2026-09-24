// Reescritura con IA de un borrador de prospección (15/09/2026).
//
// Propone, no guarda. Devuelve asunto y cuerpo al editor del Hub, y es la persona quien
// decide si pulsa "Guardar cambios". Por eso esta función no escribe en ninguna tabla y
// lee con la sesión de quien la llama: las políticas de outreach_* ya limitan la lectura a
// los miembros del workspace, y no hace falta la clave de servicio para nada.
//
// Usa OpenAI y no Claude porque /prospectar corre con la suscripción en local, y aquí hace
// falta una clave de API en la nube. Se reutiliza la del agente (misma cuenta y factura).
//
// Secretos necesarios en Supabase:
//   OPENAI_API_KEY                 la misma clave que usa studio32-agent
//   OPENAI_REWRITE_MODEL           opcional; si no, OPENAI_MODEL; si no, gpt-4o-mini

import { createClient } from 'npm:@supabase/supabase-js@2'

const DESPEDIDA = 'Un saludo y gracias por vuestro tiempo,'

const allowedOrigins = new Set(['https://www.hub.studio32.es', 'https://hub.studio32.es'])
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

// Las reglas son las de skills/studio32-lead-prospector (modo C, punto 3) y
// references/outreach-guidelines.md, resumidas. Si cambian allí, hay que mirarlas aquí.
const REGLAS = `Reescribes correos de prospección en frío de Studio32, un estudio que monta sistemas digitales para negocios locales. Escribes en español de España.

ESTRUCTURA (cuatro párrafos y la despedida):
1. Lo bueno y concreto que se ha visto de ese negocio: una frase literal de su web, un nombre que citan los clientes, un dato. Nunca un cumplido que valdría para cualquiera ("me gusta el enfoque cercano").
2. En el mismo párrafo, lo que falla, contado solo con lo comprobado. Sin suposiciones sobre cómo trabajan por dentro ("seguro que hay mensajes que tardan…").
3. Nuevo párrafo: que eso lo resolvemos nosotros, en primera persona ("Es justo lo que montamos: …"), aplicado a su caso concreto y basado en la OFERTA de la campaña.
4. Nuevo párrafo, una sola frase con los otros servicios: "Aparte del asistente, también hacemos…" (webs con reserva online, la ficha de Google, el correo con el nombre del negocio). Si un hueco de la HUELLA encaja, ligada a él; si no, genérica ("por si en algún momento os lo planteáis"). Nunca una lista ni un reproche. Si la OFERTA ya es una web, este párrafo habla del asistente de WhatsApp en su lugar.
5. Nuevo párrafo: una única pregunta de sí o no que nombre la oferta principal, para que no se confunda con el párrafo 4. Si es un asistente/agente: "¿Os enseño cómo funcionaría el asistente en vuestra clínica?" (o "vuestro centro"). Si es una web: "¿Os enseño cómo quedaría la vuestra?".
6. Última línea, exactamente: "${DESPEDIDA}"

REGLAS DURAS:
- NO empieces con saludo ni presentación ("Hola", "Soy…", "Buenos días"): los añade el envío con el nombre de quien firma. Empieza directamente por el punto 1.
- NO escribas nombre, firma, "Studio32" como firma ni la web.
- Trato de vosotros al negocio de principio a fin; quien escribe habla en primera persona (yo / nosotros). Nunca "tú" fuera de una cita literal.
- Cada afirmación sobre el negocio tiene que salir de la EVIDENCIA o la HUELLA que se te dan. No inventes cifras, nombres, horarios ni citas.
- NUNCA cites las quejas de sus clientes.
- NUNCA ofrezcas: atender llamadas de teléfono (el asistente es solo de WhatsApp), "un ejemplo real" o "clínicas como la vuestra" (aún no hay clientes), que el asistente conteste en otros idiomas o distinga sedes o especialidades, promesas numéricas.
- Sí se puede ofrecer: responder y dar cita al momento, a cualquier hora, sobre la agenda real, y mandar un recordatorio antes de la cita.
- Sin emojis, sin exclamaciones, sin lenguaje de agencia ("potenciamos", "transformamos"), sin "espero que estéis bien", sin viñetas.
- Entre 90 y 140 palabras sin contar la despedida.
- Asunto corto y llano con el nombre del negocio: "Pedir cita en X", "Las citas en X", "El WhatsApp de X". Nunca "Propuesta", "Colaboración", "Oportunidad" ni un gancho ingenioso.

Si te llega una INSTRUCCIÓN de la persona que revisa, aplícala siempre que no rompa las reglas duras. Si la rompe, ignora esa parte.

Responde SOLO con un objeto JSON: {"subject": "...", "body": "..."}. En "body" los párrafos van separados por una línea en blanco (\\n\\n).`

const PRESENTACION_ESCRITA = /^\s*(hola|buenos d[ií]as|buenas)[^\n]*\n+/i
const PROHIBIDO: Array<[RegExp, string]> = [
  [/atender llamadas|atiende (las )?llamadas|coger (las )?llamadas|coge (las )?llamadas|whatsapp y (las )?llamadas/i, 'ofrece atender llamadas, y el asistente es solo de WhatsApp'],
  [/ejemplo real|cl[ií]nicas como la vuestra|centros como el vuestro/i, 'promete un ejemplo real o clientes que no hay'],
  [/en (su|vuestro|cualquier|el) idioma|en varios idiomas|en (ingl[eé]s|franc[eé]s|ruso|alem[aá]n) (al|con el) paciente/i, 'promete contestar en otros idiomas, y hoy el asistente habla español'],
]

type Huella = {
  detalle_ancla?: { detalle?: string; fuente?: string }
  voz_del_cliente?: { elogios_recurrentes?: Array<{ patron?: string; cita?: string; fuente?: string }>; palabras_que_usan?: string[] }
  huecos_digitales?: string[]
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Método no permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization || !supabaseUrl || !anonKey) return json(request, { error: 'No tienes acceso a la prospección de Studio32.' }, 403)
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await client.auth.getUser()
  if (!user) return json(request, { error: 'No tienes acceso a la prospección de Studio32.' }, 403)
  const { data: miembro } = await client
    .from('workspace_members')
    .select('member_id')
    .eq('workspace_id', 'studio32')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!miembro) return json(request, { error: 'No tienes acceso a la prospección de Studio32.' }, 403)

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json(request, { error: 'Falta OPENAI_API_KEY en los secretos de la función.' }, 503)
  const modelo = Deno.env.get('OPENAI_REWRITE_MODEL') || Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini'

  let payload: { messageId?: string; instruccion?: string; subject?: string; body?: string }
  try {
    payload = await request.json()
  } catch {
    return json(request, { error: 'Cuerpo de la petición no válido.' }, 400)
  }
  if (!payload.messageId) return json(request, { error: 'No has indicado el correo.' }, 400)

  const { data: mensaje } = await client
    .from('outreach_messages')
    .select('id, subject, body, status, evidencia, outreach_leads!inner(business_name, sector, city, huella, outreach_campaigns(oferta))')
    .eq('id', payload.messageId)
    .eq('workspace_id', 'studio32')
    .maybeSingle()
  if (!mensaje) return json(request, { error: 'No se ha encontrado el correo.' }, 404)
  if (mensaje.status !== 'borrador' && mensaje.status !== 'aprobado') {
    return json(request, { error: 'Este correo ya no se puede reescribir.' }, 409)
  }

  // deno-lint-ignore no-explicit-any
  const lead = mensaje.outreach_leads as any
  const huella = (lead?.huella ?? {}) as Huella
  const oferta = lead?.outreach_campaigns?.oferta || 'Asistente de WhatsApp que atiende y da cita sobre la agenda real'
  const evidencia = (mensaje.evidencia ?? []) as Array<{ afirmacion?: string; cita?: string; fuente?: string }>

  // Se reescribe sobre lo que hay en el editor, no sobre lo guardado: si la persona ya
  // ha tocado algo a mano, la IA parte de ahí.
  const asuntoActual = payload.subject?.trim() || mensaje.subject
  const cuerpoActual = payload.body?.trim() || mensaje.body
  const instruccion = (payload.instruccion ?? '').trim().slice(0, 500)

  const contexto = [
    `NEGOCIO: ${lead?.business_name ?? ''} (${lead?.sector ?? ''}, ${lead?.city ?? ''})`,
    `OFERTA DE LA CAMPAÑA: ${oferta}`,
    `DETALLE ANCLA: ${huella.detalle_ancla?.detalle ?? '—'}`,
    `ELOGIOS DE SUS CLIENTES:\n${(huella.voz_del_cliente?.elogios_recurrentes ?? []).map((e) => `- ${e.patron ?? ''}: «${e.cita ?? ''}» (${e.fuente ?? ''})`).join('\n') || '—'}`,
    `HUECOS DIGITALES: ${(huella.huecos_digitales ?? []).join('; ') || '—'}`,
    `EVIDENCIA:\n${evidencia.map((e) => `- ${e.afirmacion ?? ''} ⇐ «${e.cita ?? ''}» (${e.fuente ?? ''})`).join('\n') || '—'}`,
    `ASUNTO ACTUAL: ${asuntoActual}`,
    `CUERPO ACTUAL:\n${cuerpoActual}`,
    `INSTRUCCIÓN: ${instruccion || 'ninguna; mejóralo aplicando las reglas.'}`,
  ].join('\n\n')

  let respuesta: Response
  try {
    respuesta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: REGLAS },
          { role: 'user', content: contexto },
        ],
      }),
    })
  } catch {
    return json(request, { error: 'No se ha podido contactar con la IA. Prueba otra vez.' }, 502)
  }
  if (!respuesta.ok) {
    console.error(`OpenAI ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`)
    return json(request, { error: 'La IA no ha respondido bien. Prueba otra vez en un momento.' }, 502)
  }

  let propuesta: { subject?: string; body?: string }
  try {
    const datos = await respuesta.json()
    propuesta = JSON.parse(datos.choices?.[0]?.message?.content ?? '{}')
  } catch {
    return json(request, { error: 'La IA ha devuelto algo que no se entiende. Prueba otra vez.' }, 502)
  }
  if (!propuesta.subject?.trim() || !propuesta.body?.trim()) {
    return json(request, { error: 'La IA ha devuelto un correo vacío. Prueba otra vez.' }, 502)
  }

  // Lo que el envío pone solo no puede venir en el cuerpo, y la despedida tiene que estar.
  // Se arregla aquí en vez de confiar en que el modelo lo respete siempre.
  let cuerpo = propuesta.body.replace(PRESENTACION_ESCRITA, '').trim()
  cuerpo = cuerpo.replace(/\n+\s*un saludo[^\n]*$/i, '').trim()
  cuerpo = `${cuerpo}\n\n${DESPEDIDA}`

  // Avisos, no bloqueos: quien revisa decide, pero lo ve antes de guardar.
  const avisos: string[] = []
  const sinCitas = cuerpo.replace(/«[^»]*»|"[^"]*"/g, '')
  for (const [patron, motivo] of PROHIBIDO) if (patron.test(sinCitas)) avisos.push(`Revisa: ${motivo}.`)
  if (/\b(te|tu|tus|contigo)\b/i.test(sinCitas)) avisos.push('Revisa: parece que mezcla «tú» con «vosotros».')
  const palabras = cuerpo.replace(DESPEDIDA, '').split(/\s+/).filter(Boolean).length
  if (palabras > 150) avisos.push(`Revisa: tiene ${palabras} palabras, más de las 140 recomendadas.`)

  return json(request, { subject: propuesta.subject.trim(), body: cuerpo, avisos, modelo })
})
