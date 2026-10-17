// El diagnóstico de un negocio: qué dice y cómo se pinta (17/10/2026).
//
// Es la imagen que viajará dentro del correo frío (docs/DIAGNOSTICO.md, fase 1) y, más
// adelante, el diagnóstico gratis de la landing. Se llama siempre **diagnóstico**, nunca
// "mini informe" ni "mini auditoría". Lo que se vende es el informe completo.
//
// JavaScript plano y sin dependencias, como reglas-correo.js: lo usa
// `scripts/diagnostico.mjs` para pintar la imagen en local, y el Hub lo podrá usar para
// enseñar la vista previa en el borrador sin una segunda plantilla que mantener.
//
// De dónde salen los hallazgos, por orden:
//   1. `huella.diagnostico.hallazgos`, si la skill los escribió (lo bueno).
//   2. Si no, se deducen de lo que ya trae el lead: la evidencia del correo
//      (personalización y fricción), la nota y las reseñas, y si hay WhatsApp y reserva
//      online. Así los leads que ya están en cola también tienen diagnóstico.
//
// Nada que no se pueda defender: cada hallazgo lleva su fuente, y solo se dice lo que
// ya sostiene la evidencia del lead. Sin precio: el precio no va en el correo frío.

export const ESTADOS = {
  bien: { etiqueta: 'Funciona', color: '#2d746a', fondo: '#e4f0eb' },
  mejorable: { etiqueta: 'Mejorable', color: '#9a5f2c', fondo: '#f7ecdf' },
  falla: { etiqueta: 'Falla', color: '#a14b4b', fondo: '#f8e9e7' },
}

const MAX_HALLAZGOS = 3
const MAX_TITULO = 80
const MAX_DETALLE = 190

function recortar(texto, maximo) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= maximo) return limpio
  const corte = limpio.slice(0, maximo - 3)
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), maximo - 20))}...`
}

function nota(rating) {
  return Number(rating).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function citar(cita) {
  const limpia = String(cita ?? '').trim().replace(/^"+|"+$/g, '')
  return limpia ? `"${limpia}"` : ''
}

/**
 * Los hallazgos de un lead con la forma del JSON de una tanda (o de una fila de
 * outreach_leads con su mensaje). Devuelve [] si no hay con qué decir nada.
 */
export function diagnosticoDeLead(lead) {
  const escritos = lead?.huella?.diagnostico?.hallazgos
  if (Array.isArray(escritos) && escritos.length) return escritos.slice(0, MAX_HALLAZGOS)

  const evidencia = lead?.message?.evidencia ?? lead?.evidencia ?? []
  const personalizacion = evidencia.find((e) => e.rol === 'personalizacion')
  const friccion = evidencia.find((e) => e.rol === 'friccion')
  const hallazgos = []

  if (lead?.rating && lead?.reviews) {
    hallazgos.push({
      area: 'Reputación',
      estado: Number(lead.rating) >= 4.5 && Number(lead.reviews) >= 30 ? 'bien' : 'mejorable',
      titulo: `${nota(lead.rating)} de nota con ${lead.reviews} reseñas`,
      detalle: citar(personalizacion?.cita),
      fuente: personalizacion?.fuente ?? 'Reseñas públicas',
    })
  } else if (personalizacion) {
    hallazgos.push({ area: 'Lo que ya funciona', estado: 'bien', titulo: personalizacion.afirmacion, detalle: citar(personalizacion.cita), fuente: personalizacion.fuente })
  }

  if (friccion) {
    hallazgos.push({
      area: 'Pedir cita',
      estado: !lead?.has_whatsapp && !lead?.has_online_booking ? 'falla' : 'mejorable',
      titulo: friccion.afirmacion,
      detalle: citar(friccion.cita),
      fuente: friccion.fuente,
    })
  }

  // Un tercero solo si lo sostienen los datos del lead y no repite la fricción.
  const yaDicho = `${friccion?.afirmacion ?? ''} ${friccion?.cita ?? ''}`.toLowerCase()
  if (hallazgos.length < MAX_HALLAZGOS && lead && lead.has_online_booking === false && !/reserv|agenda|online/.test(yaDicho)) {
    hallazgos.push({ area: 'Reserva online', estado: 'mejorable', titulo: 'No hay forma de reservar cita desde la web', detalle: '', fuente: 'Revisión de la web' })
  } else if (hallazgos.length < MAX_HALLAZGOS && lead && lead.has_whatsapp === false && !/whatsapp/.test(yaDicho)) {
    hallazgos.push({ area: 'WhatsApp', estado: 'mejorable', titulo: 'No aparece un WhatsApp para pedir cita', detalle: '', fuente: 'Revisión de la web' })
  }

  return hallazgos.slice(0, MAX_HALLAZGOS)
}

/**
 * Lo que impide que un diagnóstico salga. Vacío = se puede pintar.
 */
export function revisarDiagnostico(hallazgos) {
  const problemas = []
  if (!hallazgos.length) problemas.push('No hay ningún hallazgo con evidencia.')
  if (hallazgos.length > MAX_HALLAZGOS) problemas.push(`Más de ${MAX_HALLAZGOS} hallazgos: elige los mejores.`)
  if (hallazgos.length && hallazgos.every((h) => h.estado === 'bien')) problemas.push('Todo está bien: sin nada que mejorar no hay diagnóstico que mandar.')
  hallazgos.forEach((h, i) => {
    if (!ESTADOS[h.estado]) problemas.push(`Hallazgo ${i + 1}: estado "${h.estado}" (vale bien, mejorable o falla).`)
    if (!String(h.titulo ?? '').trim()) problemas.push(`Hallazgo ${i + 1}: sin título.`)
    if (!String(h.fuente ?? '').trim()) problemas.push(`Hallazgo ${i + 1}: sin fuente.`)
    if (/€|precio|euros?\b/i.test(`${h.titulo} ${h.detalle}`)) problemas.push(`Hallazgo ${i + 1}: habla de precio, y el diagnóstico no lleva precio.`)
  })
  return problemas
}

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

/**
 * El HTML del diagnóstico, autocontenido y de 600 px de ancho (el ancho de un correo).
 * `fecha` es una Date; por defecto, hoy.
 */
export function htmlDiagnostico({ negocio, ciudad = '', hallazgos, fecha = new Date() }) {
  const dia = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const filas = hallazgos.map((h) => {
    const estado = ESTADOS[h.estado] ?? ESTADOS.mejorable
    const detalle = recortar(h.detalle, MAX_DETALLE)
    return `
      <div class="fila">
        <div class="cabeza">
          <span class="area">${escapar(h.area ?? '')}</span>
          <span class="estado" style="color:${estado.color};background:${estado.fondo}"><i style="background:${estado.color}"></i>${estado.etiqueta}</span>
        </div>
        <p class="titulo">${escapar(recortar(h.titulo, MAX_TITULO))}</p>
        ${detalle ? `<p class="detalle">${escapar(detalle)}</p>` : ''}
        <p class="fuente">Fuente: ${escapar(h.fuente ?? '')}</p>
      </div>`
  }).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Manrope:wght@700;800&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 600px; background: #f3f4ef; font: 15px/1.5 'DM Sans', 'Segoe UI', Arial, sans-serif; color: #182622; }
  .hoja { margin: 0; background: #fffefa; }
  header { background: #173e38; color: #fff; padding: 26px 32px 24px; }
  .marca { font: 700 12px/1 'Manrope', 'Segoe UI', Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; opacity: .72; }
  h1 { font: 800 25px/1.2 'Manrope', 'Segoe UI', Arial, sans-serif; margin-top: 10px; }
  .lugar { margin-top: 4px; opacity: .78; font-size: 14px; }
  .cuerpo { padding: 8px 32px 4px; }
  .fila { padding: 18px 0; border-bottom: 1px solid #dce3dc; }
  .fila:last-child { border-bottom: 0; }
  .cabeza { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .area { font: 700 12px/1 'Manrope', 'Segoe UI', Arial, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #697670; }
  .estado { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; padding: 5px 11px 5px 9px; border-radius: 999px; white-space: nowrap; }
  .estado i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .titulo { font-weight: 600; font-size: 17px; line-height: 1.35; margin-top: 8px; }
  .detalle { color: #3d4b46; margin-top: 6px; font-style: italic; }
  .fuente { color: #697670; font-size: 12.5px; margin-top: 6px; }
  .cierre { margin: 6px 32px 0; padding: 16px 18px; background: #e4f0eb; border-radius: 11px; color: #173e38; font-weight: 600; }
  footer { padding: 18px 32px 24px; color: #697670; font-size: 12.5px; display: flex; justify-content: space-between; gap: 12px; }
</style></head>
<body><div class="hoja">
  <header>
    <div class="marca">Diagnóstico digital</div>
    <h1>${escapar(negocio)}</h1>
    ${ciudad ? `<div class="lugar">${escapar(ciudad)}</div>` : ''}
  </header>
  <div class="cuerpo">${filas}</div>
  <div class="cierre">El informe completo explica cómo resolver cada punto, paso a paso.</div>
  <footer><span>Studio32 · studio32.es</span><span>Con datos públicos · ${dia}</span></footer>
</div></body></html>`
}
