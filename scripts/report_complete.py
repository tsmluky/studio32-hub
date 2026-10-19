"""Audit-only A4 reports. No inferred recommendation, census rank or measured improvement."""
from collections import Counter

TITLES = {
 'web_viva': 'Disponibilidad de la web', 'https': 'Conexión HTTPS',
 'robots_ia': 'Reglas de acceso para robots', 'texto_sin_js': 'Texto sin ejecutar JavaScript',
 'movil': 'Configuración para móvil', 'velocidad': 'Tiempo de respuesta observado',
 'sitemap': 'Mapa de páginas', 'llms_txt': 'Resumen para lectores automáticos',
 'schema': 'Ficha de restaurante para máquinas', 'titulo': 'Título de la página',
 'nap': 'Dirección y teléfono en texto', 'descripcion': 'Descripción de la página',
 'perfiles': 'Enlaces a perfiles del negocio', 'carta': 'Carta en formato legible',
 'especialidad': 'Descripción de la cocina', 'horario': 'Horario en texto',
 'cantidad': 'Cantidad de texto recuperado', 'faq': 'Preguntas frecuentes',
 'fotos': 'Descripciones de imágenes', 'fresca': 'Referencias temporales',
 'idiomas': 'Versiones por idioma detectadas', 'carta_idiomas': 'Idiomas de la carta detectados',
 'traductor': 'Forma de publicar las traducciones', 'hreflang': 'Enlaces entre idiomas',
 'visit_valencia': 'Presencia en la fuente turística consultada',
}
WHY = {
 'schema': 'Los datos estructurados hacen explícitos el tipo de negocio y sus datos. Su ausencia no demuestra que una IA no entienda el texto de la web.',
 'idiomas': 'Publicar información en otros idiomas puede facilitar su consulta. No hemos probado qué responderá un buscador ni si recomendará el negocio.',
 'carta': 'Se comprueba qué contenido recupera este lector. Un PDF puede contener texto legible; una imagen o una web dinámica puede requerir otro lector.',
 'horario': 'Un horario claro y vigente facilita planificar una visita. Si este lector no lo encuentra, hay que contrastar la web antes de darlo por ausente.',
 'texto_sin_js': 'Esta lectura no ejecuta JavaScript. Describe el contenido recuperado con este método, sin representar a todos los buscadores o modelos.',
 'robots_ia': 'Estas reglas expresan permisos de rastreo por agente. No prueban por sí solas indexación, acceso efectivo ni recomendaciones.',
 'carta_idiomas': 'La revisión automática identifica las versiones que ha podido encontrar. Conviene contrastar enlaces y documentos no recuperados.',
 'traductor': 'Una traducción que depende de un botón puede requerir interacción. Hay que revisar qué versiones tienen dirección propia y texto recuperable.',
 'llms_txt': 'Es un archivo opcional. Tenerlo o no tenerlo no demuestra comprensión ni recomendaciones.',
 'fotos': 'Las descripciones pueden mejorar accesibilidad y aportar contexto. No son una prueba de posicionamiento.',
 'fresca': 'Una fecha detectada no prueba que toda la web esté actualizada; su ausencia tampoco prueba que esté abandonada.',
}
PRIORITY = {'web_viva':100,'seguridad':100,'spam':100,'https':95,'robots_ia':90,'texto_sin_js':90,'carta':85,'nap':80,'horario':80,'idiomas':75,'carta_idiomas':70,'traductor':60,'schema':55,'titulo':45,'descripcion':35,'perfiles':30,'faq':25,'fotos':10,'sitemap':5,'llms_txt':0}
LABELS = {'ok':'Detectado / correcto','aviso':'Revisar','mal':'No supera la comprobación','na':'No se aplica'}
LIMITS = 'Es una lectura automática de la web actual, con sus límites. Un dato no encontrado puede existir en páginas, documentos o contenidos que este lector no haya recuperado. Contrasta los hallazgos antes de entregarlos.'


def title(c):
    return TITLES.get(c['id'], c['titulo'])


def ordered(audit):
    return sorted((c for c in audit['checks'] if c['estado'] in ('mal','aviso')), key=lambda c:(PRIORITY.get(c['id'],20),c['estado']=='mal',c.get('peso',0)), reverse=True)


def explanation(c):
    return WHY.get(c['id'], 'Esta comprobación describe una señal técnica o un dato encontrado por el lector. Su resultado debe contrastarse con la web y con el dueño; no mide respuestas ni posiciones en buscadores.')


def highlights(audit):
    seen=set(); found=[]
    for c in ordered(audit):
        group='idiomas' if c['id'] in ('idiomas','carta_idiomas','traductor','hreflang') else c['id']
        if group in seen: continue
        seen.add(group); found.append(c)
        if len(found)==3: break
    return found


def render(business, audit, row, out, report_type='completo'):
    from visibilidad import hoja, config
    e=hoja.esc; complete=report_type=='completo'; bad=ordered(audit)
    counts=Counter(c['estado'] for c in audit['checks'])
    head=lambda label:hoja.membrete(label)
    name=e(business['name']); web=e(business['web'])
    address=e(' · '.join(x for x in [business.get('address'),business.get('city')] if x))
    caption='Análisis completo de la web' if complete else 'Diagnóstico de la web'
    signature=(f'<div class=firma>{hoja.qr_whatsapp(business["name"])}<div class=yo><b>{e(config.CONTACTO_NOMBRE)}</b>'
               f'<p>Reviso la información de tu web y te ayudo a corregirla con pruebas.</p><p class=tel>{e(config.CONTACTO_TELEFONO)}<br>{e(config.CONTACTO_EMAIL)}<br>{e(config.CONTACTO_WEB)}</p></div></div>')
    cover=head(caption)+f'<div class=cabeza><div><h1>{name}</h1><p class=donde>{address}</p></div></div>'
    cover+=f'<p class=lead>Qué hemos podido leer de tu web, qué conviene revisar y por dónde empezar.</p><p class=ojo>Lectura del {e(audit["fecha_utc"][:10])} · {len(audit["paginas"])} páginas consultadas · {len(audit["checks"])} comprobaciones.</p>'
    cover+='<div class=cifras>'+''.join(f'<div><b>{counts[k]}</b><span>{label}</span></div>' for k,label in [('ok','superadas'),('aviso','para revisar'),('mal','no superadas'),('na','no se aplican')])+'</div><div class=regla></div>'
    cover+='<section class=seccion><h2>Tres prioridades para revisar</h2><div class=problemas>'
    for i,c in enumerate(highlights(audit),1):
        evidence=c['evidencia']; preview=evidence[:240]+('…' if len(evidence)>240 else '')
        cover+=f'<div class=problema><span class=n>{i}</span><div><h3>{e(title(c))}</h3><p>{e(preview)}</p></div></div>'
    if not bad: cover+='<p>No se han detectado fallos en estas comprobaciones automáticas. Esto no sustituye una revisión del contenido y del uso real.</p>'
    cover+='</div></section>'
    cover+=f'<section class=banda><h3>Lo que demuestra esta lectura</h3><p>{e(LIMITS)}</p><p>No mide recomendaciones de IA, ventas ni posicionamiento. No se han aplicado cambios ni medido un antes/después. Los índices históricos y los puestos comparados no se presentan como resultados validados.</p></section>'
    if not complete:
        cover+=f'<section class="banda siguiente"><div><h2>Siguiente paso: el análisis completo</h2><p>Cada comprobación con su evidencia, los arreglos propuestos y un plan de trabajo para revisar contigo.</p><p>La aplicación de cambios se acuerda después.</p></div>{signature}</section>'
    cover+=f'<p class=metodo>Fuente principal: <a href="{web}">{web}</a>. Lectura guardada: {e(audit["fecha_utc"])}. Los hallazgos externos se limitan a las fuentes indicadas en la evidencia. No encontrar un negocio en una lista no prueba su ausencia de todo Internet.</p>'
    pages=[cover]
    if complete:
        for start in range(0,len(audit['checks']),4):
            page=head('Análisis completo · comprobaciones')+'<h2>Lo que ha comprobado el lector</h2>'
            for c in audit['checks'][start:start+4]:
                page+=f'<section class="seccion check"><div class=tit><h3>{e(title(c))}</h3><span>{e(LABELS.get(c["estado"],c["estado"]))}</span></div><p><b>Resultado guardado:</b> {e(c["evidencia"])}</p><p><b>Cómo interpretarlo:</b> {e(explanation(c))}</p>'
                if c['estado'] in ('mal','aviso'):page+=f'<p><b>Arreglo propuesto:</b> {e(c.get("arreglo") or "Contrastar el hallazgo antes de decidir un cambio.")}</p>'
                page+='</section>'
            pages.append(page)
        for start in range(0,len(bad),6):
            page=head('Análisis completo · plan de trabajo')+'<h2>El plan, en orden</h2>'
            for i,c in enumerate(bad[start:start+6],start+1):
                page+=f'<section class=seccion><h3>{i}. {e(title(c))}</h3><p>{e(c.get("arreglo") or "Contrastar el hallazgo antes de decidir un cambio.")}</p><p class=etq>Revisar con quien lleva la web y volver a comprobar después de aplicarlo.</p></section>'
            pages.append(page)
        sources=''.join(f'<li>{e(p["url"])}</li>' for p in audit['paginas'])
        pages.append(head('Análisis completo · fuentes y límites')+f'<h2>Fuentes consultadas</h2><ul class=fuentes>{sources}</ul><section class=seccion><h2>Qué falta contrastar</h2><p>{e(LIMITS)}</p><p>No incluye un antes/después, una prueba de comprensión en seis idiomas ni una medición de recomendaciones. No demuestra cambios en ventas o posicionamiento. No se ha generado una web nueva.</p><p>Una prueba de mejoras requiere datos y mediciones adicionales, validados por separado. Este documento no sustituye ese expediente.</p></section><section class="banda siguiente"><div><h2>Revisamos el plan contigo</h2><p>Confirmamos los hallazgos y acordamos qué cambios hacer. Después se repite la lectura con las mismas reglas.</p></div>{signature}</section>')
    css='<style>.check p{font-size:8.5pt;line-height:1.45}.check{padding:3mm 0;border-bottom:1px solid var(--linea)}ul.fuentes{font-size:8pt;overflow-wrap:anywhere;margin:3mm 5mm;line-height:1.7}.cifras{grid-template-columns:repeat(4,1fr)}</style>'
    html=hoja.documento(caption+' · '+business['name'],pages).replace('</head>',css+'</head>')
    file=out/('analisis-completo.html' if complete else 'diagnostico.html');file.write_text(html,encoding='utf-8')
    return file,len(pages)
