// El único comando de prospección que hay que recordar.
//
//   npm run outreach                  ¿qué hay pedido? y el prompt listo para pegar
//   npm run outreach -- tanda.json    sube esa tanda al Hub
//
// Antes esto eran dos scripts con nombres distintos, y el paso de en medio quedaba
// difuso: "pido campaña en el Hub, toco scripts raros en local, aparecen los correos".
// Un comando con dos usos evidentes elimina esa mitad opaca: se ejecuta lo mismo al
// principio y al final, y él te dice en qué punto estás.
//
// Sigue delegando en los dos scripts de siempre, que hacen el trabajo de verdad.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const archivo = process.argv.slice(2).find((a) => !a.startsWith('--'))

const destino = archivo
  ? path.join(aqui, 'import-outreach.mjs')
  : path.join(aqui, 'outreach-pendientes.mjs')

const hijo = spawn(process.execPath, [destino, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

hijo.on('exit', (code) => process.exit(code ?? 0))
