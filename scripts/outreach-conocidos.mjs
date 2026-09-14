// Qué negocios de una zona ya están en la base, para no investigarlos otra vez.
//
// Uso:
//   npm run outreach -- --conocidos "valencia"
//
// Con varias campañas generándose a la vez, lo caro no es subir un duplicado —el
// importador lo detecta por dominio y no pisa el trabajo hecho— sino los 5 minutos de
// investigarlo antes de descubrirlo. Esto se mira en la criba, antes de cargar webs.
//
// Imprime datos de negocios reales: es para la terminal, nunca para el repo.

import { createClient } from '@supabase/supabase-js'

const zona = process.argv.slice(2).filter((a) => !a.startsWith('--')).join(' ').trim()
if (!zona) {
  console.error('Indica la zona: npm run outreach -- --conocidos "valencia"')
  process.exit(1)
}

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const [{ data: leads, error }, { data: bajas }] = await Promise.all([
  admin
    .from('outreach_leads')
    .select('business_name, domain, email, status, sector, city')
    .eq('workspace_id', 'studio32')
    .ilike('city', `%${zona}%`)
    .order('business_name'),
  admin.from('outreach_suppressions').select('email').eq('workspace_id', 'studio32'),
])

if (error) {
  console.error(`No se ha podido leer la base: ${error.message}`)
  process.exit(1)
}

const dadosDeBaja = new Set((bajas ?? []).map((b) => b.email.toLowerCase()))

console.log(`\n${leads.length} negocio(s) ya en la base con zona que contiene "${zona}". No los investigues:\n`)
for (const lead of leads) {
  const baja = lead.email && dadosDeBaja.has(lead.email.toLowerCase()) ? ' · BAJA' : ''
  console.log(`  - ${lead.business_name} · ${lead.domain || 'sin web'} · ${lead.status} · ${lead.sector}${baja}`)
}
if (dadosDeBaja.size) console.log(`\n(${dadosDeBaja.size} dirección(es) en la lista de bajas en total: el importador las respeta.)`)
