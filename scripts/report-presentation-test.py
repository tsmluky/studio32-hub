"""Report regressions: observations stay observations; no fabricated ranking or model outcome."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '../../Visibilidad-IA'))
from report_complete import render, ordered, explanation


class PresentationTests(unittest.TestCase):
    def fixture(self):
        return {'name': 'Local <script>bad()</script>', 'web': 'https://example.org/', 'city': 'València'}, {
            'fecha_utc': '2026-10-19T10:00:00Z', 'paginas': [{'url': 'https://example.org/'}],
            'checks': [
                {'id':'schema','titulo':'Schema','estado':'mal','evidencia':'Sin ficha estructurada','peso':90,'arreglo':'Añadir datos verificados.'},
                {'id':'horario','titulo':'Horario','estado':'mal','evidencia':'El lector no encontró horarios','peso':30,'arreglo':'Contrastar horarios con el dueño.'},
                {'id':'fotos','titulo':'Fotos','estado':'aviso','evidencia':'Dos imágenes sin descripción','peso':99,'arreglo':'Describir las imágenes útiles.'},
            ]}

    def test_business_priority_over_minor_technical_weight(self):
        _, a = self.fixture()
        self.assertEqual([c['id'] for c in ordered(a)], ['horario','schema','fotos'])

    def test_missing_schema_is_not_unknown_business(self):
        text = explanation({'id':'schema'})
        self.assertIn('Su ausencia no demuestra', text)
        self.assertNotIn('recomienda a otro', text)

    def test_diagnosis_has_evidence_and_no_historical_projection(self):
        b,a = self.fixture()
        with tempfile.TemporaryDirectory() as d:
            p,n = render(b,a,{'nota':99,'puesto':1},Path(d),'diagnostico')
            text=p.read_text(encoding='utf-8')
            self.assertEqual(n,1)
            self.assertIn('El lector no encontró horarios',text)
            self.assertNotIn('<script>bad()',text)
            self.assertNotIn('puesto 1',text)
            self.assertNotIn('891',text)
            self.assertNotIn('recomienda a quien sí',text)
            self.assertIn('No mide recomendaciones',text)

    def test_complete_contains_all_evidence_and_explicit_limits(self):
        b,a = self.fixture()
        with tempfile.TemporaryDirectory() as d:
            p,n = render(b,a,{},Path(d),'completo')
            text=p.read_text(encoding='utf-8')
            self.assertGreaterEqual(n,4)
            for c in a['checks']: self.assertIn(c['evidencia'],text)
            self.assertIn('No incluye un antes/después',text)
            self.assertIn('no sustituye ese expediente',text)


if __name__ == '__main__': unittest.main()
