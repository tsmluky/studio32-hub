"""Build a private, source-backed documentary example. Never fetches or publishes."""
import argparse
import html
import json
import re
from pathlib import Path

from validar import BLOCKS, VERSION, sha, validate


def prepare(motor, out, slug):
    if not re.fullmatch(r'[a-z0-9-]+', slug):
        raise ValueError('Slug inválido')
    out.mkdir(parents=True, exist_ok=True)
    texts_path = motor / f'datos/auditorias/{slug}.textos.json'
    texts = json.loads(texts_path.read_text(encoding='utf-8'))
    audit = json.loads((motor / f'datos/auditorias/{slug}.json').read_text(encoding='utf-8'))
    card = json.loads((motor / f'datos/fichas/{slug}.json').read_text(encoding='utf-8'))
    name, base_url = card['nombre'], card['url'].rstrip('/')
    address = card.get('direccion') or {}
    location = ', '.join(str(address.get(k) or '') for k in ['calle', 'ciudad'] if address.get(k))
    branch = slug + '-sede-revisada'
    sources = []
    for sid, fragment in [('portada', 'Dom: 12.00'), ('contacto', 'Vie – Dom:')]:
        matches = [(url, text) for url, text in texts.items()
                   if fragment in text and (('/contactos/' in url) if sid == 'contacto' else url.rstrip('/') == base_url)]
        if len(matches) != 1:
            raise ValueError('La fuente cambió: revisar manualmente ' + sid)
        url, text = matches[0]
        start = text.index(fragment)
        match = re.match(r'(?:Dom:|Vie – Dom:)\s*\d{1,2}[.:]\d{2}\s*[–-]\s*\d{1,2}[.:]\d{2}', text[start:])
        if not match:
            raise ValueError('El formato del horario cambió: revisar manualmente ' + sid)
        quote = match.group(0)
        p = out / (sid + '.txt')
        p.write_text(text, encoding='utf-8')
        sources.append({'id': sid, 'url': url, 'fecha': audit['fecha_utc'], 'archivo': p.name,
                        'sha256': sha(p.read_bytes()), 'cita': quote, 'metodo': 'html_sin_js',
                        'sede': branch})
    statement = 'La portada y la página de contacto publican dos horas de cierre distintas para el domingo.'
    e = html.escape
    quotes = ''.join('<article class="quote"><span>' + e(s['id'].upper()) + '</span><blockquote>' + e(s['cita']) +
                     '</blockquote><a href="' + e(s['url'], quote=True) + '">' + e(s['url']) + '</a></article>' for s in sources)
    page = '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ejemplo de hallazgo verificado</title><style>
:root{color-scheme:light;--ink:#17352e;--muted:#626c65;--line:#d9ded5;--accent:#a96930}*{box-sizing:border-box}
body{margin:0;background:#edece6;color:var(--ink);font:16px/1.65 system-ui,sans-serif}main{max-width:960px;margin:36px auto;background:#fffefa;padding:52px 64px;border:1px solid var(--line)}
header{display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line);padding-bottom:20px;font-size:12px;letter-spacing:.1em}header b{letter-spacing:.26em}
.eyebrow{margin:35px 0 8px;text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--accent);font-weight:700}h1{font:normal clamp(35px,5vw,58px)/1.08 Georgia,serif;margin:0 0 10px;letter-spacing:-.03em}h2{font:normal 29px/1.2 Georgia,serif;margin-top:34px}h3{font-size:16px;margin-bottom:6px}
.muted,.small{color:var(--muted)}.small{font-size:12px}.lead{font-size:21px;line-height:1.5;max-width:700px}.status{display:inline-block;background:#f5ebdc;color:#775020;padding:5px 12px;font-size:12px;border-radius:3px}
.quotes{display:grid;grid-template-columns:1fr 1fr;gap:18px}.quote{border:1px solid var(--line);padding:22px}.quote span{font-size:10px;letter-spacing:.14em;font-weight:700}blockquote{margin:16px 0;font:23px/1.4 Georgia,serif}a{color:#286555;overflow-wrap:anywhere}.quote a{font-size:11px}
.step{display:grid;grid-template-columns:36px 1fr;gap:12px;margin:20px 0}.step>b{color:var(--accent);font:28px Georgia,serif}.step p{margin:0}.note{background:#f1f3ed;padding:22px;border-left:3px solid #688272}footer{border-top:1px solid var(--line);margin-top:35px;padding-top:20px;font-size:12px}
@media(max-width:650px){main{margin:0;padding:28px 22px;border:0}.quotes{grid-template-columns:1fr}header{font-size:10px}.lead{font-size:19px}}
@media print{@page{size:A4;margin:15mm}body{background:white;font-size:10pt}main{border:0;margin:0;padding:0;max-width:none}h1{font-size:34pt}.lead{font-size:13pt}h2{font-size:19pt}.quote{break-inside:avoid}blockquote{font-size:14pt}.step,.note{break-inside:avoid}.eyebrow{margin-top:20px}a{color:inherit}}
</style><main><header><b>STUDIO32</b><span>REVISIÓN DOCUMENTAL · 19 OCT 2026</span></header>
<p class="eyebrow">''' + e(name + ' · ' + location) + '''</p><h1>Un solo horario.<br>En todas tus páginas.</h1>
<p class="muted">Ejemplo de estructura del hallazgo · evidencia guardada del 17/10/2026</p>
<span class="status">P1 · Confirmar con el responsable</span><p class="lead">''' + e(statement) + '''</p>
<h2>La prueba concreta</h2><div class="quotes">''' + quotes + '''</div>
<p class="small">Lectura HTML guardada: ''' + e(audit['fecha_utc']) + '''. Las fuentes completas y sus huellas SHA-256 se conservan en el expediente de este ejemplo.</p>
<h2>Qué significa para una visita</h2><p>Las dos páginas discrepan entre las 24:00 y la 1:00 para el domingo. Una persona puede organizar su visita con el dato equivocado. No hemos medido reservas perdidas ni cambios de posición en buscadores.</p>
<h2>Cómo lo corregimos</h2>
<div class="step"><b>1</b><div><h3>Confirmar el dato correcto</h3><p>El responsable confirma el cierre del domingo y si hay diferencias de temporada o entre cocina y local. Hasta entonces no elegimos una hora como verdadera.</p></div></div>
<div class="step"><b>2</b><div><h3>Unificar las dos páginas</h3><p>Quien lleva la web actualiza portada y contacto con el valor confirmado y revisa el horario publicado en datos estructurados, si existe. Las fichas externas se contrastan por separado.</p></div></div>
<div class="step"><b>3</b><div><h3>Comprobar el cierre</h3><p>Las dos páginas muestran el mismo horario confirmado. Una nueva lectura recupera ese valor y una revisión visual verifica que también se ve en el teléfono.</p></div></div>
<div class="note"><b>Estado: propuesta pendiente.</b><br>Este ejemplo demuestra una contradicción en las copias guardadas. Antes de entregarlo como auditoría actual hay que volver a consultar las páginas y confirmar el horario. No se han aplicado cambios.</div>
<footer><b>Francisco · Studio32</b><br>Documento interno de trabajo. Alcance: un hallazgo, sin auditoría SEO completa ni revisión de reseñas.</footer></main></html>'''
    report = out / 'ejemplo-horario.html'
    report.write_text(page, encoding='utf-8')
    packet = {'version': VERSION,
        'negocio': {'id': slug, 'nombre': name, 'sede': branch},
        'documento': {'archivo': report.name, 'sha256': sha(report.read_bytes()), 'tipo': 'revision_documental'},
        'cobertura': {k: {'estado': 'no_ejecutado', 'detalle': 'Fuera de este ejemplo de un hallazgo'} for k in BLOCKS},
        'recorrido': {'skill': 'restaurante-ia/2026-10-19', 'reglas': VERSION,
                       'codigo': 'preparar_revision.py/v1', 'metodos': ['contraste_documental_html']},
        'fuentes': sources, 'hallazgos': [{
            'id': 'horario-domingo', 'titulo': 'Dos cierres publicados para el domingo',
            'sede': branch, 'ambitos': ['seo', 'lectura_ia', 'uso'], 'estado': 'contradiccion',
            'afirmacion': statement, 'interpretacion': 'La discrepancia puede confundir al planificar una visita; no se ha medido su impacto.',
            'fuentes': ['portada', 'contacto'], 'necesidad': 'Saber hasta qué hora se puede visitar el domingo',
            'prioridad': 'P1', 'motivo_prioridad': 'Dato esencial incompatible en dos páginas de la misma sede',
            'campo': 'horario', 'metodo': 'html_sin_js', 'resultado': 'conflicto', 'resolucion': 'propuesto',
            'accion': 'Confirmar cierre del domingo y unificar portada y contacto con el valor del responsable.',
            'responsable': 'Responsable confirma; técnico actualiza; Francisco repite la comprobación',
            'aceptacion': 'Portada y contacto muestran el horario confirmado; nueva lectura y revisión móvil coinciden.',
            'observaciones': [{'fuente': 'portada', 'campo': 'horario', 'valor': '24:00'},
                              {'fuente': 'contacto', 'campo': 'horario', 'valor': '01:00'}]}]}
    packet['cobertura']['identidad'] = {'estado': 'parcial', 'detalle': 'Sede según ficha histórica; sin nueva verificación pública'}
    packet['cobertura']['seo_contenido'] = {'estado': 'parcial', 'detalle': 'Solo consistencia del horario en dos páginas'}
    file = out / 'expediente-ejemplo.json'
    file.write_text(json.dumps(packet, ensure_ascii=False, indent=2), encoding='utf-8')
    result = validate(packet, out)
    (out / 'validacion-ejemplo.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--motor-root', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--slug', required=True, help='Caso privado con los formatos de horario de este ejemplo')
    args = parser.parse_args()
    result = prepare(args.motor_root.resolve(), args.out.resolve(), args.slug)
    print(json.dumps(result, ensure_ascii=True, indent=2))
    raise SystemExit(0 if result['borrador_valido'] else 2)
