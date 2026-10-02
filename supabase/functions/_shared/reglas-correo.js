// Revisión automática de un correo de prospección antes de que salga (24/09/2026).
//
// Es la puerta que no se salta nadie: la aplica `outreach-send` a cada mensaje justo
// antes de enviarlo, lo haya aprobado una persona o no. Lo que no pasa se marca
// 'fallido' con el motivo, y se ve en el Hub: no sale nunca un correo con un hueco de
// plantilla, una firma duplicada o una promesa que no se puede cumplir.
//
// Solo comprueba la FORMA. Que lo que dice del negocio sea verdad lo sostiene la
// evidencia de la skill, y eso no lo puede comprobar una expresión regular.
//
// JavaScript plano y sin dependencias a propósito: lo importan la Edge Function (Deno),
// el importador y `scripts/revisar-correos.mjs` (Node), sin compilar nada. Si una regla
// cambia aquí, cambia en los tres sitios a la vez.

export const DESPEDIDA = 'Un saludo y gracias por vuestro tiempo,'

/**
 * La tipografía que una persona no teclea en un correo, cambiada por la que sí.
 * Solo lo que se puede cambiar sin tocar el sentido de la frase: comillas angulares y
 * curvas por rectas, el carácter "…" por tres puntos, y espacios invisibles fuera.
 * La raya (—) NO se cambia sola: según la frase pide coma, dos puntos o punto, y eso lo
 * decide quien escribe. Por eso la bloquea `revisarCorreo`.
 */
export function normalizarTipografia(texto) {
  return String(texto ?? '')
    .replace(/[«»“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/…/g, '...')
    .replace(/[     ]/g, ' ')
    .replace(/[​-‍⁠﻿]/g, '')
}

// Lo que va entre comillas es la voz del negocio o de sus clientes, no la nuestra: una
// reseña puede tutear, exclamar o recortarse con "...", y eso no es un fallo del correo.
function sinCitas(texto) {
  return texto
    .replace(/«[^»]*»/g, '""')
    .replace(/“[^”]*”/g, '""')
    .replace(/"[^"\n]*"/g, '""')
}

const MARCADORES = [
  [/\[[^\]\n]*\]/, 'tiene un marcador entre corchetes'],
  [/\{[^}\n]*\}/, 'tiene un marcador entre llaves'],
  [/<[^>\n]+>/, 'tiene algo entre < >'],
  // Sin /i: en minúscula, "todo" es una palabra normal del castellano.
  [/\b(TODO|TBD|XXX)\b|lorem ipsum/, 'tiene un texto de relleno'],
  [/\b(undefined|null|NaN)\b/, 'tiene un valor vacío del programa'],
]

// Caracteres que delatan un texto generado: nadie los escribe a mano en un correo.
const CARACTERES_DE_MAQUINA = [
  [/[—–]/, 'tiene una raya (— o –): hay que cambiarla por coma, dos puntos o punto'],
  [/[«»“”„‟‘’]/, 'tiene comillas tipográficas en vez de las normales'],
  [/…/, 'tiene el carácter "…" en vez de tres puntos'],
  [/[•→←↑↓✓✔✗★]/, 'tiene viñetas, flechas o símbolos'],
  [/[  ​-‍⁠﻿]/, 'tiene espacios invisibles'],
]

const PROHIBIDO = [
  [/atender llamadas|atiende (las )?llamadas|coger (las )?llamadas|coge (las )?llamadas|whatsapp y (las )?llamadas/i, 'ofrece atender llamadas, y el asistente es solo de WhatsApp'],
  [/ejemplo real|cl[ií]nicas como la vuestra|centros como el vuestro/i, 'promete un ejemplo real o clientes que no hay'],
  [/€|\beuros?\b|\bprecios?\b|\btarifas?\b/i, 'habla de precios, y en un correo frío no van'],
  [/garantiza|\d+ ?%/i, 'hace una promesa numérica o una garantía'],
]

/**
 * Devuelve la lista de problemas; vacía si el correo puede salir.
 * @param {{ subject?: string, body?: string, to_email?: string }} correo
 * @returns {string[]}
 */
export function revisarCorreo(correo) {
  const problemas = []
  const asunto = String(correo.subject ?? '').trim()
  const cuerpo = String(correo.body ?? '').replace(/\r\n/g, '\n').trim()

  // --- Asunto
  if (!asunto) problemas.push('El asunto está vacío.')
  if (asunto.length > 90) problemas.push(`El asunto es demasiado largo (${asunto.length} caracteres).`)
  if (/^(re|fwd?|rv):/i.test(asunto)) problemas.push('El asunto finge ser una respuesta o un reenvío.')
  for (const [patron, motivo] of MARCADORES) if (patron.test(asunto)) problemas.push(`El asunto ${motivo}.`)
  for (const [patron, motivo] of CARACTERES_DE_MAQUINA) if (patron.test(asunto)) problemas.push(`El asunto ${motivo}.`)

  // --- Cuerpo: que esté entero
  if (!cuerpo) return [...problemas, 'El cuerpo está vacío.']
  for (const [patron, motivo] of MARCADORES) if (patron.test(cuerpo)) problemas.push(`El cuerpo ${motivo}.`)
  for (const [patron, motivo] of CARACTERES_DE_MAQUINA) if (patron.test(cuerpo)) problemas.push(`El cuerpo ${motivo}.`)

  const propio = sinCitas(cuerpo)
  if (/\.\.\./.test(propio)) problemas.push('Tiene puntos suspensivos fuera de una cita: puede ser un trozo sin terminar.')

  const parrafos = cuerpo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (parrafos.length < 3) problemas.push('Tiene menos de tres párrafos: le falta alguna parte.')
  if (new Set(parrafos).size !== parrafos.length) problemas.push('Tiene un párrafo repetido.')

  const palabras = cuerpo.replace(DESPEDIDA, '').split(/\s+/).filter(Boolean).length
  if (palabras < 50) problemas.push(`Es demasiado corto (${palabras} palabras).`)
  if (palabras > 180) problemas.push(`Es demasiado largo (${palabras} palabras).`)

  // --- Lo que pone el envío no puede venir escrito
  if (/^\s*(hola|buenos d[ií]as|buenas( tardes)?|estimad[oa]s?)\b/i.test(cuerpo)) {
    problemas.push('Empieza con un saludo, y el saludo lo pone el envío con el nombre de quien firma.')
  }
  const ultima = cuerpo.split('\n').map((l) => l.trim()).filter(Boolean).at(-1)
  if (ultima !== DESPEDIDA) problemas.push(`No termina en "${DESPEDIDA}": o falta la despedida o hay algo detrás, como una firma.`)
  if (/studio32\.es|digital systems/i.test(cuerpo)) problemas.push('Lleva la firma o la web escritas, y las pone el envío.')

  // --- Lo que no se dice
  for (const [patron, motivo] of PROHIBIDO) if (patron.test(propio)) problemas.push(`El cuerpo ${motivo}.`)
  if (/[¡!]/.test(propio)) problemas.push('Tiene exclamaciones.')
  if (/\p{Extended_Pictographic}/u.test(cuerpo)) problemas.push('Tiene emojis.')
  if (/(^|[^\p{L}])(tú|te|tu|tus|ti|contigo)(?![\p{L}])/iu.test(propio)) problemas.push('Mezcla el "tú" con el "vosotros".')
  if (!/\b(montamos|hacemos|nos dedicamos)\b/i.test(propio)) problemas.push('No dice qué ofrecemos: falta la frase de oferta.')

  // --- Destinatario
  if (correo.to_email !== undefined && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(correo.to_email).trim())) {
    problemas.push('La dirección del destinatario no es válida o lleva tildes, y el servidor no la envía.')
  }

  return problemas
}

// ---------------------------------------------------------------------------------------
// Pauta de estilo del 02/10/2026: evidencia, fricción, solución, pregunta.
//
// A diferencia de `revisarCorreo`, esto NO para el envío. Son avisos: lo enseñan el
// importador, "Reescribir con IA" y `npm run outreach:revisar`, y decide quien revisa.
// Entran como aviso y no como puerta porque no se han calibrado contra la cola real, y una
// puerta nueva puede dejar en `fallido` borradores que ya estaban aprobados con la pauta
// anterior. Cuando se hayan medido (`npm run outreach:revisar -- todos`), las que no den
// falsos positivos suben a `revisarCorreo`, como se hizo el 24/09 con los 35 enviados.
// ---------------------------------------------------------------------------------------

/** Palabra o expresión entera: `\b` no sirve con tildes, así que se mira que no la rodeen letras. */
const palabra = (alternativas) => new RegExp(`(?<![\\p{L}])(?:${alternativas})(?![\\p{L}])`, 'iu')

const AVISOS_DE_ESTILO = [
  // Una sola oferta. Las webs, el SEO y lo demás se enseñan cuando contestan, no en el primer correo.
  [palabra('aparte del asistente|además del asistente|también hacemos|también montamos|SEO|marketing|agentes? de voz'),
    'ofrece algo más que la oferta de la campaña: en el primer correo va un solo producto'],
  [palabra('potenciar|potenciamos|revolucion\\p{L}*|transformar|transformamos|siguiente nivel|maximiz\\p{L}*|exponencial\\p{L}*|innovador\\p{L}*|última generación|omnicanal|funnel|sinergias?|conversiones'),
    'usa lenguaje de agencia o de marketing'],
  [palabra('API|webhooks?|Supabase|Twilio|LLM|REST|infraestructura'),
    'habla de la técnica: a la clínica le interesa el resultado, no cómo está hecho'],
  [palabra('IA|inteligencia artificial'),
    'vende "IA": la clínica compra respuestas rápidas y citas, y de IA se habla si preguntan'],
  // Lo que no podemos saber desde fuera. Se describe lo que se ve, no lo que pasa por dentro.
  [palabra('estáis perdiendo|perdéis (pacientes|citas|clientes|dinero)|se os escapan|se os pasan|recepción (está )?saturada|no (se )?contestáis|no (se )?respondéis|hasta el día siguiente|los pacientes esperan|nadie (contesta|responde|atiende)|seguro que (se|os|hay|tenéis|estáis)'),
    'afirma algo que no se puede comprobar desde fuera: describe lo que se ve, no lo que pasa por dentro'],
  [palabra('anticuad\\p{L}*|obsolet\\p{L}*|ineficien\\p{L}*|gestionáis mal|estáis gestionando mal|vuestra web (está mal|es mala)'),
    'critica al negocio: plantéalo como una oportunidad'],
  // Cumplidos que valdrían para cualquier clínica; solo valen pegados a un dato concreto.
  [palabra('se nota que (cuidáis|os importa)|se nota vuestr\\p{L}*|cuidáis (mucho|tanto)|clínica increíble|llamado (mucho )?la atención|nos encanta|gran reputación|compromiso con la excelencia|enfoque profesional'),
    'tiene un cumplido que valdría para cualquier clínica: tiene que ir con un dato concreto'],
  [palabra('reunión|videollamada|demo|30 minutos|agendar'),
    'pide una reunión, una llamada o una demo: el primer correo solo pide permiso para enseñarlo'],
]

const AVISOS_DE_ASUNTO = [
  [palabra('propuesta|colaboración|oportunidad|oferta|gratis|automatiza\\p{L}*|aumenta\\p{L}*|revoluciona\\p{L}*|IA'), 'suena a campaña'],
]

/**
 * Devuelve los avisos de estilo; vacía si el correo sigue la pauta. No son motivo para parar
 * el envío.
 * @param {{ subject?: string, body?: string }} correo
 * @returns {string[]}
 */
export function revisarEstilo(correo) {
  const avisos = []
  const asunto = String(correo.subject ?? '').trim()
  const cuerpo = String(correo.body ?? '').replace(/\r\n/g, '\n').trim()
  if (!cuerpo) return avisos

  for (const [patron, motivo] of AVISOS_DE_ASUNTO) if (patron.test(asunto)) avisos.push(`El asunto ${motivo}.`)

  const propio = sinCitas(cuerpo)
  for (const [patron, motivo] of AVISOS_DE_ESTILO) if (patron.test(propio)) avisos.push(`El cuerpo ${motivo}.`)

  // El destinatario tiene que poder entenderlo en unos quince segundos.
  const palabras = cuerpo.replace(DESPEDIDA, '').split(/\s+/).filter(Boolean).length
  if (palabras < 80 || palabras > 160) avisos.push(`Tiene ${palabras} palabras, y la pauta es de 100 a 140 (se admite de 80 a 160).`)

  // Cuatro párrafos: personalización, fricción, solución, pregunta. Más es que cabe de todo.
  const parrafos = cuerpo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const contenido = parrafos.at(-1) === DESPEDIDA ? parrafos.slice(0, -1) : parrafos
  if (contenido.length > 4) avisos.push(`Tiene ${contenido.length} párrafos antes de la despedida: una personalización, una fricción, una solución y una pregunta.`)

  // El cierre es una pregunta corta, y la única.
  const cierre = contenido.at(-1) ?? ''
  if (!/\?\s*$/.test(cierre)) avisos.push('El último párrafo no es una pregunta: el cierre es una sola pregunta de sí o no.')
  else if (cierre.split(/\s+/).length > 30) avisos.push('El cierre es largo: una pregunta corta, que se conteste con un sí.')
  if ((propio.match(/\?/g) ?? []).length > 1) avisos.push('Tiene más de una pregunta: el cierre es una sola.')

  return avisos
}
