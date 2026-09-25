// El único comando de prospección que hay que recordar.
//
//   npm run outreach                  ¿qué hay pedido? y el prompt listo para pegar
//   npm run outreach -- tanda.json    sube esa tanda al Hub
//   npm run outreach -- --conocidos "zona"      qué negocios de esa zona ya tenemos
//   npm run outreach -- --cerrar <id> "motivo"  cierra una campaña agotada
//   npm run outreach -- --crear "sector" "zona" "oferta" ["notas"]  abre una campaña nueva
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
const args = process.argv.slice(2)
const cerrando = args.includes('--cerrar')
const conocidos = args.includes('--conocidos')
const creando = args.includes('--crear')
// Con `--cerrar` los sueltos son el id y el motivo, y con `--conocidos` la zona: no un
// archivo que importar.
const archivo = cerrando || conocidos || creando ? null : args.find((a) => !a.startsWith('--'))

const destino = cerrando
  ? path.join(aqui, 'cerrar-campana.mjs')
  : creando
    ? path.join(aqui, 'crear-campana.mjs')
  : conocidos
    ? path.join(aqui, 'outreach-conocidos.mjs')
    : archivo
    ? path.join(aqui, 'import-outreach.mjs')
    : path.join(aqui, 'outreach-pendientes.mjs')

const hijo = spawn(process.execPath, [destino, ...process.argv.slice(2)], {
  stdio: 'inherit',
})

hijo.on('exit', (code) => process.exit(code ?? 0))
