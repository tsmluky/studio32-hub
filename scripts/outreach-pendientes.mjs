// La cola de trabajo de prospección: qué campañas tienen leads por generar.
//
// Uso:
//   npm run outreach
//
// Es el puente entre el Hub y esta máquina. El Hub no puede ejecutar la skill —es
// un sitio estático y no alcanza este portátil—, así que deja el encargo puesto en
// Supabase y esto lo recoge. `/prospectar` lo lee él mismo para elegir campañas.
//
// Hasta el 14/09 solo listaba las campañas en 'pedida'. Pero una campaña pasa a
// 'abierta' en cuanto aterriza su primera tanda, aunque pidiera 20 y lleve 3, así que
// en cuanto se servía una vez desaparecía de la cola: había 16 abiertas con trabajo
// pendiente que nadie veía. Ahora sale todo lo que tiene hueco, con lo que falta.
//
// La generación corre con la suscripción de Claude Code, no por API: es la razón de
// que este paso sea local y no un worker en la nube, que facturaría por token.

import { createClient } from '@supabase/supabase-js'

const WORKSPACE = 'studio32'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env local.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const [{ data: campanas, error }, { data: leads, error: leadsError }, { data: mensajes, error: mensajesError }] = await Promise.all([
  admin
    .from('outreach_campaigns')
    .select('id, name, status, sector, city, oferta, cantidad, notas, created_at')
    .eq('workspace_id', WORKSPACE)
    .in('status', ['pedida', 'abierta'])
    .order('created_at', { ascending: true }),
  admin.from('outreach_leads').select('campaign_id').eq('workspace_id', WORKSPACE),
  admin.from('outreach_messages').select('status').eq('workspace_id', WORKSPACE).in('status', ['borrador', 'aprobado']),
])

if (error || leadsError || mensajesError) {
  console.error(`No se ha podido leer la cola: ${(error ?? leadsError ?? mensajesError).message}`)
  process.exit(1)
}

const generados = new Map()
for (const lead of leads) generados.set(lead.campaign_id, (generados.get(lead.campaign_id) ?? 0) + 1)

const porRevisar = mensajes.filter((m) => m.status === 'borrador').length
const aprobados = mensajes.filter((m) => m.status === 'aprobado').length

console.log(`\nBandeja: ${porRevisar} por revisar · ${aprobados} aprobados esperando envío.`)

const conHueco = campanas
  .filter((c) => !/^prueba\b/i.test(c.name.trim()))
  .map((c) => ({ ...c, llevan: generados.get(c.id) ?? 0 }))
  .map((c) => ({ ...c, faltan: Math.max(0, c.cantidad - c.llevan) }))
  .filter((c) => c.faltan > 0)

if (!conHueco.length) {
  console.log('\nNo hay campañas con leads por generar. Se piden desde el Hub: Herramientas → Prospección → Pedir campaña.')
  process.exit(0)
}

console.log(`\n${conHueco.length} campaña(s) con leads por generar:\n`)

for (const [i, c] of conHueco.entries()) {
  const pedidaEl = new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  console.log(`${'─'.repeat(72)}`)
  console.log(`${i + 1}. ${c.name}`)
  console.log(`   id: ${c.id}`)
  console.log(`   ${c.status} · pedida el ${pedidaEl} · llevan ${c.llevan} de ${c.cantidad}, faltan ${c.faltan}`)
  console.log(`   sector: ${c.sector} · zona: ${c.city}`)
  if (c.oferta) console.log(`   oferta: ${c.oferta}`)
  if (c.notas) console.log(`   notas:  ${c.notas}`)
}

console.log(`${'─'.repeat(72)}`)
console.log('\nPara generar: /prospectar en Claude Code (lee esta cola él mismo).')
console.log('Para subir un JSON suelto: npm run outreach -- <archivo.json>')
