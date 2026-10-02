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
import { normalizarTipografia, revisarCorreo, revisarEstilo } from '../_shared/reglas-correo.js'

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
// Pauta del 02/10/2026: evidencia, fricción, solución, pregunta.
const REGLAS = `Reescribes correos de prospección en frío de Studio32, un estudio pequeño y técnico que monta sistemas digitales para negocios locales. Escribes en español de España, como una persona que ha dedicado diez minutos a mirar ese negocio, no como una agencia.

UN CORREO = UNA personalización, UNA fricción, UNA solución y UNA pregunta. Se investiga mucho y se escribe poco: elige lo mejor y deja el resto fuera. Que se entienda en unos 15 segundos.

ESTRUCTURA (cuatro párrafos y la despedida):
1. PERSONALIZACIÓN. Una sola evidencia, la más específica que haya en el DETALLE ANCLA, los ELOGIOS o la EVIDENCIA, en una o dos frases y con su dato concreto (un nombre, una cifra pública, una frase literal). Si hay varias, prefiere en este orden: una reseña o historia llamativa, un tratamiento concreto que citan, miembros del equipo nombrados, una especialización diferencial, que forman a otros profesionales, tecnología, trayectoria, número y nota de reseñas. Nunca una lista de todo lo encontrado, y nunca un cumplido sin dato ("se nota que cuidáis a vuestros pacientes").
2. FRICCIÓN. Nuevo párrafo que enlaza con el anterior ("Sin embargo, …") y cuenta UNA cosa que se ve en el proceso de pedir cita, desde lo que encuentra el paciente: "al pedir cita, el paciente encuentra…", "no aparece una forma de…". Solo lo que diga HUECOS DIGITALES o la EVIDENCIA. Describe lo observable y no inventes lo que pasa por dentro: nada de "estáis perdiendo pacientes", "los mensajes de la noche no se responden", "recepción saturada" ni "seguro que…". Tiene que seguir siendo razonable aunque ya lo gestionen bien por dentro. Nunca critiques su web ni su forma de trabajar.
3. SOLUCIÓN. Nuevo párrafo, una sola frase en primera persona que empieza por "Es justo lo que montamos en Studio32:". Conecta con ESA fricción y se basa en la OFERTA de la campaña; di solo lo que responde a la fricción y no enumeres funciones:
   - falta de reserva inmediata: conectado con la agenda real, deja la cita cerrada en el momento.
   - fuera de horario: responde al instante a cualquier hora y también reserva fuera de horario.
   - formulario o esperar respuesta: conversación natural por WhatsApp, sin pasos, con la cita cerrada ahí mismo.
   - carga de recepción: responde las preguntas de siempre, mira la disponibilidad, reserva y manda el recordatorio.
   Habla del resultado y no de la técnica: nada de API, webhook, LLM, "automatización" ni "inteligencia artificial" (la clínica no compra IA). Si la OFERTA es una web, la solución es esa web y la fricción tiene que ser la que esa web arregla.
4. PREGUNTA. Nuevo párrafo con una única pregunta de sí o no, que se conteste con un "sí": "¿Os enseño cómo funcionaría aplicado a vuestra clínica?" (o "vuestro centro"; también "¿Os enseño cómo quedaría en vuestro caso?"). Si la OFERTA es una web: "¿Os enseño cómo quedaría la vuestra?". Nunca reunión, llamada ni demo.
5. Última línea, exactamente: "${DESPEDIDA}"

REGLAS DURAS:
- NO empieces con saludo ni presentación ("Hola", "Soy…", "Buenos días"): los añade el envío con el nombre de quien firma. Empieza directamente por el punto 1.
- NO escribas nombre, firma, "Studio32" como firma ni la web.
- UN solo producto: el de la OFERTA. No menciones otros servicios (webs, SEO, ficha de Google, correo, marketing, agentes de voz). Se enseñan cuando contestan, no en el primer correo.
- Trato de vosotros al negocio de principio a fin; quien escribe habla en primera persona (yo / nosotros). Nunca "tú" fuera de una cita literal.
- Cada afirmación sobre el negocio tiene que salir de la EVIDENCIA o la HUELLA que se te dan. No inventes cifras, nombres, horarios ni citas, ni cifras de pacientes perdidos, ingresos u horas ahorradas.
- NUNCA cites las quejas de sus clientes.
- NUNCA ofrezcas: atender llamadas de teléfono (el asistente es solo de WhatsApp), "un ejemplo real" o "clínicas como la vuestra" (aún no hay clientes), que el asistente conteste en otros idiomas o distinga sedes o especialidades, promesas numéricas.
- Sí se puede ofrecer: responder y dar cita al momento, a cualquier hora, sobre la agenda real, y mandar un recordatorio antes de la cita.
- Tono tranquilo, directo y observacional, ligeramente informal. Sin emojis, sin exclamaciones, sin "espero que estéis bien", sin viñetas y sin lenguaje de agencia ("potenciar", "transformar", "revolucionar", "siguiente nivel", "maximizar", "innovador", "omnicanal", "funnel", "sinergias").
- Escribe como una persona en un correo: comillas rectas " " (nunca « » ni “ ”), tres puntos y no el carácter …, y NUNCA rayas (— o –): usa coma, dos puntos o punto.
- Entre 100 y 140 palabras sin contar la despedida.
- Asunto corto y llano, con el nombre del negocio o de lo que trata: "Sobre las citas de X", "Pedir cita en X", "Las citas en X", "El WhatsApp de X", "Consulta sobre X", "Una idea para vuestra clínica", "Una idea sobre vuestra agenda", "Una cosa que vi en vuestra web". Nunca "Propuesta", "Colaboración", "Oportunidad", ni promesas ni un gancho ingenioso.

Si te llega una INSTRUCCIÓN de la persona que revisa, aplícala siempre que no rompa las reglas duras. Si la rompe, ignora esa parte.

Responde SOLO con un objeto JSON: {"subject": "...", "body": "..."}. En "body" los párrafos van separados por una línea en blanco (\\n\\n).`

const PRESENTACION_ESCRITA = /^\s*(hola|buenos d[ií]as|buenas)[^\n]*\n+/i

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
  cuerpo = normalizarTipografia(`${cuerpo}\n\n${DESPEDIDA}`)
  const asunto = normalizarTipografia(propuesta.subject.trim())

  // Avisos, no bloqueos: quien revisa decide, pero lo ve antes de guardar. Son las mismas
  // reglas con las que `outreach-send` para un correo, así que lo que aquí sale como
  // aviso, allí no saldría.
  const avisos = [...revisarCorreo({ subject: asunto, body: cuerpo }), ...revisarEstilo({ subject: asunto, body: cuerpo })]
    .map((problema: string) => `Revisa: ${problema}`)

  return json(request, { subject: asunto, body: cuerpo, avisos, modelo })
})
