// Comprobar correos antes de subirlos, y sacar los que una web esconde (17/10/2026).
//
//   npm run outreach -- --verificar tanda.json          cada lead de la tanda
//   npm run outreach -- --verificar info@x.es citas@y.es
//   npm run outreach -- --verificar tanda.json --sin-smtp   solo DNS (sin puerto 25)
//   npm run outreach -- --correos https://clinica.es     correos de su web, también
//                                                        los ocultos por Cloudflare
//
// No escribe nada en ningún sitio. El importador ya aplica por su cuenta la parte de
// DNS (un dominio sin correo no recibe borrador); esto sirve para mirarlo antes y para
// la prueba SMTP, que necesita el puerto 25 y no siempre está disponible.

import { readFile } from 'node:fs/promises'
import { extraerCorreos, verificarCorreo } from './correo-verificacion.mjs'

const args = process.argv.slice(2).filter((a) => !['--verificar', '--correos'].includes(a))
const modoCorreos = process.argv.includes('--correos')
const smtp = !args.includes('--sin-smtp')
const sueltos = args.filter((a) => !a.startsWith('--'))

if (!sueltos.length) {
  console.log('Uso: npm run outreach -- --verificar <tanda.json | correo...> [--sin-smtp]')
  console.log('     npm run outreach -- --correos <url...>')
  process.exit(1)
}

if (modoCorreos) {
  // Donde los negocios suelen dejar el correo cuando no está en la portada. El aviso
  // legal es el que más salva (docs/PROSPECCION.md): la LSSI obliga a publicarlo ahí.
  const SUBPAGINAS = ['', 'contacto', 'contact', 'aviso-legal', 'politica-de-privacidad', 'privacidad', 'legal']
  for (const web of sueltos) {
    const base = new URL(web.startsWith('http') ? web : `https://${web}`)
    const todos = new Map()
    for (const sub of SUBPAGINAS) {
      const url = new URL(sub, `${base.origin}/`).href
      try {
        const respuesta = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!respuesta.ok) continue
        for (const email of extraerCorreos(await respuesta.text())) if (!todos.has(email)) todos.set(email, url)
      } catch {
        // Una subpágina que no existe o no carga no es un error: se prueba la siguiente.
      }
    }
    console.log(`${base.origin}`)
    if (!todos.size) console.log('  sin correos en portada, contacto, aviso legal ni privacidad')
    for (const [email, url] of todos) console.log(`  ${email}   (${url})`)
  }
  process.exit(0)
}

// Una tanda JSON o direcciones sueltas.
let objetivos = []
for (const suelto of sueltos) {
  if (suelto.endsWith('.json')) {
    const tanda = JSON.parse(await readFile(suelto, 'utf8'))
    for (const lead of tanda.leads ?? []) if (lead.email) objetivos.push({ nombre: lead.business_name, email: lead.email })
  } else {
    objetivos.push({ nombre: '', email: suelto })
  }
}

const SIMBOLO = { ok: '✓', dudoso: '?', descartar: '✗' }
const cuenta = { ok: 0, dudoso: 0, descartar: 0 }
for (const { nombre, email } of objetivos) {
  const r = await verificarCorreo(email, { smtp })
  cuenta[r.veredicto] += 1
  console.log(`${SIMBOLO[r.veredicto]} ${r.email}${nombre ? `  · ${nombre}` : ''}\n    ${r.motivo}`)
}
console.log(`\n${cuenta.ok} bien, ${cuenta.dudoso} sin confirmar, ${cuenta.descartar} para descartar.`)
if (cuenta.descartar) console.log('Los ✗ rebotarían: quítalos de la tanda o busca otra dirección publicada.')
