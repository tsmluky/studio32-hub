// Devolver a la cola los correos que el servidor rechazó por un fallo suyo, no del correo.
//
//   npm run outreach:recuperar            enseña qué haría, sin tocar nada
//   npm run outreach:recuperar -- --aplicar   lo hace
//
// Por qué existe: cuando el SMTP falla, el mensaje pasa a 'fallido' y ahí desaparece.
// El tablero del Hub agrupa por 'borrador', 'aprobado' y 'enviado' — 'fallido' no está
// en ninguno de los tres, y el botón Aprobar solo sale en 'borrador'. Así que un corte
// del servidor se lleva por delante correos ya revisados y aprobados por una persona,
// sin dejar forma de rescatarlos desde la interfaz. Eso pasó entre el 17 y el 19 de
// septiembre de 2026: 43 correos aprobados se quedaron fuera del tablero porque
// Hostinger dejó de aceptar la contraseña.
//
// Qué NO hace, a propósito:
//   - No recupera lo que falló por culpa del propio correo (una dirección con acentos,
//     una baja). Eso volvería a fallar igual y solo sirve para castigar al dominio.
//   - No reaprueba: conserva el approved_by y el approved_at originales. Quien firmó
//     sigue siendo quien firmó, y la aprobación humana no se inventa desde un script.
//   - No envía nada. Deja el correo aprobado; sale por donde salen todos.

import { createClient } from '@supabase/supabase-js'

const WORKSPACE = 'studio32'
const aplicar = process.argv.includes('--aplicar')

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('\nFaltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env local.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Fallos del servidor, no del correo. Se amplía cuando aparezca uno nuevo que también
// merezca reintento; por defecto no se recupera nada que no esté en esta lista.
const FALLOS_DEL_SERVIDOR = [
  { patron: /535|authentication failed/i, que: 'el servidor rechazó la contraseña' },
  { patron: /timeout|connection|refused/i, que: 'no se pudo conectar con el servidor' },
]

const { data: fallidos, error } = await admin
  .from('outreach_messages')
  .select('id, to_email, subject, from_email, error, approved_by, approved_at, sent_at, lead_id')
  .eq('workspace_id', WORKSPACE)
  .eq('status', 'fallido')
  .order('approved_at', { ascending: true })

if (error) {
  console.error(`\nNo se ha podido leer la base: ${error.message}`)
  process.exit(1)
}

const recuperables = []
const seQuedan = []

for (const m of fallidos ?? []) {
  const motivo = FALLOS_DEL_SERVIDOR.find((f) => f.patron.test(m.error ?? ''))
  // Sin approved_by no hay aprobación humana detrás: eso vuelve a borrador, no a la cola.
  if (!motivo) seQuedan.push({ ...m, porque: 'el fallo es del propio correo, se repetiría' })
  else if (!m.approved_by) seQuedan.push({ ...m, porque: 'no tiene aprobación humana registrada' })
  else if (m.sent_at) seQuedan.push({ ...m, porque: 'llegó a salir: no se reenvía' })
  else recuperables.push({ ...m, porque: motivo.que })
}

console.log(`\nFallidos en la base: ${(fallidos ?? []).length}`)
console.log(`Se pueden devolver a la cola: ${recuperables.length}`)
console.log(`Se quedan fuera: ${seQuedan.length}`)

if (recuperables.length) {
  console.log('\n--- Vuelven a "aprobado" ---')
  for (const m of recuperables) {
    const cuando = m.approved_at ? new Date(m.approved_at).toLocaleDateString('es-ES') : 'sin fecha'
    console.log(`  ${m.to_email.padEnd(45)} aprobado el ${cuando} por ${m.from_email.split('<')[0].trim()}`)
  }
}

if (seQuedan.length) {
  console.log('\n--- Se quedan en fallido, y por qué ---')
  for (const m of seQuedan) console.log(`  ${m.to_email.padEnd(45)} ${m.porque}\n    (${m.error})`)
}

if (!aplicar) {
  console.log('\nEsto es solo el ensayo. Para hacerlo de verdad:')
  console.log('  npm run outreach:recuperar -- --aplicar')
  process.exit(0)
}

if (!recuperables.length) {
  console.log('\nNo hay nada que recuperar.')
  process.exit(0)
}

// De uno en uno y no en bloque: si algo va mal a medias, se ve exactamente dónde.
let hechos = 0
for (const m of recuperables) {
  const { error: errorUpdate } = await admin
    .from('outreach_messages')
    .update({ status: 'aprobado', error: '' })
    .eq('id', m.id)
    .eq('status', 'fallido')
  if (errorUpdate) console.error(`  ✗ ${m.to_email}: ${errorUpdate.message}`)
  else hechos += 1
}

console.log(`\n${hechos} correos devueltos a la cola de aprobados.`)
console.log('No ha salido ninguno: salen por el camino de siempre, con su cupo y su horario.')
