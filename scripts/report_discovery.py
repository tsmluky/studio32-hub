"""Verify a user-supplied public business website. No search scraping or model APIs."""
from html import unescape
from html.parser import HTMLParser
import json
import re
import unicodedata
import urllib.request


def compact(value):
    value = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', value)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.title = []; self.text = []; self.title_depth = False; self.skip = 0
        self.json_blocks = []; self.json_buffer = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title': self.title_depth = True
        if tag in ('script', 'style'):
            self.skip += 1
            if tag == 'script' and attrs.get('type', '').lower() == 'application/ld+json': self.json_buffer = []

    def handle_endtag(self, tag):
        if tag == 'title': self.title_depth = False
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
            if tag == 'script' and self.json_buffer is not None:
                self.json_blocks.append(''.join(self.json_buffer)); self.json_buffer = None

    def handle_data(self, text):
        if self.title_depth: self.title.append(text)
        if self.json_buffer is not None: self.json_buffer.append(text)
        if not self.skip: self.text.append(text)


def nodes(value):
    if isinstance(value, dict):
        yield value
        for k in ('@graph', 'mainEntity', 'department', 'location'):
            yield from nodes(value.get(k))
    elif isinstance(value, list):
        for item in value: yield from nodes(item)


def verify_web(query, city, web, validate):
    validate(web)
    req = urllib.request.Request(web, headers={'User-Agent': 'Studio32RestaurantReports/1.0 (https://studio32.es; francisco@studio32.es)'})
    with urllib.request.urlopen(req, timeout=20) as response:
        final_url = validate(response.geturl())
        if response.headers.get_content_type() not in ('text/html', 'application/xhtml+xml'):
            raise ValueError('Indica la portada de la web del restaurante, no un PDF u otro archivo.')
        raw = response.read(2_000_001)
        if len(raw) > 2_000_000: raise ValueError('La portada supera el límite de lectura. Revisa la web indicada.')
        html = raw.decode(response.headers.get_content_charset() or 'utf-8', errors='replace')
    return business_from_html(query, city, final_url, html)


def business_from_html(query, city, web, html):
    page = Page(); page.feed(html)
    title = unescape(' '.join(page.title)).strip()
    structured = []
    for block in page.json_blocks:
        try: structured.extend(nodes(json.loads(block)))
        except (ValueError, RecursionError): continue
    businesses = [n for n in structured if any(t in ('Restaurant', 'FoodEstablishment', 'FastFoodRestaurant', 'LocalBusiness', 'CafeOrCoffeeShop') for t in (n.get('@type') if isinstance(n.get('@type'), list) else [n.get('@type')]))]
    wanted = compact(re.sub(r'\b(restaurante|restaurant)\b', '', query, flags=re.I))
    matching = [b for b in businesses if wanted and wanted in compact(b.get('name'))]
    if not wanted or not matching and wanted not in compact(title):
        raise ValueError('El nombre no coincide con el título de esta web. Revisa el restaurante y la dirección antes de analizarlo.')
    business = matching[0] if matching else {}
    parts = [part.strip() for part in re.split(r'\s+[|–—-]\s+', title)]
    name = business.get('name') or next((p for p in parts if wanted in compact(p)), query)
    address = business.get('address') or {}
    if not isinstance(address, dict): address = {}
    text = ' '.join(page.text)
    location = address.get('addressLocality') or (city if compact(city) and compact(city) in compact(text) else '')
    return {'nombre': str(name)[:160], 'web': web, 'direccion': str(address.get('streetAddress') or '')[:240],
            'municipio': str(location)[:120], 'fuente': 'Web indicada y comprobada', 'sourceUrl': web,
            'zona_busqueda': text[:10000],
            'evidence': {'title': title[:300], 'requestedName': query, 'requestedArea': city,
                         'locationConfirmed': bool(location)}}
