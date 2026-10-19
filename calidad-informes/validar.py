"""Offline quality contract v1. No network, model calls or publication side effects.

Verifies explicit provenance/coherence, not semantic truth. Human review is separate.
Paths in a packet are relative to its directory. CLI: python validar.py packet.json.
"""
import argparse
import hashlib
import html
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

VERSION = 'calidad-informes/1'
BLOCKS = {'identidad', 'seo_tecnico', 'seo_contenido', 'idiomas', 'schema',
          'lectura_ia', 'huella', 'movil', 'rendimiento_accesibilidad', 'exterior', 'seguridad'}
STATES = {'observado', 'contradiccion', 'no_encontrado', 'desconocido', 'hipotesis'}
STAGES = {'completo', 'parcial', 'no_ejecutado', 'no_aplica'}
CRITICAL = {'horario', 'precio', 'contacto', 'seguridad'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def seal(packet):
    """Review must bind report AND manifest, including evidence/claims/method versions."""
    return sha(json.dumps({k: v for k, v in packet.items() if k != 'revision'},
                          sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode())


def moment(value):
    d = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if d.tzinfo is None:
        raise ValueError('Fecha sin zona horaria')
    return d.astimezone(timezone.utc)


def norm(value):
    return ' '.join(str(value).split())


def searchable(value):
    return unicodedata.normalize('NFKD', norm(value)).encode('ascii', 'ignore').decode().casefold()


def local(root, name):
    p = (root / name).resolve()
    if Path(name).is_absolute() or not p.is_relative_to(root):
        raise ValueError('Ruta fuera del expediente')
    return p


def read_text(path):
    if path.suffix.lower() == '.pdf':
        import fitz
        with fitz.open(path) as doc:
            return '\n'.join(p.get_text() for p in doc)
    text = path.read_text(encoding='utf-8')
    if path.suffix.lower() in {'.html', '.htm'}:
        text = re.sub(r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>', ' ', text, flags=re.S | re.I)
        text = html.unescape(re.sub('<[^>]+>', ' ', text))
    return text


def validate(packet, root, now=None, improvement_gate=None):
    """Return formal errors separately from reasons barring release of a valid draft."""
    root = Path(root).resolve()
    now = now or datetime.now(timezone.utc)
    errors, hold, warnings = [], [], []
    def error(code, detail):
        errors.append({'code': code, 'detail': detail})
    def require(obj, fields, label):
        for key in fields:
            if not obj.get(key):
                error('CAMPO', f'{label}: falta {key}')
    if not isinstance(packet, dict):
        return {'version': VERSION, 'errores': [{'code': 'FORMATO', 'detail': 'Se requiere un objeto'}],
                'avisos': [], 'bloqueos_entrega': [], 'borrador_valido': False, 'listo_para_entregar': False}
    try:
        if packet.get('version') != VERSION:
            error('VERSION', 'Contrato no reconocido')
        business = packet.get('negocio', {})
        require(business, ['id', 'nombre', 'sede'], 'negocio')
        report = packet.get('documento', {})
        require(report, ['archivo', 'sha256', 'tipo'], 'documento')
        doc_text = ''
        try:
            p = local(root, report.get('archivo', ''))
            if sha(p.read_bytes()) != report.get('sha256'):
                error('HASH_DOCUMENTO', 'Los bytes del informe han cambiado')
            doc_text = norm(read_text(p))
            if norm(business.get('nombre', '')) not in doc_text:
                error('IDENTIDAD_DOCUMENTO', 'El documento no identifica el negocio')
        except (OSError, ValueError, ImportError, RuntimeError) as exc:
            error('DOCUMENTO', str(exc))
        if report.get('tipo') != 'completo':
            hold.append('Es una revisión/borrador, no un completo entregable')
        coverage = packet.get('cobertura', {})
        if BLOCKS - coverage.keys():
            error('COBERTURA', 'Faltan bloques: ' + ', '.join(sorted(BLOCKS - coverage.keys())))
        for key, block in coverage.items():
            if block.get('estado') not in STAGES or not block.get('detalle'):
                error('COBERTURA', f'{key}: estado o explicación ausentes')
            if block.get('estado') in {'no_ejecutado', 'parcial'}:
                warnings.append(f'{key}: {block.get("estado")} — {block.get("detalle")}')
            if block.get('estado') == 'no_ejecutado':
                hold.append(f'Bloque requerido no ejecutado: {key}')
        pipeline = packet.get('recorrido', {})
        require(pipeline, ['skill', 'reglas', 'codigo', 'metodos'], 'recorrido')
        sources = packet.get('fuentes', [])
        evidence, source_dates = {}, {}
        for source in sources:
            sid = source.get('id')
            require(source, ['id', 'url', 'fecha', 'archivo', 'sha256', 'cita', 'metodo', 'sede'], 'fuente')
            if sid in evidence:
                error('ID_DUPLICADO', str(sid))
            if not re.match(r'^https?://[^/\s]+', str(source.get('url', ''))):
                error('URL', str(sid))
            if source.get('sede') != business.get('sede'):
                error('SEDE', f'{sid}: otra sede')
            evidence[sid] = source
            try:
                source_dates[sid] = moment(source['fecha'])
                if source_dates[sid] > now:
                    error('FECHA', f'{sid}: fecha futura')
                p = local(root, source['archivo'])
                if sha(p.read_bytes()) != source['sha256']:
                    error('HASH_FUENTE', str(sid))
                if len(norm(source['cita'])) < 12 or norm(source['cita']) not in norm(read_text(p)):
                    error('CITA', f'{sid}: cita no encontrada o insuficiente')
            except (KeyError, OSError, ValueError, ImportError, RuntimeError) as exc:
                error('FUENTE', f'{sid}: {exc}')
        findings = packet.get('hallazgos', [])
        if not findings:
            error('HALLAZGOS', 'Falta contenido verificado, incluidas fortalezas cuando proceda')
        ids = set()
        for f in findings:
            fid = f.get('id', '?')
            require(f, ['id', 'titulo', 'sede', 'ambitos', 'estado', 'afirmacion', 'interpretacion',
                        'fuentes', 'necesidad', 'prioridad', 'motivo_prioridad', 'accion',
                        'responsable', 'aceptacion', 'campo', 'resultado', 'metodo'], str(fid))
            if fid in ids:
                error('ID_DUPLICADO', str(fid))
            ids.add(fid)
            if f.get('sede') != business.get('sede'):
                error('SEDE', str(fid))
            if f.get('estado') not in STATES or f.get('prioridad') not in {'P0', 'P1', 'P2', 'P3'}:
                error('ESTADO', str(fid))
            if not set(f.get('ambitos', [])) <= {'seo', 'lectura_ia', 'uso', 'seguridad'}:
                error('AMBITO', str(fid))
            if norm(f.get('afirmacion', '')) not in doc_text:
                error('AFIRMACION_DOCUMENTO', f'{fid}: no está en el documento final')
            refs = f.get('fuentes', [])
            if any(s not in evidence for s in refs):
                error('REFERENCIA', str(fid))
            for absence in f.get('ausencias_afirmadas', []):
                if not absence.get('concepto') or not absence.get('variantes'):
                    error('AUSENCIA', f'{fid}: ausencia sin concepto/variantes')
                elif any(searchable(term) in searchable(evidence[s]['cita'])
                         for term in absence['variantes'] for s in refs if s in evidence):
                    error('AUSENCIA_CONTRADICHA', f'{fid}: {absence["concepto"]} está en la cita')
            if f.get('estado') == 'contradiccion':
                observations = f.get('observaciones', [])
                values = {o.get('valor') for o in observations}
                if (len(values) < 2 or len({o.get('fuente') for o in observations}) < 2 or
                        any(o.get('fuente') not in refs or o.get('campo') != f.get('campo') for o in observations)):
                    error('CONTRADICCION', f'{fid}: exige dos fuentes/valores del mismo campo')
            if f.get('estado') in {'no_encontrado', 'desconocido'}:
                if f.get('resultado') != 'pendiente' or not f.get('alcance_busqueda'):
                    error('DESCONOCIDO', f'{fid}: desconocido no es fallo ni cero')
            if f.get('estado') == 'hipotesis' and f.get('resultado') != 'pendiente':
                error('HIPOTESIS', str(fid))
            if f.get('campo') in {'schema', 'llms_txt', 'copyright'} and f.get('prioridad') in {'P0', 'P1'}:
                error('GRAVEDAD', f'{fid}: señal aislada no justifica urgencia')
            if f.get('campo') == 'movil' and f.get('metodo') == 'viewport' and f.get('resultado') == 'tarea_superada':
                error('METODO', f'{fid}: viewport no es prueba de tarea')
            if f.get('campo') == 'rendimiento' and f.get('metodo') == 'http' and f.get('resultado') == 'carga_superada':
                error('METODO', f'{fid}: petición HTTP no es carga del usuario')
            if f.get('resultado') == 'ausencia_global':
                error('AUSENCIA_GLOBAL', str(fid))
            if f.get('resolucion', 'pendiente') not in {'pendiente', 'propuesto'}:
                error('CIERRE_NO_VERIFICADO', f'{fid}: v1 solo admite diagnóstico y propuestas')
            if len(norm(f.get('accion', ''))) < 35 or len(norm(f.get('aceptacion', ''))) < 25:
                error('ACCION', f'{fid}: acción/cierre insuficientes')
            if f.get('tipo_afirmacion', 'observacion') in {'ranking_proyectado', 'causalidad_ventas', 'ia_universal', 'pdf_ilegible_por_formato'}:
                error('PROMESA', str(fid))
            if f.get('tipo_afirmacion') == 'patron_clientes':
                reviews = [evidence[s] for s in refs if s in evidence and evidence[s].get('tipo') == 'resena']
                if (len({s.get('resena_id') for s in reviews if s.get('resena_id')}) < 2 or
                        len({s.get('autor') for s in reviews if s.get('autor')}) < 2):
                    error('HUELLA_PATRON', f'{fid}: requiere reseñas/autores independientes y trazables')
            ttl = 24 if f.get('campo') in CRITICAL else 168
            if any(s in source_dates and (now - source_dates[s]).total_seconds() > ttl * 3600 for s in refs):
                hold.append(f'{fid}: recontrastar evidencias antes de entrega (máximo {ttl} h)')
        measurement = packet.get('medicion')
        if measurement is not None:
            keys = ['aciertos', 'fallos', 'abstenciones', 'no_evaluables', 'total', 'necesidades', 'idiomas']
            if any(type(measurement.get(k)) is not int or measurement[k] < 0 for k in keys):
                error('DENOMINADOR', 'Recuentos enteros no negativos obligatorios')
            elif (sum(measurement[k] for k in keys[:4]) != measurement['total'] or
                  measurement['total'] != measurement['necesidades'] * measurement['idiomas']):
                error('DENOMINADOR', 'Total, cobertura y respuestas no concuerdan')
        if packet.get('mejora'):
            if improvement_gate is None:
                error('MEJORA', 'Requiere revalidación canónica, un booleano no es prueba')
            else:
                try:
                    improvement_gate(business['id'])
                except Exception as exc:
                    error('MEJORA', str(exc))
        review = packet.get('revision', {})
        if (review.get('manifiesto_sha256') != seal(packet) or review.get('documento_sha256') != report.get('sha256')
                or not review.get('persona') or not review.get('fecha')
                or not all(review.get(k) is True for k in ['contenido', 'visual', 'identidad'])):
            hold.append('Falta revisión humana de contenido, identidad y aspecto ligada al manifiesto y PDF/HTML exactos')
        else:
            try:
                reviewed = moment(review['fecha'])
                if reviewed > now or (now - reviewed).total_seconds() > 86400:
                    hold.append('Revisión humana futura o caducada')
            except ValueError:
                error('REVISION', 'Fecha de revisión inválida')
    except (AttributeError, KeyError, TypeError, ValueError) as exc:
        error('FORMATO', str(exc))
    return {'version': VERSION, 'errores': errors, 'avisos': warnings,
            'bloqueos_entrega': hold, 'borrador_valido': not errors,
            'listo_para_entregar': not errors and not hold}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('expediente', type=Path)
    parser.add_argument('--entrega', action='store_true')
    parser.add_argument('--motor-root', type=Path, help='Revalidar mejoras con el motor canónico local')
    args = parser.parse_args()
    gate = None
    if args.motor_root:
        import sys
        sys.path.insert(0, str(args.motor_root.resolve()))
        from visibilidad.validacion.entrega import obtener
        gate = lambda slug: obtener(slug, root=args.motor_root)
    try:
        packet = json.loads(args.expediente.read_text(encoding='utf-8'))
        result = validate(packet, args.expediente.parent, improvement_gate=gate)
    except (OSError, ValueError) as exc:
        result = {'errores': [{'code': 'EXPEDIENTE', 'detail': str(exc)}], 'listo_para_entregar': False}
    print(json.dumps(result, ensure_ascii=True, indent=2))
    raise SystemExit(2 if result['errores'] else (3 if args.entrega and not result['listo_para_entregar'] else 0))


if __name__ == '__main__':
    main()
