// Cierra una campaña que no va a dar más, con su motivo.
//
//   npm run outreach -- --cerrar <id> "no publican correo, van por Instagram"
//
// Existe porque una campaña pedida se quedaba en la cola para siempre si no daba
// leads. Cada vez que alguien miraba qué había pendiente, volvía a salir, y quien la
// pidió nunca llegaba a saber por qué no había pasado nada.
//
// El motivo se guarda en `notas` y no se pierde: es lo que dice si el sector o la zona
// eran buen criterio, que vale para la siguiente.

import { createClient } from '@supabase/supabase-js'

const WORKSPACE = 'studio32'
const args = process.argv.slice(2)
const i = args.indexOf('--cerrar')
const id = args[i + 1]
const motivo = args[i + 2]

if (!id || id.startsWith('--')) {
  console.error('Uso: npm run outreach -- --cerrar <id-campaña> "motivo"')
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

const { data: campana, error: errorLectura } = await admin
  .from('outreach_campaigns')
  .select('id, name, status, notas')
  .eq('workspace_id', WORKSPACE)
  .eq('id', id)
  .maybeSingle()

if (errorLectura || !campana) {
  console.error(`No hay ninguna campaña con ese id. (${errorLectura?.message ?? 'no encontrada'})`)
  process.exit(1)
}

if (campana.status === 'cerrada') {
  console.log(`"${campana.name}" ya estaba cerrada.`)
  process.exit(0)
}

// El motivo se añade a las notas en vez de pisarlas: lo que pidió quien la encargó
// sigue siendo parte de la historia de la campaña.
const notas = [campana.notas, motivo ? `Cerrada: ${motivo}` : 'Cerrada sin motivo indicado.']
  .filter(Boolean)
  .join('\n')

const { error } = await admin
  .from('outreach_campaigns')
  .update({ status: 'cerrada', notas })
  .eq('id', campana.id)

if (error) {
  console.error(`No se ha podido cerrar: ${error.message}`)
  process.exit(1)
}

console.log(`Cerrada "${campana.name}".`)
if (motivo) console.log(`Motivo: ${motivo}`)
console.log('Ya no aparecerá en la cola de pendientes.')
