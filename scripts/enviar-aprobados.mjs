// Envía los leads que el equipo ya aprobó en la bandeja del Hub.
//
// Uso:
//   npm run leads:enviar                  (muestra qué saldría, no envía nada)
//   npm run leads:enviar -- --confirmar   (envía de verdad)
//   npm run leads:enviar -- --confirmar --limite 10 --pausa 60
//
// La revisión es el modo por defecto a propósito, igual que en subir-tanda.mjs: esto
// escribe a personas reales desde el buzón personal de un socio y no se deshace.
//
// Por qué vive aquí y no en el hub ni en un servidor: enviar requiere la App Password
// del buzón de cada uno, y una App Password da acceso COMPLETO al buzón por IMAP, no
// solo permiso para enviar. Esa credencial no entra en Supabase, ni en el bundle del
// hub, ni en Railway. Vive en el .env local de quien ejecuta esto.
//
// El cuerpo que subió la skill NO lleva firma. La firma se compone aquí desde
// src/remitentes.json según el `sender_id` que tenga el lead en el momento del envío
// — que es el que decidió quien aprobó. Por eso reasignar remitente en el hub es una
// operación segura: no hay una firma incrustada en el texto que se quede desfasada.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKSPACE = 'studio32'

const args = process.argv.slice(2)
const confirmar = args.includes('--confirmar')

function opcion(nombre, porDefecto) {
  const i = args.indexOf(`--${nombre}`)
  if (i === -1) return porDefecto
  const valor = Number(args[i + 1])
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto
}

// Tope por pasada. Gmail corta a las malas si se le mete prisa, y una ráfaga de 50
// correos fríos desde una cuenta personal es la forma más rápida de quemarla.
const limite = opcion('limite', 25)
// Segundos entre envío y envío. Con la pausa por defecto, 25 correos tardan ~20 min.
const pausa = opcion('pausa', 45)

const { remitentes } = JSON.parse(await readFile(path.join(root, 'src/remitentes.json'), 'utf8'))

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env local.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Qué hay aprobado ──
const { data: leads, error } = await admin
  .from('leads')
  .select('id, nombre, email, sender_id, asunto, cuerpo, tanda')
  .eq('workspace_id', WORKSPACE)
  .eq('estado', 'aprobado')
  .order('created_at', { ascending: true })
  .limit(limite)

if (error) {
  console.error(`No se pudo leer la bandeja: ${error.message}`)
  process.exit(1)
}

if (!leads.length) {
  console.log('\nNada aprobado pendiente de enviar.')
  process.exit(0)
}

// ── Composición del correo ──
function componer(lead) {
  const remitente = remitentes[lead.sender_id]
  if (!remitente) return null
  return {
    from: `${remitente.nombre} · Studio32 <${remitente.email}>`,
    to: lead.email,
    subject: lead.asunto,
    text: `${lead.cuerpo.trim()}\n\n${remitente.firma.join('\n')}\n`,
  }
}

// ── Credenciales por remitente ──
// Cada socio pone SU App Password en SU .env. Quien ejecuta el script solo puede
// enviar en nombre de aquellos cuyas credenciales tenga.
function credenciales(senderId) {
  const clave = senderId.toUpperCase()
  const user = process.env[`SMTP_${clave}_USER`]
  const pass = process.env[`SMTP_${clave}_PASS`]
  return user && pass ? { user, pass } : null
}

const transportes = new Map()

function transporte(senderId) {
  if (transportes.has(senderId)) return transportes.get(senderId)
  const auth = credenciales(senderId)
  const t = auth
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: Number(process.env.SMTP_PORT ?? 465) === 465,
        auth,
      })
    : null
  transportes.set(senderId, t)
  return t
}

// ── Revisión ──
const listos = []
const bloqueados = []

for (const lead of leads) {
  const mail = componer(lead)
  if (!mail) {
    bloqueados.push([lead, `remitente desconocido: ${lead.sender_id}`])
  } else if (!credenciales(lead.sender_id)) {
    bloqueados.push([lead, `sin SMTP_${lead.sender_id.toUpperCase()}_USER/_PASS en tu .env`])
  } else {
    listos.push({ lead, mail })
  }
}

console.log(`\n${leads.length} lead(s) aprobados en cola\n`)

for (const { lead, mail } of listos) {
  console.log(`  ENVIAR      ${lead.nombre} <${lead.email}>`)
  console.log(`              de: ${mail.from}`)
  console.log(`              asunto: ${lead.asunto}`)
}
for (const [lead, motivo] of bloqueados) {
  console.log(`  BLOQUEADO   ${lead.nombre} — ${motivo}`)
}

console.log(`\n${listos.length} se pueden enviar, ${bloqueados.length} bloqueados.`)

if (bloqueados.length) {
  console.log('Los bloqueados siguen aprobados: los enviará quien tenga esas credenciales.')
}

if (!listos.length) process.exit(bloqueados.length ? 1 : 0)

if (!confirmar) {
  console.log('\nRevisión únicamente: no se ha enviado nada.')
  console.log('Para enviarlos de verdad, repite con --confirmar')
  process.exit(0)
}

// ── Envío ──
// Se verifica la conexión de cada buzón ANTES de empezar. Descubrir a mitad de tanda
// que una App Password caducó deja la mitad enviada y la otra mitad en un estado que
// hay que revisar a mano.
for (const senderId of new Set(listos.map((l) => l.lead.sender_id))) {
  try {
    await transporte(senderId).verify()
  } catch (e) {
    console.error(`\nEl buzón de ${senderId} no acepta la conexión: ${e.message}`)
    console.error('No se ha enviado nada. Revisa la App Password antes de reintentar.')
    process.exit(1)
  }
}

let enviados = 0
let fallidos = 0

for (const [i, { lead, mail }] of listos.entries()) {
  try {
    await transporte(lead.sender_id).sendMail(mail)
    // El script es el único que puede marcar 'enviado': el trigger de la tabla se lo
    // prohíbe al hub justamente para que un fallo de interfaz no dé por enviado algo
    // que no salió.
    await admin
      .from('leads')
      .update({ estado: 'enviado', enviado_el: new Date().toISOString(), error_envio: null })
      .eq('id', lead.id)
    enviados += 1
    console.log(`  enviado     ${lead.nombre}`)
  } catch (e) {
    await admin
      .from('leads')
      .update({ estado: 'fallido', error_envio: String(e.message).slice(0, 500) })
      .eq('id', lead.id)
    fallidos += 1
    console.error(`  FALLO       ${lead.nombre}: ${e.message}`)
  }

  if (i < listos.length - 1) await esperar(pausa * 1000)
}

console.log(`\nEnviados: ${enviados}. Fallidos: ${fallidos}.`)
process.exit(fallidos ? 1 : 0)
