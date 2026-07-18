import { createHash, randomInt } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.')
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const members = [
  { id: 'juanma', name: 'Juanma', email: 'juanma@studio32.es', env: 'JUANMA_PIN' },
  { id: 'pancho', name: 'Pancho', email: 'pancho@studio32.es', env: 'PANCHO_PIN' },
  { id: 'gonzalo', name: 'Gonzalo', email: 'gonzalo@studio32.es', env: 'GONZALO_PIN' },
]

function generatePin() {
  return String(randomInt(100000, 1000000))
}

function pinToPassword(memberId, pin) {
  const hash = createHash('sha256').update(`studio32-hub:${memberId}:${pin}:v1`).digest('hex')
  return `S32!${hash}`
}

const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ perPage: 1000 })
if (usersError) throw usersError

const credentials = []

for (const member of members) {
  const pin = process.env[member.env] || generatePin()
  const password = pinToPassword(member.id, pin)
  let user = usersData.users.find((candidate) => candidate.email?.toLowerCase() === member.email)

  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { member_id: member.id, name: member.name },
    })
    if (error) throw error
    user = data.user
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: member.email,
      password,
      email_confirm: true,
      user_metadata: { member_id: member.id, name: member.name },
    })
    if (error) throw error
    user = data.user
  }

  const { error: membershipError } = await admin.from('workspace_members').upsert({
    workspace_id: 'studio32',
    user_id: user.id,
    member_id: member.id,
    email: member.email,
    name: member.name,
  })
  if (membershipError) throw membershipError

  credentials.push(`${member.name}: ${pin}`)
}

await writeFile('.studio32-initial-pins.local', `${credentials.join('\n')}\n`, 'utf8')
console.log('Usuarios preparados. PINes guardados en .studio32-initial-pins.local')
