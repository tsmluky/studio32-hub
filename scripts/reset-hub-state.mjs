import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.')
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const cleanState = {
  selectedProjectId: 'studio32',
  projects: [
    {
      id: 'studio32',
      name: 'Studio32 Hub',
      client: 'Proyecto interno',
      area: 'studio32',
      status: 'Activo',
      focus: 'Construir y mejorar el espacio de trabajo del estudio.',
      nextMilestone: 'Primera semana de uso real',
      accent: '#2f6f73',
      topics: [],
    },
  ],
  tasks: [],
  updates: [],
  resources: [],
  inbox: [],
  boardItems: [],
  teamCheckIns: [],
  agendaEvents: [],
}

const { error } = await admin.from('hub_states').upsert({
  workspace_id: 'studio32',
  payload: cleanState,
})

if (error) throw error
console.log('Estado compartido reiniciado sin datos de ejemplo.')
