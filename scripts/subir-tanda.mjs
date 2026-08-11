// Sube una tanda de leads a la bandeja de prospección del Hub.
//
// Entrada: el JSON que produce el Modo C de la skill studio32-lead-prospector.
//
//   {
//     "tanda": "2026-08-07-dentistas-guadalajara",
//     "leads": [
//       { "sender_id": "juanma", "porque": "...", "asunto": "...", "cuerpo": "...",
//         "digital_score": 32, "opportunity_score": 84, "huella": { ... } }
//     ]
//   }
//
// Los datos del negocio (nombre, vertical, ciudad, email...) NO se repiten aquí:
// se proyectan desde `huella.negocio`, que es la única fuente de verdad.
//
// Uso:
//   npm run leads:subir -- tanda.json               (revisa y no escribe nada)
//   npm run leads:subir -- tanda.json --confirmar   (escribe de verdad)
//
// La revisión es el modo por defecto a propósito: lo que se sube acaba delante de
// Juanma, y una tanda con relleno hace que deje de abrir la bandeja.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
// El build 2020: el esquema de la huella declara draft 2020-12, que el Ajv por
// defecto (draft-07) no reconoce.
import { Ajv2020 } from 'ajv/dist/2020.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKSPACE = 'studio32'

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')
const archivo = args.find((a) => !a.startsWith('--'))

if (!archivo) {
  console.error('Uso: npm run leads:subir -- <archivo.json> [--confirmar]')
  process.exit(1)
}

// ── Esquema de la huella: misma fuente que usa la skill ──
const esquema = JSON.parse(
  await readFile(path.join(root, 'skills/studio32-lead-prospector/references/huella.schema.json'), 'utf8'),
)
const validarHuella = new Ajv2020({ allErrors: true, strict: false }).compile(esquema)

// Misma fuente que usa el envío. Aquí solo se necesitan los nombres, para detectar
// cuerpos que vienen ya firmados.
const { remitentes } = JSON.parse(await readFile(path.join(root, 'src/remitentes.json'), 'utf8'))
const NOMBRES_REMITENTE = Object.values(remitentes).map((r) => r.nombre.toLowerCase())

// ── Dominio propio: la clave real de "un negocio, un correo" ──
//
// El índice único por email no impide escribir a info@ y a citas@ de la misma
// clínica. El dominio sí — pero solo si es suyo. Dos negocios distintos pueden usar
// los dos gmail.com, así que en los proveedores gratuitos el dominio no identifica
// nada y se deja a null: esas filas se deduplican solo por email.
const PROVEEDORES_GENERICOS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com',
  'outlook.es', 'live.com', 'live.es', 'msn.com', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'me.com', 'aol.com', 'terra.es', 'telefonica.net', 'movistar.es',
])

function dominioPropio(email) {
  const d = email?.split('@')[1]?.trim().toLowerCase()
  if (!d || PROVEEDORES_GENERICOS.has(d)) return null
  // Sin el www. y sin subdominio de correo, para que mail.clinica.es y clinica.es
  // no cuenten como dos negocios.
  return d.replace(/^(www|mail|correo)\./, '')
}

const entrada = JSON.parse(await readFile(path.resolve(archivo), 'utf8'))
const tanda = entrada.tanda ?? path.basename(archivo, '.json')
const leads = entrada.leads ?? []

if (leads.length === 0) {
  console.error('La tanda no trae leads.')
  process.exit(1)
}

// ── La puerta ──
// Lo que JSON Schema no puede expresar: coherencia entre lo que se afirma y lo que
// realmente se verificó. Ver references/huella.md.

function observaciones(h) {
  return [
    ...Object.values(h.identidad ?? {}),
    ...Object.values(h.voz ?? {}).filter((v) => v && typeof v === 'object' && !Array.isArray(v)),
    ...(h.lo_que_ya_funciona ?? []),
  ].filter((o) => o && typeof o === 'object' && o.fuente)
}

// `outreach-guidelines.md` escribe estos como "nunca", no como preferencia. Si son
// absolutos, bloquean: un correo así no debería llegar a la bandeja para que alguien
// decida a mano si lo deja pasar.
const ANTIPATRONES = [
  [/espero que (est[eé]s|se encuentre)/i, 'abre con "espero que estés bien"'],
  [/\b(transformamos|potenciamos|impulsamos|revolucionamos)\b/i, 'usa lenguaje de agencia genérica'],
  [/\b(al siguiente nivel|haz crecer tu negocio)\b/i, 'incluye una frase motivacional'],
  [/\+\s*\d+\s*%/, 'hace una promesa numérica'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'lleva emojis'],
  [/tu web es mala|web (est[aá] )?(desactualizada|obsoleta|anticuada)/i, 'critica la web en vez de reformular la oportunidad'],
]

function revisar(lead, i) {
  const errores = []
  const avisos = []
  const h = lead.huella

  if (!h) return { errores: ['no trae huella'], avisos }

  if (!validarHuella(h)) {
    for (const e of validarHuella.errors.slice(0, 5)) {
      errores.push(`huella${e.instancePath}: ${e.message}`)
    }
  }

  // Puerta 1 — sin email no hay correo que aprobar
  const email = h.negocio?.email
  if (!email) errores.push('sin email de contacto público')
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errores.push(`email con formato raro: ${email}`)

  // Puerta 2 — al menos un dolor sostenido
  if (!(h.dolor ?? []).some((d) => d.confianza === 'alta' || d.confianza === 'media')) {
    errores.push('ningún dolor con confianza alta o media')
  }

  // Puerta 3 — al menos un ángulo redactable
  if ((h.angulos ?? []).length === 0) errores.push('sin ángulos de approach')

  // Puerta 4 — coherencia entre lo verificado y lo afirmado
  const v = h.verificacion ?? {}
  const obs = observaciones(h)
  if (v.web_cargada === false && obs.some((o) => o.fuente === 'web')) {
    errores.push('afirma cosas con fuente "web" pero web_cargada es false')
  }
  if (!v.resenas_leidas && obs.some((o) => o.fuente === 'resenas')) {
    errores.push('afirma cosas con fuente "resenas" pero no se leyó ninguna')
  }

  // Puerta 5 — el correo, completo y para alguien
  if (!lead.sender_id) errores.push('sin sender_id: nadie firma el correo')
  if (!lead.porque?.trim()) errores.push('sin "porque": es lo que se lee para decidir')
  if (!lead.asunto?.trim()) errores.push('sin asunto')
  if (!lead.cuerpo?.trim()) errores.push('sin cuerpo')

  // Avisos: no bloquean, pero suelen señalar un correo flojo
  const palabras = (lead.cuerpo ?? '').trim().split(/\s+/).filter(Boolean).length
  if (palabras && (palabras < 80 || palabras > 120)) avisos.push(`cuerpo de ${palabras} palabras (la guía pide 80-120)`)

  const palabrasAsunto = (lead.asunto ?? '').trim().split(/\s+/).filter(Boolean).length
  if (palabrasAsunto > 7) avisos.push(`asunto de ${palabrasAsunto} palabras (la guía pide 4-7)`)
  if (/^(propuesta|colaboraci[oó]n|oportunidad)/i.test(lead.asunto ?? '')) {
    avisos.push('asunto genérico: la guía descarta "Propuesta", "Colaboración", "Oportunidad"')
  }

  const texto = `${lead.asunto ?? ''} ${lead.cuerpo ?? ''}`
  for (const [re, motivo] of ANTIPATRONES) if (re.test(texto)) errores.push(`el correo ${motivo}`)

  // Puerta 6 — el cuerpo no lleva firma
  //
  // La firma la compone el script de envío desde src/remitentes.json, con el
  // sender_id que tenga el lead en ese momento. Si la firma viniera incrustada en el
  // texto, reasignar remitente en el hub mandaría un correo firmado por quien no es
  // — y ese es justamente el caso que hace falta que funcione.
  //
  // El cierre ("Un saludo,") sí es parte de la voz y se queda. Lo que sobra es el
  // bloque de nombre y datos de contacto.
  const cuerpo = (lead.cuerpo ?? '').trim()
  if (/studio32\.es|Digital Systems/i.test(cuerpo)) {
    errores.push('el cuerpo lleva bloque de firma: la firma la compone el envío')
  } else {
    const ultima = cuerpo.split('\n').filter((l) => l.trim()).pop()?.trim().toLowerCase()
    if (ultima && NOMBRES_REMITENTE.includes(ultima.replace(/[.,]$/, ''))) {
      errores.push(`el cuerpo termina firmado ("${ultima}"): la firma la compone el envío`)
    }
  }

  // El test de la guía: si el nombre del negocio no aparece, probablemente sirve
  // para cualquier otro negocio — y entonces es plantilla.
  if (h.negocio?.nombre && !texto.toLowerCase().includes(h.negocio.nombre.toLowerCase().split(' ')[0])) {
    avisos.push('el correo no menciona al negocio: revisa que no sea plantilla')
  }

  return { errores, avisos, indice: i }
}

// ── Revisión ──
const revisados = leads.map((lead, i) => ({ lead, ...revisar(lead, i) }))
const pasan = revisados.filter((r) => r.errores.length === 0)
const caen = revisados.filter((r) => r.errores.length > 0)

console.log(`\nTanda: ${tanda}`)
console.log(`${leads.length} lead(s) en el archivo\n`)

for (const r of revisados) {
  const nombre = r.lead.huella?.negocio?.nombre ?? `lead #${r.indice + 1}`
  if (r.errores.length) {
    console.log(`  DESCARTADO  ${nombre}`)
    for (const e of r.errores) console.log(`              · ${e}`)
  } else {
    console.log(`  OK          ${nombre}  ->  ${r.lead.sender_id}`)
  }
  for (const a of r.avisos) console.log(`              aviso: ${a}`)
}

console.log(`\n${pasan.length} pasan la puerta, ${caen.length} descartados.`)

if (pasan.length === 0) {
  console.log('Nada que subir.')
  process.exit(caen.length ? 1 : 0)
}

if (!confirmar) {
  console.log('\nRevisión únicamente: no se ha escrito nada.')
  console.log('Para subirlos de verdad, repite con --confirmar')
  process.exit(0)
}

// ── Subida ──
const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('\nFaltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env local.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let subidos = 0
let repetidos = 0
let fallidos = 0

// De uno en uno para poder distinguir "ya existía" de "falló de verdad". Una tanda
// son unos pocos leads: no compensa optimizarlo.
for (const { lead } of pasan) {
  const n = lead.huella.negocio
  const { error } = await admin.from('leads').insert({
    workspace_id: WORKSPACE,
    nombre: n.nombre,
    vertical: n.vertical,
    ciudad: n.ciudad,
    email: n.email,
    web: n.web ?? null,
    maps_url: n.maps_url ?? null,
    telefono: n.telefono ?? null,
    instagram: n.instagram ?? null,
    dominio: dominioPropio(n.email),
    huella: lead.huella,
    porque: lead.porque,
    sender_id: lead.sender_id,
    asunto: lead.asunto,
    cuerpo: lead.cuerpo,
    digital_score: lead.digital_score ?? null,
    opportunity_score: lead.opportunity_score ?? null,
    scores_desglose: lead.scores_desglose ?? null,
    tanda,
  })

  if (!error) {
    subidos += 1
  } else if (error.code === '23505') {
    // Ya se le escribió, se rechazó o pidió la baja. Distinguir qué índice saltó
    // importa: por dominio significa que ya hay OTRO contacto de este mismo negocio
    // en la bandeja, que es el caso que no se veía antes.
    repetidos += 1
    const porDominio = /leads_dominio_unico/.test(error.message)
    console.log(
      porDominio
        ? `  ya existía  ${n.nombre} — ya hay un contacto de ${dominioPropio(n.email)} en la bandeja`
        : `  ya existía  ${n.nombre} (${n.email})`,
    )
  } else {
    fallidos += 1
    console.error(`  FALLO       ${n.nombre}: ${error.message}`)
  }
}

console.log(`\nSubidos: ${subidos}. Ya existían: ${repetidos}. Fallidos: ${fallidos}.`)
process.exit(fallidos ? 1 : 0)
