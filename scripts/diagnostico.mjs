// Pinta el diagnóstico de cada lead de una tanda como imagen (17/10/2026).
//
//   npm run outreach -- --diagnostico tanda.json
//   npm run outreach -- --diagnostico tanda.json --salida <carpeta>
//
// Deja un JPG por lead en `<carpeta de la tanda>/diagnosticos/`. Esa carpeta queda
// fuera del repo a propósito: lleva datos de negocios reales y el repositorio es
// público (como el JSON de la tanda, que /prospectar escribe en la carpeta temporal).
//
// Aún no se sube a ningún sitio ni viaja en el correo: eso es el paso siguiente de
// docs/DIAGNOSTICO.md (Storage + outreach-send con imagen incrustada). Hoy sirve para
// ver cómo queda y para llevarlo impreso.
//
// El navegador: el Chrome o el Edge que ya tenga la máquina (Edge viene con Windows),
// así no hay que descargar nada. PLAYWRIGHT_CHROMIUM fuerza otro ejecutable.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { diagnosticoDeLead, htmlDiagnostico, revisarDiagnostico } from '../supabase/functions/_shared/diagnostico.js'

// El correo enseña la imagen a 600 px; se pinta al doble para que se lea bien en
// pantallas de móvil. Por encima de 150 KB empieza a pesar en el correo frío.
const ANCHO = 600
const ESCALA = 2
const MAX_BYTES = 150 * 1024

const args = process.argv.slice(2).filter((a) => a !== '--diagnostico')
const tandaRuta = args.find((a) => a.endsWith('.json'))
if (!tandaRuta) {
  console.log('Uso: npm run outreach -- --diagnostico <tanda.json> [--salida <carpeta>]')
  process.exit(1)
}
const iSalida = args.indexOf('--salida')
const salida = iSalida >= 0 && args[iSalida + 1] ? args[iSalida + 1] : path.join(path.dirname(tandaRuta), 'diagnosticos')

function nombreArchivo(negocio) {
  return String(negocio).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'negocio'
}

async function abrirNavegador() {
  const forzado = process.env.PLAYWRIGHT_CHROMIUM
  if (forzado) return chromium.launch({ executablePath: forzado })
  const intentos = [{ channel: 'chrome' }, { channel: 'msedge' }, { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }]
  for (const opciones of intentos) {
    try {
      return await chromium.launch(opciones)
    } catch {
      // Se prueba el siguiente.
    }
  }
  throw new Error('No hay Chrome ni Edge en esta máquina. Pon la ruta de uno en PLAYWRIGHT_CHROMIUM.')
}

const tanda = JSON.parse(await readFile(tandaRuta, 'utf8'))
await mkdir(salida, { recursive: true })
const navegador = await abrirNavegador()
const pagina = await navegador.newPage({ viewport: { width: ANCHO, height: 800 }, deviceScaleFactor: ESCALA })

const resumen = { hechos: 0, sin: [] }
for (const lead of tanda.leads ?? []) {
  const hallazgos = diagnosticoDeLead(lead)
  const problemas = revisarDiagnostico(hallazgos)
  if (problemas.length) {
    resumen.sin.push(`${lead.business_name}: ${problemas.join(' ')}`)
    continue
  }

  const html = htmlDiagnostico({ negocio: lead.business_name, ciudad: lead.city ?? tanda.campaign?.city ?? '', hallazgos })
  // Las fuentes vienen de Google Fonts; sin red, se pinta con las del sistema.
  await pagina.setContent(html, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => pagina.setContent(html))
  await pagina.evaluate(() => document.fonts.ready)
  const hoja = pagina.locator('.hoja')

  // Se baja la calidad hasta que quepa en el tope. Un diagnóstico normal cabe a la primera.
  const destino = path.join(salida, `${nombreArchivo(lead.business_name)}.jpg`)
  let calidad = 85
  let imagen = await hoja.screenshot({ type: 'jpeg', quality: calidad })
  while (imagen.length > MAX_BYTES && calidad > 50) {
    calidad -= 10
    imagen = await hoja.screenshot({ type: 'jpeg', quality: calidad })
  }
  await writeFile(destino, imagen)
  const kb = Math.round((await stat(destino)).size / 1024)
  console.log(`✓ ${lead.business_name}: ${destino} (${kb} KB, ${hallazgos.length} hallazgos)`)
  resumen.hechos += 1
}

await navegador.close()
console.log(`\n${resumen.hechos} diagnósticos en ${salida}.`)
if (resumen.sin.length) {
  console.log('Sin diagnóstico (no se manda imagen vacía ni una que no se pueda defender):')
  for (const item of resumen.sin) console.log(`  - ${item}`)
}
