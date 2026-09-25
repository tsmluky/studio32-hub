// Abre una campaña nueva desde local, sin pasar por el Hub.
//
//   npm run outreach -- --crear "Clínicas dentales" "Córdoba capital" "Agente de IA en WhatsApp..." ["notas"]
//
// Existe para que `/prospectar` no se quede sin trabajo: si las campañas pedidas no dan
// para llenar una pasada, abre otras en ciudades sin tocar. Queda marcada en `notas`
// para que en el Hub se vea que no la pidió una persona.

import { createClient } from '@supabase/supabase-js'

const WORKSPACE = 'studio32'
const args = process.argv.slice(2)
const i = args.indexOf('--crear')
const [sector, city, oferta, notasExtra] = args.slice(i + 1)

if (!sector || !city || !oferta) {
  console.error('Uso: npm run outreach -- --crear "sector" "zona" "oferta" ["notas"]')
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env local.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const name = `${sector} · ${city}`

const { data: existentes, error: errorLectura } = await admin
  .from('outreach_campaigns')
  .select('id, name, status')
  .eq('workspace_id', WORKSPACE)
  .ilike('name', name)

if (errorLectura) {
  console.error(`No se ha podido comprobar si ya existe: ${errorLectura.message}`)
  process.exit(1)
}
if (existentes.length) {
  const e = existentes[0]
  console.error(`Ya hay una campaña "${e.name}" (${e.status}, id ${e.id}). Usa esa o elige otra zona.`)
  process.exit(1)
}

const notas = ['Creada por /prospectar para no quedarse sin trabajo.', notasExtra].filter(Boolean).join('\n')

const { data, error } = await admin
  .from('outreach_campaigns')
  .insert({ workspace_id: WORKSPACE, name, sector, city, oferta, cantidad: 50, notas, status: 'pedida' })
  .select('id')
  .single()

if (error) {
  console.error(`No se ha podido crear: ${error.message}`)
  process.exit(1)
}

console.log(`Creada "${name}".`)
console.log(`id: ${data.id}`)
