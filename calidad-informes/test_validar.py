import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from validar import BLOCKS, VERSION, seal, sha, validate


class QualityContract(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.now = datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
        self.statement = 'El domingo aparecen dos horas de cierre distintas.'
        (self.root / 'informe.html').write_text('<h1>Local Ejemplo</h1><p>' + self.statement + '</p>', encoding='utf-8')
        (self.root / 'home.txt').write_text('Domingo de 12:00 a 24:00', encoding='utf-8')
        (self.root / 'contacto.txt').write_text('Viernes a domingo de 12:00 a 01:00', encoding='utf-8')
        sources = []
        for sid, filename, quote in [('home', 'home.txt', 'Domingo de 12:00 a 24:00'),
                                     ('contacto', 'contacto.txt', 'Viernes a domingo de 12:00 a 01:00')]:
            sources.append({'id': sid, 'url': 'https://example.com/' + sid,
                            'fecha': self.now.isoformat(), 'archivo': filename,
                            'sha256': sha((self.root / filename).read_bytes()),
                            'cita': quote, 'metodo': 'html', 'sede': 'valencia'})
        self.packet = {'version': VERSION, 'negocio': {'id': 'ejemplo', 'nombre': 'Local Ejemplo', 'sede': 'valencia'},
            'documento': {'archivo': 'informe.html', 'sha256': sha((self.root / 'informe.html').read_bytes()), 'tipo': 'completo'},
            'cobertura': {k: {'estado': 'completo', 'detalle': 'Revisión sintética para prueba de contrato'} for k in BLOCKS},
            'recorrido': {'skill': 'restaurante-ia/2026-10-19', 'reglas': VERSION, 'codigo': 'fixture', 'metodos': ['html']},
            'fuentes': sources, 'hallazgos': [{
                'id': 'horario', 'titulo': 'Cierre del domingo', 'sede': 'valencia', 'ambitos': ['uso', 'seo'],
                'estado': 'contradiccion', 'campo': 'horario', 'afirmacion': self.statement,
                'interpretacion': 'Las páginas discrepan; falta confirmar el horario correcto.',
                'fuentes': ['home', 'contacto'], 'necesidad': 'Planificar una visita el domingo',
                'prioridad': 'P1', 'motivo_prioridad': 'Dos horas incompatibles para una visita.',
                'accion': 'Confirmar el cierre del domingo y unificar portada y página de contacto.',
                'responsable': 'Dueño confirma; técnico modifica',
                'aceptacion': 'Ambas páginas y una lectura nueva muestran el cierre confirmado.',
                'resultado': 'conflicto', 'metodo': 'html', 'resolucion': 'propuesto',
                'observaciones': [{'fuente': 'home', 'campo': 'horario', 'valor': '24:00'},
                                  {'fuente': 'contacto', 'campo': 'horario', 'valor': '01:00'}]}]}

    def run_packet(self):
        return validate(self.packet, self.root, self.now)

    def codes(self):
        return {x['code'] for x in self.run_packet()['errores']}

    def approve(self):
        self.packet['revision'] = {'manifiesto_sha256': seal(self.packet),
            'documento_sha256': self.packet['documento']['sha256'], 'persona': 'Revisor de prueba',
            'fecha': self.now.isoformat(), 'contenido': True, 'identidad': True, 'visual': True}

    def test_valid_draft_is_not_human_approved(self):
        r = self.run_packet()
        self.assertTrue(r['borrador_valido'])
        self.assertFalse(r['listo_para_entregar'])

    def test_review_binds_exact_artifacts(self):
        self.approve()
        self.assertTrue(self.run_packet()['listo_para_entregar'])
        self.packet['hallazgos'][0]['interpretacion'] = 'Texto editado después del visto bueno'
        self.assertFalse(self.run_packet()['listo_para_entregar'])

    def test_report_changed_after_review(self):
        self.approve()
        (self.root / 'informe.html').write_text('<h1>Local Ejemplo</h1>Informe sustituido', encoding='utf-8')
        self.assertIn('HASH_DOCUMENTO', self.codes())

    def test_claim_must_be_in_final_report(self):
        self.packet['hallazgos'][0]['afirmacion'] = 'Una afirmación que el PDF no contiene'
        self.assertIn('AFIRMACION_DOCUMENTO', self.codes())

    def test_source_changed(self):
        (self.root / 'home.txt').write_text('Domingo de 12:00 a 24:00. Fuente cambiada.', encoding='utf-8')
        self.assertIn('HASH_FUENTE', self.codes())

    def test_fabricated_quote(self):
        self.packet['fuentes'][0]['cita'] = 'Horario de domingo inventado'
        self.assertIn('CITA', self.codes())

    def test_cross_branch_source(self):
        self.packet['fuentes'][0]['sede'] = 'madrid'
        self.assertIn('SEDE', self.codes())

    def test_cross_branch_finding(self):
        self.packet['hallazgos'][0]['sede'] = 'madrid'
        self.assertIn('SEDE', self.codes())

    def test_missing_reference(self):
        self.packet['hallazgos'][0]['fuentes'].append('no-existe')
        self.assertIn('REFERENCIA', self.codes())

    def test_conflict_requires_two_distinct_sources(self):
        self.packet['hallazgos'][0]['observaciones'][1]['fuente'] = 'home'
        self.assertIn('CONTRADICCION', self.codes())

    def test_conflict_requires_distinct_values(self):
        self.packet['hallazgos'][0]['observaciones'][1]['valor'] = '24:00'
        self.assertIn('CONTRADICCION', self.codes())

    def test_unknown_is_not_failure(self):
        self.packet['hallazgos'][0].update(estado='desconocido', resultado='fallo', alcance_busqueda='HTML de cuatro páginas')
        self.assertIn('DESCONOCIDO', self.codes())

    def test_unknown_with_scope_is_preserved(self):
        self.packet['hallazgos'][0].update(estado='no_encontrado', resultado='pendiente', alcance_busqueda='HTML de cuatro páginas')
        self.assertTrue(self.run_packet()['borrador_valido'])

    def test_schema_cannot_be_urgent_on_its_own(self):
        self.packet['hallazgos'][0].update(estado='observado', campo='schema')
        self.assertIn('GRAVEDAD', self.codes())

    def test_viewport_does_not_prove_mobile_task(self):
        self.packet['hallazgos'][0].update(estado='observado', campo='movil', metodo='viewport', resultado='tarea_superada')
        self.assertIn('METODO', self.codes())

    def test_http_is_not_user_load(self):
        self.packet['hallazgos'][0].update(estado='observado', campo='rendimiento', metodo='http', resultado='carga_superada')
        self.assertIn('METODO', self.codes())

    def test_unknown_external_absence(self):
        self.packet['hallazgos'][0].update(estado='observado', resultado='ausencia_global')
        self.assertIn('AUSENCIA_GLOBAL', self.codes())

    def test_projected_ranking_is_blocked(self):
        self.packet['hallazgos'][0]['tipo_afirmacion'] = 'ranking_proyectado'
        self.assertIn('PROMESA', self.codes())

    def test_generic_action(self):
        self.packet['hallazgos'][0]['accion'] = 'Añadir SEO'
        self.assertIn('ACCION', self.codes())

    def test_proposal_is_not_resolved(self):
        self.packet['hallazgos'][0]['resolucion'] = 'verificado'
        self.assertIn('CIERRE_NO_VERIFICADO', self.codes())

    def test_historical_sources_cannot_ship_as_current(self):
        self.approve()
        self.packet['fuentes'][0]['fecha'] = (self.now - timedelta(hours=25)).isoformat()
        self.approve()
        r = self.run_packet()
        self.assertTrue(r['borrador_valido'])
        self.assertFalse(r['listo_para_entregar'])

    def test_future_source(self):
        self.packet['fuentes'][0]['fecha'] = (self.now + timedelta(seconds=1)).isoformat()
        self.assertIn('FECHA', self.codes())

    def test_denominator_keeps_unknowns(self):
        self.packet['medicion'] = dict(aciertos=24, fallos=0, abstenciones=0, no_evaluables=24, total=24, necesidades=8, idiomas=6)
        self.assertIn('DENOMINADOR', self.codes())

    def test_correct_denominator(self):
        self.packet['medicion'] = dict(aciertos=24, fallos=0, abstenciones=0, no_evaluables=24, total=48, necesidades=8, idiomas=6)
        self.assertNotIn('DENOMINADOR', self.codes())

    def test_boolean_does_not_validate_improvement(self):
        self.packet['mejora'] = True
        self.assertIn('MEJORA', self.codes())

    def test_canonical_rejection_is_preserved(self):
        self.packet['mejora'] = True
        def reject(slug):
            raise ValueError('Experimento sin referencia independiente')
        r = validate(self.packet, self.root, self.now, improvement_gate=reject)
        self.assertIn('MEJORA', {x['code'] for x in r['errores']})

    def test_missing_seo_block(self):
        del self.packet['cobertura']['seo_tecnico']
        self.assertIn('COBERTURA', self.codes())

    def test_unexecuted_huella_is_visible_and_blocks_release(self):
        self.packet['cobertura']['huella'] = {'estado': 'no_ejecutado', 'detalle': 'No existe colector'}
        self.approve()
        r = self.run_packet()
        self.assertTrue(r['borrador_valido'])
        self.assertFalse(r['listo_para_entregar'])
        self.assertTrue(any('huella' in x for x in r['avisos']))

    def test_path_escape(self):
        self.packet['fuentes'][0]['archivo'] = '../outside.txt'
        self.assertIn('FUENTE', self.codes())

    def test_malformed_packet_fails_closed(self):
        self.assertFalse(validate([], self.root, self.now)['borrador_valido'])
        self.packet['fuentes'] = None
        self.assertIn('FORMATO', self.codes())

    def test_neighborhood_variant_false_positive(self):
        title = 'Local Ejemplo Restaurante - Cocina gastronómica en el Cabañal'
        (self.root / 'home.txt').write_text(title, encoding='utf-8')
        self.packet['fuentes'][0].update(cita=title, sha256=sha((self.root / 'home.txt').read_bytes()))
        self.packet['hallazgos'][0].update(estado='observado', campo='titulo',
            ausencias_afirmadas=[{'concepto': 'ubicacion', 'variantes': ['Valencia', 'Cabanyal', 'Cabañal']}])
        self.assertIn('AUSENCIA_CONTRADICHA', self.codes())

    def test_city_is_already_in_title(self):
        title = 'Local Ejemplo • Mar, Vinos y Cocktails en Valencia'
        (self.root / 'home.txt').write_text(title, encoding='utf-8')
        self.packet['fuentes'][0].update(cita=title, sha256=sha((self.root / 'home.txt').read_bytes()))
        self.packet['hallazgos'][0].update(estado='observado', campo='titulo',
            ausencias_afirmadas=[{'concepto': 'ciudad', 'variantes': ['valencia']}])
        self.assertIn('AUSENCIA_CONTRADICHA', self.codes())

    def test_pdf_format_does_not_prove_unreadability(self):
        self.packet['hallazgos'][0]['tipo_afirmacion'] = 'pdf_ilegible_por_formato'
        self.assertIn('PROMESA', self.codes())

    def test_web_texts_are_not_independent_customer_reviews(self):
        self.packet['hallazgos'][0]['tipo_afirmacion'] = 'patron_clientes'
        self.assertIn('HUELLA_PATRON', self.codes())

    def test_two_fragments_of_same_review_are_not_a_pattern(self):
        self.packet['hallazgos'][0]['tipo_afirmacion'] = 'patron_clientes'
        for source in self.packet['fuentes']:
            source.update(tipo='resena', resena_id='same-review', autor='same-author')
        self.assertIn('HUELLA_PATRON', self.codes())

    def test_independent_reviews_can_support_pattern_after_human_review(self):
        self.packet['hallazgos'][0]['tipo_afirmacion'] = 'patron_clientes'
        for i, source in enumerate(self.packet['fuentes']):
            source.update(tipo='resena', resena_id=f'review-{i}', autor=f'author-{i}')
        self.assertNotIn('HUELLA_PATRON', self.codes())

    def test_truthy_string_is_not_a_human_approval(self):
        self.approve()
        self.packet['revision']['visual'] = 'no'
        self.assertFalse(self.run_packet()['listo_para_entregar'])


if __name__ == '__main__':
    unittest.main()
