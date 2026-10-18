"""Full, sourced web analysis using the canonical motor's audit, pain rules and A4 design.

No new website, invented before/after or model measurement. Missing measurements stay explicit.
"""
from urllib.parse import urlparse


def render(business, audit, row, out):
    from visibilidad import hoja, gancho, completo, dolores, ranking
    e = hoja.esc
    reference = ranking.cargar()['webs']
    _, means, notes = gancho.estudio_por_punto()
    ficha = {'nombre': business['name'], 'tipo': 'restaurante',
             'direccion': {'ciudad': business.get('city') or ''}}
    k = {'a': audit, 'd': None, 'c': None, 'fila': row, 'ficha': ficha, 'trad': {}, 'zona': None}
    completo._MEDIDA.clear(); completo._MEDIDA.update(completo.contexto(k))
    pains = dolores.dolores(row, row['checks'], row['evidencias'], ficha, None, None, None,
                            completo._MEDIDA, audit['checks'], completo.a_medida)[:5]
    head = lambda title: hoja.membrete(title)
    link = f'<a href="{e(business["web"])}">{e(business["web"])}</a>'
    date = audit['fecha_utc'][:10]
    bad = [c for c in audit['checks'] if c['estado'] in ('mal', 'aviso')]
    pages = [head('Análisis completo de la web') +
        f'<div class=cabeza><div><h1>{e(business["name"])}</h1><p class=donde>{e(business.get("city") or "")}</p></div>'
        f'<div class=nota><div class=num>{row["nota"]:.0f}<small>/100</small></div><div class=txt>Lectura por IA<br>{e(row["nivel"])}</div></div></div>'
        f'<p class=lead>Tu web, punto por punto: qué hemos observado, qué conviene mejorar y cómo hacerlo.</p>'
        f'<p class=ojo>Medida el {e(date)} · {len(audit["paginas"])} páginas leídas · {len(audit["checks"])} comprobaciones.</p>'
        '<div class=regla></div><section class=rejilla><div><h2>Dónde queda tu web</h2>' +
        hoja.histograma(notes, [(row['nota'], business['name'], '#15202e')]) + '</div><div><h2>Por partes</h2>' +
        hoja.puntos_por_partes([(completo.NOMBRE_BLOQUE[b], row['bloques'][b], means[b], None) for b in completo.ORDEN_BLOQUES]) + '</div></section>'
        f'<p>Tu puntuación quedaría en el puesto {row["puesto"]} al compararla con las {len(reference)} webs de la referencia Studio32 del {ranking.ACTUALIZADO}.</p>'
        f'<section class=seccion><h2>{len(bad)} puntos para mejorar</h2><p>Los siguientes apartados separan prioridades, evidencias y soluciones. El anexo recoge también los puntos que ya están bien.</p></section>'
        f'<section class="banda"><h3>Alcance de este análisis</h3><p>Es una revisión de la web actual. No se han aplicado cambios ni generado una web nueva. '
        'La comparación antes/después, la prueba de comprensión en seis idiomas y las recomendaciones en buscadores de IA no se han medido en este encargo.</p></section>'
        f'<p class=metodo>Fuente principal: {link}. El índice mide lectura y preparación técnica; no garantiza que una IA recomiende el negocio.</p>']
    pages += completo._paginas_dolores(pains)
    # Every check is included, including passing and not applicable checks. Each has its saved evidence.
    labels = {'ok': 'Bien', 'mal': 'Necesita mejorar', 'aviso': 'Revisar', 'na': 'No se aplica'}
    for start in range(0, len(audit['checks']), 5):
        checks = audit['checks'][start:start+5]
        content = head('Análisis completo · revisión de la web') + '<h2>Lo que hemos comprobado</h2>'
        for c in checks:
            content += (f'<section class="seccion check"><div class=tit><h3>{e(c["titulo"])}</h3><span>{e(labels.get(c["estado"], c["estado"]))}</span></div>'
                        f'<p><b>Evidencia:</b> {e(c["evidencia"])}</p>'
                        f'<p><b>Por qué importa:</b> {e(completo.a_medida(c.get("porque") or ""))}</p>'
                        + (f'<p><b>Cómo mejorarlo:</b> {e(completo.a_medida(c.get("arreglo") or ""))}</p>' if c['estado'] in ('mal', 'aviso') else '') + '</section>')
        pages.append(content)
    priority = sorted(bad, key=lambda c: (c['id'] in ('web_viva', 'spam', 'seguridad'), c.get('peso', 0), c['estado']=='mal'), reverse=True)
    for start in range(0, max(1, len(priority)), 7):
        content = head('Análisis completo · plan de trabajo') + '<h2>El plan, en orden</h2>'
        for i, c in enumerate(priority[start:start+7], start+1):
            content += f'<section class=seccion><h3>{i}. {e(c["titulo"])}</h3><p>{e(completo.a_medida(c.get("arreglo") or "Revisar la evidencia con quien lleva la web."))}</p><p class=etq>Responsable: {e(completo.QUIEN.get(c.get("quien"), "Acordar con el restaurante"))} · volver a medir después de aplicarlo.</p></section>'
        if not priority: content += '<p>No se han detectado puntos negativos en las comprobaciones automáticas. Conviene contrastar los datos con el dueño y revisar el uso real.</p>'
        pages.append(content)
    sources = ''.join(f'<li>{e(p["url"])}</li>' for p in audit['paginas'])
    pages.append(head('Análisis completo · fuentes y siguiente paso') + '<h2>Fuentes y límites</h2>'
        f'<p>Lectura guardada el {e(audit["fecha_utc"])}. Se han consultado estas páginas públicas:</p><ul class=fuentes>{sources}</ul>'
        '<section class=seccion><h3>Lo que falta contrastar contigo</h3><p>Horarios, reservas, carta, idiomas y otros datos del negocio deben coincidir con lo que publicas. '
        'Lo que el lector no ha encontrado no se convierte en un dato inventado. Los bloqueos o contenidos que dependen de JavaScript se documentan en la evidencia.</p></section>'
        '<section class=seccion><h3>Mediciones que no se han realizado</h3><p>Este PDF no demuestra cambios en visitas, ventas, posicionamiento ni recomendaciones. '
        'No incluye una prueba de IA en seis idiomas ni un antes/después: requieren datos y mediciones adicionales. Tras aplicar los arreglos se podrá repetir la auditoría con las mismas reglas.</p></section>'
        f'<section class="banda siguiente"><div><h2>Revisamos el plan contigo</h2><p>Decidimos qué cambios hacer y quién los aplica. Nadie puede prometer que una IA te recomiende. Sí podemos comprobar qué puede leer de tu web.</p></div>{hoja.firma(business["name"])}</section>')
    css = '<style>.check p{font-size:8.4pt;line-height:1.4;margin-top:1mm}.check{padding-bottom:2mm;border-bottom:1px solid var(--linea)}ul.fuentes{font-size:8pt;overflow-wrap:anywhere;margin:3mm 0 3mm 5mm;line-height:1.6}</style>'
    html = hoja.documento(f'Análisis completo · {business["name"]}', pages).replace('</head>', completo.CSS_EXTRA + css + '</head>')
    file = out / 'analisis-completo.html'; file.write_text(html, encoding='utf-8')
    return file, len(pages)
