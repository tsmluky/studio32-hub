// Qué campañas hay encargadas desde el Hub y sin generar.
//
// Uso:
//   npm run outreach:pendientes
//
// Es el puente entre el Hub y esta máquina. El Hub no puede ejecutar la skill —es
// un sitio estático y no alcanza este portátil—, así que deja el encargo puesto en
// Supabase y esto lo recoge.
//
// Imprime, por cada pedido, el prompt exacto para pegar en Claude Code. Se genera
// aquí y no a mano para que el trabajo diario sea: abrir Claude, pegar, revisar,
// importar. Sin recordar el nombre de la skill ni el formato de salida.
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

const { data: campanas, error } = await admin
  .from('outreach_campaigns')
  .select('id, name, sector, city, oferta, cantidad, notas, created_at')
  .eq('workspace_id', WORKSPACE)
  .eq('status', 'pedida')
  .order('created_at', { ascending: true })

if (error) {
  console.error(`No se ha podido leer la cola: ${error.message}`)
  process.exit(1)
}

if (!campanas.length) {
  console.log('\nNo hay campañas encargadas. Se piden desde el Hub: Herramientas → Prospección → Pedir campaña.')
  process.exit(0)
}

console.log(`\n${campanas.length} campaña(s) encargada(s):\n`)

for (const [i, c] of campanas.entries()) {
  const pedidoEl = new Date(c.created_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })

  console.log(`${'─'.repeat(72)}`)
  console.log(`${i + 1}. ${c.name}`)
  console.log(`   pedida el ${pedidoEl} · ${c.cantidad} leads`)
  if (c.oferta) console.log(`   oferta: ${c.oferta}`)
  if (c.notas) console.log(`   notas:  ${c.notas}`)
  console.log()
  console.log('   Pega esto en Claude Code:')
  console.log()
  console.log(`   Genera una tanda de prospección para el Hub.`)
  console.log(`   Campaña: ${c.id}`)
  console.log(`   Sector: ${c.sector}. Zona: ${c.city}. Cantidad: ${c.cantidad}.`)
  if (c.oferta) console.log(`   Oferta: ${c.oferta}`)
  if (c.notas) console.log(`   A tener en cuenta: ${c.notas}`)
  console.log()
}

console.log(`${'─'.repeat(72)}`)
console.log('\nCuando la skill termine, súbelo con:')
console.log('  npm run outreach:import -- <archivo.json>')
console.log('\nEl importador revisa sin escribir. Añade --confirmar para subir de verdad.')
