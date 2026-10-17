// Comprobar una dirección antes de escribirle (17/10/2026).
//
// Las tres piezas baratas de lo que hacen Hunter, Apollo y compañía (ver
// docs/DIAGNOSTICO.md → "Cómo funcionan las herramientas de leads"):
//
//   1. DNS: que el dominio exista y tenga dónde recibir correo (MX). Habría parado los
//      dos dominios muertos de estética Valencia, que un buscador daba por buenos.
//   2. SMTP sin enviar: se habla con el servidor de correo del dominio hasta RCPT TO y
//      se cuelga antes de DATA. El servidor dice si la dirección existe sin que salga
//      nada. Un rebote es lo que más daña la reputación de studio32.es, y esto los
//      evita antes de que pasen.
//   3. Cloudflare: el correo que la web enseña a una persona pero esconde en el HTML
//      (`data-cfemail`). Costó dos leads en estética Valencia.
//
// Lo que NO se hace, a propósito: adivinar direcciones por patrón (nombre@, n.apellido@).
// Escribir a una dirección que el negocio no ha publicado es peor de cara a la LSSI que
// no escribir.
//
// Sin dependencias: node:dns y node:net.

import { promises as dns } from 'node:dns'
import net from 'node:net'

const PUERTO_SMTP = 25
const ESPERA_MS = 8000
// Con lo que se presenta al servidor ajeno. Tiene que ser un dominio real con MX:
// muchos servidores rechazan un MAIL FROM de un dominio que no recibe correo.
const HELO = 'studio32.es'
const REMITENTE_PRUEBA = 'info@studio32.es'

export function dominioDe(email) {
  return String(email).trim().toLowerCase().split('@')[1] ?? ''
}

// --- 1. DNS -----------------------------------------------------------------------

// Sin DNS que funcione, cada consulta vuelve ENOTFOUND, y eso se leería como "el dominio
// no existe": se descartarían leads buenos por un fallo de red. Antes de juzgar ningún
// dominio se pregunta por uno que existe seguro; si ese tampoco resuelve, el DNS no
// está disponible y nada se descarta por DNS.
let dnsDisponible
function comprobarDnsDisponible() {
  dnsDisponible ??= dns.resolveMx('gmail.com').then((r) => r.length > 0, () => false)
  return dnsDisponible
}

// estado: 'ok' | 'sin_mx' (no hay MX pero el dominio resuelve: según la RFC 5321 se
// entrega al A, y algunos servidores pequeños viven así) | 'no_existe' | 'sin_dns'
// (la consulta falló por red: no es un veredicto).
export async function comprobarDominio(email) {
  const dominio = dominioDe(email)
  if (!dominio) return { dominio, estado: 'no_existe', mx: [] }
  if (!(await comprobarDnsDisponible())) return { dominio, estado: 'sin_dns', mx: [], detalle: 'el DNS no responde ni para gmail.com' }
  try {
    const registros = await dns.resolveMx(dominio)
    // Un MX "." (RFC 7505) es el dominio diciendo que no acepta correo.
    const mx = registros
      .filter((r) => r.exchange && r.exchange !== '.')
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange)
    if (mx.length) return { dominio, estado: 'ok', mx }
    if (registros.length) return { dominio, estado: 'no_existe', mx: [] }
  } catch (error) {
    if (!['ENODATA', 'ENOTFOUND', 'ESERVFAIL'].includes(error.code)) return { dominio, estado: 'sin_dns', mx: [], detalle: error.code }
    if (error.code === 'ENOTFOUND') return { dominio, estado: 'no_existe', mx: [] }
  }
  try {
    await dns.resolve4(dominio)
    return { dominio, estado: 'sin_mx', mx: [dominio] }
  } catch {
    return { dominio, estado: 'no_existe', mx: [] }
  }
}

// --- 2. SMTP sin enviar ------------------------------------------------------------

// Una conversación SMTP mínima. Devuelve las respuestas en orden; cada una es
// { codigo, texto }. Se cuelga siempre con QUIT antes de DATA.
function conversar(host, comandos, puerto = PUERTO_SMTP) {
  return new Promise((resolve, reject) => {
    const respuestas = []
    let buffer = ''
    let paso = 0
    const socket = net.createConnection({ host, port: puerto })
    const terminar = (error) => {
      socket.destroy()
      if (error) reject(error)
      else resolve(respuestas)
    }
    socket.setTimeout(ESPERA_MS, () => terminar(new Error('timeout')))
    socket.on('error', (error) => terminar(error))
    // Hay servidores que cuelgan sin contestar al QUIT, o en cuanto no les gusta algo:
    // lo que se haya respondido hasta ahí sigue valiendo.
    socket.on('close', () => terminar())
    socket.on('data', (trozo) => {
      buffer += trozo.toString('latin1')
      // Una respuesta acaba en la línea "NNN texto" (con espacio); las "NNN-texto"
      // son líneas intermedias de la misma respuesta.
      for (;;) {
        const fin = buffer.match(/^(\d{3}) [^\r\n]*\r?\n/m)
        if (!fin) return
        const corte = buffer.indexOf(fin[0]) + fin[0].length
        respuestas.push({ codigo: Number(fin[1]), texto: buffer.slice(0, corte).trim() })
        buffer = buffer.slice(corte)
        const ultima = respuestas[respuestas.length - 1]
        // Saludo (paso 0) o EHLO que no es 2xx: no hay conversación posible.
        if (paso <= 1 && ultima.codigo >= 400) return terminar()
        if (paso >= comandos.length) return terminar()
        socket.write(`${comandos[paso]}\r\n`)
        paso += 1
      }
    })
  })
}

// estado: 'existe' | 'no_existe' | 'catch_all' (el servidor dice que sí a todo, así que
// su "sí" no prueba nada) | 'desconocido' (no se pudo preguntar: puerto 25 cortado,
// lista gris, servidor que no contesta. NO es un no).
// `puerto` existe solo para probarlo contra un servidor falso en local.
export async function verificarSmtp(email, mx, { puerto = PUERTO_SMTP } = {}) {
  const dominio = dominioDe(email)
  const inventada = `no-existe-${Math.random().toString(36).slice(2, 10)}@${dominio}`
  let ultimoError = ''
  for (const host of mx.slice(0, 2)) {
    try {
      const respuestas = await conversar(host, [
        `EHLO ${HELO}`,
        `MAIL FROM:<${REMITENTE_PRUEBA}>`,
        `RCPT TO:<${email}>`,
        `RCPT TO:<${inventada}>`,
        'QUIT',
      ], puerto)
      // [saludo, ehlo, mail, rcpt real, rcpt inventada, quit]
      const [saludo, ehlo, mail, real, falsa] = respuestas
      if (!saludo || saludo.codigo >= 400 || !ehlo || ehlo.codigo >= 400) {
        ultimoError = (saludo ?? ehlo)?.texto ?? 'sin saludo'
        continue
      }
      if (!mail || mail.codigo >= 400) return { estado: 'desconocido', host, detalle: mail?.texto ?? 'MAIL FROM sin respuesta' }
      if (!real) return { estado: 'desconocido', host, detalle: 'RCPT sin respuesta' }
      // 5xx en RCPT es el "no existe" de verdad (550, 551, 553). Un 4xx es lista gris
      // o límite: no dice nada de la dirección.
      if (real.codigo >= 500) return { estado: 'no_existe', host, detalle: real.texto }
      if (real.codigo >= 400) return { estado: 'desconocido', host, detalle: real.texto }
      if (falsa && falsa.codigo < 300) return { estado: 'catch_all', host, detalle: 'acepta también una dirección inventada' }
      return { estado: 'existe', host, detalle: real.texto }
    } catch (error) {
      ultimoError = error.code ?? error.message
    }
  }
  return {
    estado: 'desconocido',
    detalle: /ECONNREFUSED|ETIMEDOUT|timeout|EHOSTUNREACH|ENETUNREACH/.test(ultimoError)
      ? `${ultimoError}: el puerto 25 suele estar cortado en conexiones domésticas`
      : ultimoError,
  }
}

// Las dos cosas juntas, con un veredicto para decidir: 'ok', 'dudoso' o 'descartar'.
// Solo es 'descartar' lo que de verdad rebotaría: dominio sin correo o un 5xx a esa
// dirección. Todo lo que no se pudo comprobar es 'dudoso', y lo decide una persona.
export async function verificarCorreo(email, { smtp = true } = {}) {
  const limpio = String(email).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return { email: limpio, veredicto: 'descartar', motivo: 'no es una dirección' }
  if (/[^\x00-\x7F]/.test(limpio)) return { email: limpio, veredicto: 'descartar', motivo: 'lleva tildes o eñes: Hostinger no la envía' }

  const dns = await comprobarDominio(limpio)
  if (dns.estado === 'no_existe') return { email: limpio, veredicto: 'descartar', motivo: `el dominio ${dns.dominio} no recibe correo`, dns }
  if (dns.estado === 'sin_dns') return { email: limpio, veredicto: 'dudoso', motivo: `no se pudo consultar el DNS (${dns.detalle})`, dns }
  if (!smtp) return { email: limpio, veredicto: dns.estado === 'ok' ? 'ok' : 'dudoso', motivo: dns.estado === 'ok' ? 'dominio con MX' : 'dominio sin MX, solo A', dns }

  const prueba = await verificarSmtp(limpio, dns.mx)
  const veredicto = { existe: 'ok', no_existe: 'descartar', catch_all: 'dudoso', desconocido: 'dudoso' }[prueba.estado]
  const motivo = {
    existe: 'el servidor confirma la dirección',
    no_existe: 'el servidor dice que no existe',
    catch_all: 'el servidor acepta cualquier dirección: no se puede confirmar',
    desconocido: `no se pudo preguntar (${prueba.detalle})`,
  }[prueba.estado]
  return { email: limpio, veredicto, motivo, dns, smtp: prueba }
}

// --- 3. Correos escondidos en el HTML ---------------------------------------------

// Cloudflare "Email Address Obfuscation": el correo va en hexadecimal; el primer byte
// es la clave y cada byte siguiente va con XOR contra ella.
export function desofuscarCloudflare(hex) {
  const limpio = String(hex).replace(/[^0-9a-f]/gi, '')
  if (limpio.length < 4 || limpio.length % 2) return ''
  const clave = parseInt(limpio.slice(0, 2), 16)
  let salida = ''
  for (let i = 2; i < limpio.length; i += 2) salida += String.fromCharCode(parseInt(limpio.slice(i, i + 2), 16) ^ clave)
  return salida
}

const NO_ES_CORREO = /\.(png|jpe?g|gif|webp|svg|avif|css|js)$/i

// Todos los correos de una página: mailto, texto plano, los de Cloudflare
// (`data-cfemail` y `/cdn-cgi/l/email-protection#…`) y los escritos "info [at] x.es" o
// "info (arroba) x.es". Devuelve cada uno una vez, en minúsculas.
export function extraerCorreos(html) {
  const texto = String(html)
  const encontrados = new Set()
  const anadir = (email) => {
    const limpio = email.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0]
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(limpio) && !NO_ES_CORREO.test(limpio)) encontrados.add(limpio)
  }
  for (const [, hex] of texto.matchAll(/data-cfemail="([0-9a-f]+)"/gi)) anadir(desofuscarCloudflare(hex))
  for (const [, hex] of texto.matchAll(/email-protection#([0-9a-f]+)/gi)) anadir(desofuscarCloudflare(hex))
  for (const [, email] of texto.matchAll(/mailto:([^"'?\s>]+)/gi)) anadir(decodeURIComponent(email))
  const sinEtiquetas = texto.replace(/<[^>]+>/g, ' ')
  for (const [email] of sinEtiquetas.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) anadir(email)
  for (const [, local, dominio] of sinEtiquetas.matchAll(/([a-z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\[\s*arroba\s*\]|\(\s*arroba\s*\))\s*([a-z0-9-]+(?:\s*(?:\.|\[\s*dot\s*\]|\(\s*punto\s*\))\s*[a-z0-9-]+)+)/gi)) {
    anadir(`${local}@${dominio.replace(/\s*(?:\[\s*dot\s*\]|\(\s*punto\s*\))\s*/gi, '.').replace(/\s+/g, '')}`)
  }
  return [...encontrados]
}
