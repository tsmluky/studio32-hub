// Pasa la revisión automática a la cola sin enviar nada.
//
//   npm run outreach:revisar            borradores y aprobados
//   npm run outreach:revisar -- todos   también los enviados (sirve para calibrar reglas)
//
// Las reglas son las mismas que aplica `outreach-send` antes de enviar: se importan del
// mismo archivo y se normaliza la tipografía igual que al enviar, así que lo que diga este
// script es lo que pasaría al enviar.

import { createClient } from '@supabase/supabase-js'
import { normalizarTipografia, revisarCorreo, revisarEstilo } from '../supabase/functions/_shared/reglas-correo.js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env.')
  process.exit(1)
}

const estados = process.argv.includes('todos') ? ['borrador', 'aprobado', 'enviado'] : ['borrador', 'aprobado']
const supabase = createClient(url, key)
const { data, error } = await supabase
  .from('outreach_messages')
  .select('id, status, subject, body, to_email, outreach_leads(business_name)')
  .eq('workspace_id', 'studio32')
  .in('status', estados)
if (error) throw error

const cuenta = {}
const avisosPorRegla = {}
let conProblemas = 0
for (const m of data) {
  const correo = { subject: normalizarTipografia(m.subject), body: normalizarTipografia(m.body), to_email: m.to_email }
  const problemas = revisarCorreo(correo)
  // Los avisos de estilo (pauta del 02/10) no paran el envío: se cuentan aparte, y por regla,
  // para ver cuáles dan falsos positivos antes de subirlas a puerta.
  const avisos = revisarEstilo(correo)
  cuenta[m.status] ??= { pasan: 0, no_pasan: 0, fuera_de_pauta: 0 }
  cuenta[m.status][problemas.length ? 'no_pasan' : 'pasan'] += 1
  if (avisos.length) cuenta[m.status].fuera_de_pauta += 1
  for (const a of avisos) avisosPorRegla[a] = (avisosPorRegla[a] ?? 0) + 1
  if (!problemas.length) continue
  conProblemas += 1
  console.log(`\n✗ [${m.status}] ${m.outreach_leads?.business_name ?? m.id}`)
  for (const p of problemas) console.log(`   - ${p}`)
}

console.log('\nResumen:')
console.table(cuenta)
const reglas = Object.entries(avisosPorRegla).sort((a, b) => b[1] - a[1])
if (reglas.length) {
  console.log('\nFuera de la pauta de estilo (avisos, no paran el envío), por regla:')
  for (const [aviso, n] of reglas) console.log(`  ${String(n).padStart(4)}  ${aviso}`)
}
process.exitCode = conProblemas ? 1 : 0
