// Aplica las migraciones de `supabase/migrations/` en orden de nombre.
//
// En este repo las migraciones no se aplicaban solas: `supabase:bootstrap` solo crea
// usuarios y membresías, y el SQL había que pegarlo a mano en el editor de Supabase.
// Esto lo automatiza sin depender de la CLI de Supabase.
//
// Uso:
//   npm run supabase:migrate            -> aplica todas
//   npm run supabase:migrate -- 2026    -> solo las que contengan "2026" en el nombre
//
// Todas las migraciones del repo están escritas para ser idempotentes
// (`if not exists`, `create or replace`, `drop ... if exists`), así que volver a
// ejecutarlas no rompe nada. Cada archivo va en su propia transacción: si uno falla,
// se revierte entero y los anteriores se quedan aplicados.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(root, 'supabase', 'migrations')

const connectionString = process.env.SUPABASE_DB_URL

if (!connectionString) {
  console.error(`
Falta SUPABASE_DB_URL.

Ponla en el archivo .env de este repo (está en .gitignore, no se sube):

  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres

Se saca del panel de Supabase, en Project Settings -> Database -> Connection string.
Usa la de "Session pooler" o la conexión directa (puerto 5432). La de puerto 6543
es de modo transacción y no lleva bien las sentencias DDL.
`)
  process.exit(1)
}

const filtro = process.argv[2]

const archivos = (await readdir(migrationsDir))
  .filter((nombre) => nombre.endsWith('.sql'))
  .filter((nombre) => !filtro || nombre.includes(filtro))
  .sort()

if (archivos.length === 0) {
  console.error(filtro ? `Ninguna migración coincide con "${filtro}".` : 'No hay migraciones.')
  process.exit(1)
}

// Supabase exige TLS. No se verifica la cadena porque los certificados del pooler no
// están en el almacén de Node por defecto; el destino es un host conocido y fijo que
// viene de la cadena de conexión, no de una entrada externa.
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

// Nunca imprimir la cadena de conexión: lleva la contraseña dentro.
function mensajeLimpio(error) {
  return String(error?.message ?? error).replaceAll(connectionString, '<SUPABASE_DB_URL>')
}

try {
  await client.connect()
} catch (error) {
  console.error(`No se pudo conectar a la base de datos: ${mensajeLimpio(error)}`)
  process.exit(1)
}

console.log(`Aplicando ${archivos.length} migración(es)...\n`)

let fallos = 0

for (const nombre of archivos) {
  const sql = await readFile(path.join(migrationsDir, nombre), 'utf8')
  try {
    await client.query('begin')
    await client.query(sql)
    await client.query('commit')
    console.log(`  OK   ${nombre}`)
  } catch (error) {
    await client.query('rollback').catch(() => {})
    fallos += 1
    console.error(`  FALLO ${nombre}`)
    console.error(`        ${mensajeLimpio(error)}`)
  }
}

await client.end()

console.log(fallos === 0 ? '\nTodas aplicadas.' : `\n${fallos} migración(es) con error. Nada de esas se aplicó.`)
process.exit(fallos === 0 ? 0 : 1)
