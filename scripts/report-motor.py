"""Desktop adapter: public restaurant discovery and an isolated, evidence-based PDF.

Never modifies motor code or its data. No model APIs. JSONL stdout is the worker protocol.
"""
import argparse
import contextlib
from datetime import datetime, timezone
from difflib import SequenceMatcher
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sys
import time
import unicodedata
from urllib.parse import urlparse, urlencode
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
MOTOR = Path(os.environ.get('STUDIO32_MOTOR_ROOT', ROOT.parent.parent / 'Visibilidad-IA')).resolve()
CACHE = ROOT / '.local' / 'report-worker' / 'search-cache'
VERSION = 'diagnostico-hub-3'


def emit(kind, **data):
    print(json.dumps({'event': kind, **data}, ensure_ascii=True), flush=True)


def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', str(text or '').lower()) if unicodedata.category(c) != 'Mn')


def public_url(url):
    u = urlparse(str(url))
    if u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password or u.port not in (None, 80, 443):
        raise ValueError('Usa una web pública http o https, sin credenciales ni puertos especiales.')
    if u.hostname.lower() in ('localhost', 'metadata.google.internal') or u.hostname.lower().endswith(('.local', '.internal', '.localhost')):
        raise ValueError('No se permite acceder a direcciones privadas del sobremesa.')
    return url


def safe_network():
    original = socket.getaddrinfo

    def resolve(host, port, *args, **kwargs):
        records = original(host, port, *args, **kwargs)
        if not records or any(not ipaddress.ip_address(r[4][0].split('%')[0]).is_global for r in records):
            raise OSError('Dirección privada o reservada: acceso bloqueado.')
        return records

    socket.getaddrinfo = resolve

    class Redirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            public_url(newurl)
            return super().redirect_request(req, fp, code, msg, headers, newurl)

    # urlopen(context=...) builds its own opener, so wrap every call explicitly.
    def open_public(url, data=None, timeout=20, *, cafile=None, capath=None, cadefault=False, context=None):
        public_url(url.full_url if isinstance(url, urllib.request.Request) else url)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), Redirect(), urllib.request.HTTPSHandler(context=context))
        return opener.open(url, data=data, timeout=timeout)

    urllib.request.urlopen = open_public


def candidate(row, source=''):
    web = str(row.get('web') or row.get('website') or '').strip()
    if web and re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', web) and not web.startswith(('http://', 'https://')):
        web = ''
    if web and not web.startswith(('http://', 'https://')):
        web = 'https://' + web
    try:
        if web:
            public_url(web)
    except ValueError:
        web = ''
    name = str(row.get('nombre') or row.get('name') or '').strip()
    address = str(row.get('direccion') or row.get('address') or '')
    city = str(row.get('municipio') or row.get('city') or '')
    key = hashlib.sha256(f'{web.lower().rstrip("/")}|{fold(name)}|{fold(address)}'.encode()).hexdigest()[:32]
    return {'id': key, 'name': name, 'web': web, 'address': address, 'city': city,
            'sourceUrl': row.get('osm') or row.get('sourceUrl') or web,
            'sourceLabel': row.get('fuente') or source or 'Fuente guardada',
            'lat': float(row['lat']) if row.get('lat') is not None else None,
            'lon': float(row['lon']) if row.get('lon') is not None else None}


def lookup(query, city, web=''):
    query, city = query.strip(), city.strip()
    if not 2 <= len(query) <= 160 or len(city) > 120:
        raise ValueError('Indica un nombre de restaurante válido.')
    known_file = CACHE.parent / 'known-webs.json'
    try:
        known = json.loads(known_file.read_text(encoding='utf-8')) if known_file.exists() else []
    except (ValueError, OSError):
        known = []
    if web:
        from report_discovery import verify_web
        if len(web) > 2048: raise ValueError('La dirección web es demasiado larga.')
        row = verify_web(query, city, web.strip(), public_url)
        known = [r for r in known if r.get('web') != row['web']] + [row]
        known_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = known_file.with_suffix('.tmp')
        tmp.write_text(json.dumps(known, ensure_ascii=False), encoding='utf-8'); tmp.replace(known_file)
        return {'candidates': [candidate(row)], 'source': 'Web indicada y comprobada', 'attribution': 'Fuente: la web del restaurante', 'sourceUrl': row['web']}
    q = re.sub(r'\b(restaurante|restaurant|el|la|los|las|de|del)\b', ' ', fold(query))
    words = q.split() or fold(query).split()
    rows = []
    # Read the source registry, never the concurrent ranking outputs.
    universe = MOTOR / 'datos' / 'indice' / 'universo.json'
    if universe.exists():
        rows = json.loads(universe.read_text(encoding='utf-8')).get('webs', [])
    rows = known + rows
    scored = []
    for row in rows:
        name = fold(row.get('nombre', ''))
        compact_name = re.sub(r'[^a-z0-9]', '', name)
        compact_query = re.sub(r'[^a-z0-9]', '', fold(query))
        score = sum(w in name for w in words) / max(1, len(words))
        if compact_query and compact_query in compact_name: score = max(score, 1)
        if fold(query) == name:
            score += 2
        if score < 0.8:
            continue
        location = fold(' '.join(str(row.get(k) or '') for k in ('municipio', 'provincia', 'direccion', 'zona_busqueda')))
        if city and not all(w in location for w in fold(city).split()):
            continue
        scored.append((score + SequenceMatcher(None, fold(query), name).ratio(), row))
    found = [candidate(row) for _, row in sorted(scored, key=lambda item: -item[0])[:8]]
    if found:
        primary = all(c['sourceLabel'] == 'Web indicada y comprobada' for c in found)
        return {'candidates': list({c['id']: c for c in found}.values()), 'source': 'Fuentes guardadas',
                'attribution': 'Fuente: la web del restaurante' if primary else 'Webs comprobadas y fuentes públicas · © Overture Maps Foundation y colaboradores de OpenStreetMap',
                **({'sourceUrl': found[0]['web']} if primary and len(found) == 1 else {})}
    # Explicit restaurant search, not autocomplete/bulk geocoding. One worker,
    # persistent cache, >1 second between calls, configurable provider URL.
    CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(f'{fold(query)}|{fold(city)}'.encode()).hexdigest()
    cached = CACHE / f'{key}.json'
    if cached.exists() and time.time() - cached.stat().st_mtime < 7 * 86400:
        return json.loads(cached.read_text(encoding='utf-8'))
    last = CACHE / 'last-request'
    if last.exists():
        time.sleep(max(0, 1.2 - (time.time() - last.stat().st_mtime)))
    endpoint = os.environ.get('STUDIO32_NOMINATIM_URL', 'https://nominatim.openstreetmap.org/search')
    public_url(endpoint)
    last.write_text('', encoding='utf-8')
    url = endpoint + '?' + urlencode({'q': f'{query} {city}', 'format': 'jsonv2', 'limit': 6, 'addressdetails': 1, 'extratags': 1, 'accept-language': 'es', 'countrycodes': 'es'})
    request = urllib.request.Request(url, headers={'User-Agent': 'Studio32RestaurantReports/1.0 (https://studio32.es; francisco@studio32.es)'})
    with urllib.request.urlopen(request, timeout=20) as response:
        results = json.loads(response.read(1_000_000))
    for r in results:
        if r.get('type') not in ('restaurant', 'fast_food', 'food_court'):
            continue
        tags, addr = r.get('extratags') or {}, r.get('address') or {}
        web = tags.get('website') or tags.get('contact:website') or ''
        found.append(candidate({'name': r.get('name') or r.get('display_name', '').split(',')[0], 'web': web,
            'address': ' '.join(str(addr.get(k) or '') for k in ('road', 'house_number')).strip(),
            'city': addr.get('city') or addr.get('town') or addr.get('village') or city,
            'sourceUrl': f"https://www.openstreetmap.org/{r['osm_type']}/{r['osm_id']}",
            'lat': r.get('lat'), 'lon': r.get('lon')}, '© colaboradores de OpenStreetMap'))
    result = {'candidates': found, 'source': 'OpenStreetMap', 'attribution': '© colaboradores de OpenStreetMap (ODbL)'}
    cached.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    return result


class NeedsReview(Exception):
    pass


def generate(business, out, report_type='diagnostico'):
    out = out.resolve()
    public_url(business['web'])
    out.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(MOTOR))
    # Prevent any model fallback, even if motor .env contains credentials.
    for key in ('OPENAI_PERMITIDO', 'DEEPSEEK_PERMITIDO', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'SERPER_API_KEY'):
        os.environ[key] = ''
    from visibilidad import auditor, ranking, hoja
    emit('progress', stage='Leyendo su web', progress=25)
    audit = auditor.auditar(business['web'], business['name'], ciudad=business.get('city') or 'Valencia', max_paginas=8)
    checks = {c['id']: c for c in audit['checks']}
    live = checks.get('web_viva', {})
    if live.get('estado') != 'ok' or 'OJO:' in str(live.get('evidencia', '')):
        raise NeedsReview('La web no responde o no coincide con el restaurante. Revisa la dirección antes de entregar el informe.')
    if any('otro negocio' in str(c.get('evidencia', '')).lower() for c in audit['checks']):
        raise NeedsReview('El motor detecta una posible web de otro negocio. Necesita revisión.')
    (out / 'auditoria.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
    emit('progress', stage='Preparando el análisis completo' if report_type=='completo' else 'Preparando el diagnóstico', progress=60)
    from report_complete import render
    html, expected_pages = render(business, audit, None, out, report_type)
    content = html.read_text(encoding='utf-8')
    # Only the canonical renderer's fixed A4 fitting script may execute.
    trusted_scripts = re.findall(r'<script\b[^>]*>.*?</script>', hoja.documento('Control', ['']), re.I | re.S)
    for trusted in trusted_scripts:
        content = content.replace(trusted, '')
    if re.search(r'<(?:script|iframe)\b|(?:src|href)=["\']\s*(?:javascript:|file:)', content, re.I):
        raise NeedsReview('El documento contiene un recurso no permitido. Necesita revisión técnica.')
    emit('progress', stage='Generando el PDF para imprimir', progress=80)
    pdf = hoja.pdf(html)
    if not pdf or not pdf.exists():
        raise RuntimeError('No se ha podido generar el PDF. Puedes reintentar el encargo.')
    import fitz
    with fitz.open(pdf) as doc:
        text = '\n'.join(p.get_text() for p in doc)
        if len(doc) != expected_pages or fold(business['name']) not in fold(text).replace('\n',' ') or ('analisis completo' if report_type=='completo' else 'diagnostico') not in fold(text):
            raise NeedsReview('La comprobación del PDF no ha pasado. Se conserva para revisar en el sobremesa.')
    data = pdf.read_bytes()
    if not data.startswith(b'%PDF-') or not 5000 < len(data) <= 20 * 1024 * 1024:
        raise RuntimeError('El PDF no tiene un tamaño o formato válido.')
    return {'pdf': str(pdf.resolve()), 'html': str(html.resolve()), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'motorVersion': ('completo-hub-2' if report_type=='completo' else 'diagnostico-hub-3') + '/' + ranking.VERSION, 'generatedAt': datetime.now(timezone.utc).isoformat(),
        'reportType': report_type, 'pages': expected_pages,
        'auditDate': audit['fecha_utc'], 'findings': [{'title': c['titulo'], 'evidence': c['evidencia']} for c in audit['checks'] if c['estado'] == 'mal'][:5]}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('mode', choices=['lookup', 'generate'])
    p.add_argument('--query', default='')
    p.add_argument('--city', default='')
    p.add_argument('--web', default='')
    p.add_argument('--report-type', choices=['diagnostico','completo'], default='diagnostico')
    p.add_argument('--candidate')
    p.add_argument('--out')
    a = p.parse_args()
    safe_network()
    try:
        result = lookup(a.query, a.city, a.web) if a.mode == 'lookup' else generate(json.loads(Path(a.candidate).read_text(encoding='utf-8')), Path(a.out), a.report_type)
        emit('result', result=result)
    except NeedsReview as e:
        emit('review', error=str(e)); return 12
    except Exception as e:
        emit('error', error=str(e)[:300]); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
