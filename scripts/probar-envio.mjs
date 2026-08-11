// Prueba de fuego del envío, antes de escribir a un negocio real.
//
//   npm run outreach:probar          siembra el lead de prueba
//   npm run outreach:probar -- --ver comprueba en qué quedó
//
// Siembra un lead ficticio cuyo destinatario es el propio buzón de Studio32, con el
// correo ya aprobado y firmado por el alias de Juanma. Después se pulsa Enviar en el
// Hub y se vuelve a ejecutar con --ver.
//
// El disparo NO lo hace este script a propósito: la función exige una sesión de
// miembro real y rechaza la clave de servicio. Eso es correcto —ningún correo debe
// poder salir sin que haya una persona autenticada detrás— y significa que la única
// forma de probarlo de verdad es por el mismo camino que usará el equipo.
//
// Resuelve dos incógnitas de una vez:
//   1. Que Deno deje salir el puerto 465.
//   2. Que Hostinger acepte un alias en From: autenticándose como info@.

import { createClient } from '@supabase/supabase-js'

const WORKSPACE = 'studio32'
const NOMBRE_PRUEBA = 'PRUEBA · No es un negocio real'
const REMITENTE = 'Juanma · Studio32 <juanma@studio32.es>'

const args = process.argv.slice(2)
const soloVer = args.includes('--ver')

// Mejor a una direccion de fuera del dominio que al propio info@: probar contra el
// mismo buzon que autentica el SMTP no demuestra entregabilidad, y ademas el
// servidor puede entregarlo por atajo interno sin pasar por las mismas
// comprobaciones. Desde fuera se ve lo que vera un prospecto de verdad.
const iDestino = args.indexOf('--para')
const DESTINO = iDestino !== -1 && args[iDestino + 1] ? args[iDestino + 1] : 'info@studio32.es'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('\nFaltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env local.')
  console.error('Supabase -> Project Settings -> API. La service_role, no la anon.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function estado() {
  const { data, error } = await admin
    .from('outreach_messages')
    .select('id, from_email, to_email, status, error, sent_at, provider, outreach_leads!inner(business_name)')
    .eq('workspace_id', WORKSPACE)
    .eq('outreach_leads.business_name', NOMBRE_PRUEBA)
  if (error) throw new Error(error.message)
  return data ?? []
}

if (soloVer) {
  const filas = await estado()
  if (!filas.length) {
    console.log('\nNo hay ningún mensaje de prueba. Ejecuta primero sin --ver.')
    process.exit(0)
  }
  for (const m of filas) {
    console.log(`\nEstado: ${m.status}`)
    console.log(`De:     ${m.from_email}`)
    console.log(`Para:   ${m.to_email}`)
    if (m.provider) console.log(`Vía:    ${m.provider}`)
    if (m.sent_at) console.log(`Salió:  ${new Date(m.sent_at).toLocaleString('es-ES')}`)
    if (m.error) console.log(`Error:  ${m.error}`)

    if (m.status === 'enviado') {
      console.log(`\nEl SMTP funciona. Ahora mira la bandeja de ${m.to_email}:`)
      console.log('  - Si el remitente es juanma@studio32.es, el alias se acepta y está todo listo.')
      console.log('  - Si aparece como info@, hay que enviar todo desde info@ con el nombre visible.')
    } else if (m.status === 'fallido') {
      console.log('\nNo ha salido. El texto de arriba dice por qué.')
      console.log('  - "connection"/"refused"/"timeout" -> Deno no deja salir el 465.')
      console.log('  - "authentication"/"535"           -> usuario o contraseña del SMTP.')
      console.log('  - "sender"/"550"/"not allowed"     -> Hostinger rechaza el alias en From.')
    } else if (m.status === 'aprobado') {
      console.log('\nSigue aprobado y sin enviar: todavía no se ha pulsado Enviar en el Hub.')
    }
  }
  process.exit(0)
}

// ── Sembrado ──
// Se limpia lo anterior para poder repetir la prueba las veces que haga falta.
const { data: previos } = await admin
  .from('outreach_leads')
  .select('id')
  .eq('workspace_id', WORKSPACE)
  .eq('business_name', NOMBRE_PRUEBA)

for (const p of previos ?? []) {
  await admin.from('outreach_messages').delete().eq('lead_id', p.id)
  await admin.from('outreach_leads').delete().eq('id', p.id)
}

// La ventana de cortesía de 60 días bloquearía la segunda prueba al mismo buzón:
// se borra el rastro de envíos anteriores a esta dirección para poder repetir.
await admin.from('outreach_messages').delete().eq('workspace_id', WORKSPACE).eq('to_email', DESTINO)

const { data: miembro, error: errorMiembro } = await admin
  .from('workspace_members')
  .select('user_id, member_id')
  .eq('workspace_id', WORKSPACE)
  .limit(1)
  .maybeSingle()

if (errorMiembro || !miembro) {
  console.error('\nNo hay miembros en el workspace: la función exige un approved_by real.')
  process.exit(1)
}

const { data: lead, error: errorLead } = await admin
  .from('outreach_leads')
  .insert({
    workspace_id: WORKSPACE,
    business_name: NOMBRE_PRUEBA,
    sector: 'Prueba',
    city: 'Alcalá de Henares',
    // Sin web: así no choca con el índice único de dominio al repetir la prueba.
    website: '',
    email: DESTINO,
    score: 50,
    digital_level: 'medio',
    status: 'nuevo',
    source: 'prueba',
    notes: 'Lead de prueba del envío. Se puede borrar sin pensarlo.',
  })
  .select('id')
  .single()

if (errorLead) {
  console.error(`\nNo se ha podido crear el lead de prueba: ${errorLead.message}`)
  process.exit(1)
}

const { error: errorMensaje } = await admin.from('outreach_messages').insert({
  workspace_id: WORKSPACE,
  lead_id: lead.id,
  from_email: REMITENTE,
  reply_to: 'juanma@studio32.es',
  to_email: DESTINO,
  to_name: 'Studio32',
  subject: 'Prueba de envío desde el Hub',
  body:
    'Esto es una prueba del envío de prospección.\n\n' +
    'Si ha llegado y en el remitente aparece juanma@studio32.es, ' +
    'la cadena funciona: la función conecta con el SMTP de Hostinger y el alias se acepta.\n\n' +
    'Comprueba también que traiga el pie de baja.',
  status: 'aprobado',
  approved_by: miembro.user_id,
  approved_at: new Date().toISOString(),
  evidencia: [],
})

if (errorMensaje) {
  console.error(`\nNo se ha podido crear el mensaje: ${errorMensaje.message}`)
  process.exit(1)
}

console.log('\nLead de prueba sembrado y aprobado.')
console.log(`  De:   ${REMITENTE}`)
console.log(`  Para: ${DESTINO}`)
console.log('\nAhora, en el Hub: Herramientas -> Prospección -> Aprobados -> Enviar.')
console.log('Después, para ver en qué quedó:')
console.log('  npm run outreach:probar -- --ver')
