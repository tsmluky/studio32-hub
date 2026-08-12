// Importa una campaña de prospección al Hub.
//
// Este script es el puente que faltaba: las skills producen archivos JSON en
// local y el Hub lee Supabase. Aquí se juntan.
//
//   npm run outreach:import -- ruta/al/archivo.json
//
// Usa la clave de servicio porque las políticas de las tablas exigen sesión de
// miembro del workspace, y esto corre sin navegador. La clave vive en
// .env.local, que está ignorado por git.
//
// Dos reglas que este script no rompe nunca:
//
//   1. Un lead que ya salió de 'nuevo' no se toca en su estado, responsable ni
//      notas. Si Juanma ya lo contactó, reimportar no puede borrar ese trabajo.
//   2. Un mensaje que ya no es borrador no se sobrescribe. Lo aprobado o
//      enviado es historia, no un borrador que rehacer.

import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const workspaceId = 'studio32'

if (!url || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Complétalas en .env.local.')
}

const source = process.argv[2]
if (!source) {
  throw new Error('Indica el archivo: npm run outreach:import -- ruta/al/archivo.json')
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Misma normalización que la columna generada de la base de datos, para poder
// detectar duplicados antes de intentar la escritura.
function toDomain(website) {
  if (!website) return null
  const stripped = String(website).toLowerCase().replace(/^https?:\/\/(www\.)?/, '')
  const host = stripped.split('/')[0]
  return host || null
}

function toDigits(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  return digits || null
}

const payload = JSON.parse(await readFile(source, 'utf8'))
if (!payload.campaign?.name) throw new Error('El archivo no trae campaign.name.')
if (!Array.isArray(payload.leads) || !payload.leads.length) throw new Error('El archivo no trae leads.')

// --- Campaña -----------------------------------------------------------------

const { data: existingCampaign, error: campaignReadError } = await admin
  .from('outreach_campaigns')
  .select('id')
  .eq('workspace_id', workspaceId)
  .eq('name', payload.campaign.name)
  .maybeSingle()
if (campaignReadError) throw campaignReadError

let campaignId = existingCampaign?.id
if (!campaignId) {
  const { data, error } = await admin
    .from('outreach_campaigns')
    .insert({
      workspace_id: workspaceId,
      name: payload.campaign.name,
      sector: payload.campaign.sector ?? '',
      city: payload.campaign.city ?? '',
      oferta: payload.campaign.oferta ?? '',
    })
    .select('id')
    .single()
  if (error) throw error
  campaignId = data.id
}

// --- Leads existentes, para decidir alta, actualización o duplicado ----------

const { data: currentLeads, error: leadsReadError } = await admin
  .from('outreach_leads')
  .select('id, business_name, postal_code, email, status, domain, phone_digits')
  .eq('workspace_id', workspaceId)
if (leadsReadError) throw leadsReadError

const byDomain = new Map()
const byPhone = new Map()
const byEmail = new Map()
const byName = new Map()
for (const lead of currentLeads ?? []) {
  if (lead.domain) byDomain.set(lead.domain, lead)
  if (lead.phone_digits) byPhone.set(lead.phone_digits, lead)
  if (lead.email) byEmail.set(lead.email.toLowerCase(), lead)
  byName.set(`${lead.business_name.toLowerCase()}|${lead.postal_code ?? ''}`, lead)
}

const report = { creados: 0, actualizados: 0, duplicados: 0, protegidos: 0, borradores: 0, omitidos: 0 }

for (const lead of payload.leads) {
  if (!lead.business_name) {
    report.omitidos += 1
    continue
  }

  const domain = toDomain(lead.website)
  const digits = toDigits(lead.phone)

  const row = {
    workspace_id: workspaceId,
    campaign_id: campaignId,
    business_name: lead.business_name,
    sector: lead.sector ?? payload.campaign.sector ?? '',
    city: lead.city ?? payload.campaign.city ?? '',
    address: lead.address ?? '',
    postal_code: lead.postal_code ?? '',
    website: lead.website ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    mobile: lead.mobile ?? '',
    maps_url: lead.maps_url ?? '',
    score: Number(lead.score ?? 0),
    digital_level: lead.digital_level ?? 'medio',
    has_whatsapp: Boolean(lead.has_whatsapp),
    has_online_booking: Boolean(lead.has_online_booking),
    rating: lead.rating ?? null,
    reviews: lead.reviews ?? null,
    problems: lead.problems ?? [],
    huella: lead.huella ?? {},
    huella_generated_at: lead.huella ? new Date().toISOString() : null,
    source: lead.source ?? 'skill:prospeccion',
  }

  const exact = domain ? byDomain.get(domain) : null
  let leadId

  if (exact) {
    // Identidad segura. Se refresca el diagnóstico, nunca el trabajo comercial.
    if (exact.status !== 'nuevo') report.protegidos += 1
    const { error } = await admin
      .from('outreach_leads')
      .update({
        campaign_id: campaignId,
        score: row.score,
        digital_level: row.digital_level,
        has_whatsapp: row.has_whatsapp,
        has_online_booking: row.has_online_booking,
        rating: row.rating,
        reviews: row.reviews,
        problems: row.problems,
        huella: row.huella,
        huella_generated_at: row.huella_generated_at,
      })
      .eq('id', exact.id)
    if (error) throw error
    leadId = exact.id
    report.actualizados += 1
  } else {
    // Sin dominio no hay certeza. Se da de alta igualmente —un negocio sin web
    // es el lead más valioso— pero se marca el posible duplicado para que lo
    // resuelva una persona.
    const soft =
      (digits && byPhone.get(digits)) ||
      (lead.email && byEmail.get(String(lead.email).toLowerCase())) ||
      byName.get(`${lead.business_name.toLowerCase()}|${lead.postal_code ?? ''}`) ||
      null

    if (soft) {
      row.duplicate_of = soft.id
      report.duplicados += 1
    }

    const { data, error } = await admin.from('outreach_leads').insert(row).select('id').single()
    if (error) throw error
    leadId = data.id
    report.creados += 1

    if (domain) byDomain.set(domain, { id: leadId, status: 'nuevo', business_name: row.business_name, postal_code: row.postal_code })
    if (digits) byPhone.set(digits, { id: leadId })
    if (row.email) byEmail.set(row.email.toLowerCase(), { id: leadId })
  }

  // --- Borrador -------------------------------------------------------------

  if (!lead.message?.subject || !lead.message?.body) continue
  if (!row.email) continue

  const { data: existingMessages, error: messageReadError } = await admin
    .from('outreach_messages')
    .select('id, status')
    .eq('lead_id', leadId)
  if (messageReadError) throw messageReadError

  const untouched = (existingMessages ?? []).find((message) => message.status === 'borrador')
  const beyondDraft = (existingMessages ?? []).some((message) => message.status !== 'borrador')

  if (beyondDraft) {
    // Ya se aprobó o se envió algo a este lead. No se toca.
    continue
  }

  const message = {
    workspace_id: workspaceId,
    lead_id: leadId,
    from_email: payload.campaign.from_email ?? '',
    reply_to: payload.campaign.reply_to ?? payload.campaign.from_email ?? '',
    to_email: row.email,
    to_name: row.business_name,
    subject: lead.message.subject,
    body: lead.message.body,
    evidencia: lead.message.evidencia ?? [],
    status: 'borrador',
  }

  if (untouched) {
    const { error } = await admin.from('outreach_messages').update(message).eq('id', untouched.id)
    if (error) throw error
  } else {
    const { error } = await admin.from('outreach_messages').insert(message)
    if (error) throw error
  }
  report.borradores += 1
}

// Una campaña pedida desde el Hub sigue en 'pedida' hasta que aterriza su tanda. Si no
// se cambiara aquí, seguiría saliendo en `npm run outreach:pendientes` como trabajo por
// hacer aunque ya estuviera hecho, y quien la pidió no vería que se le hizo caso.
if (report.borradores > 0) {
  const { error: statusError } = await admin
    .from('outreach_campaigns')
    .update({ status: 'abierta' })
    .eq('id', campaignId)
    .eq('status', 'pedida')
  if (statusError) throw statusError
}

console.log(`Campaña "${payload.campaign.name}" importada.`)
console.log(`  leads nuevos:        ${report.creados}`)
console.log(`  leads actualizados:  ${report.actualizados}`)
console.log(`  posibles duplicados: ${report.duplicados}`)
console.log(`  con trabajo previo:  ${report.protegidos} (no se tocó su estado)`)
console.log(`  borradores:          ${report.borradores}`)
if (report.omitidos) console.log(`  omitidos sin nombre: ${report.omitidos}`)
