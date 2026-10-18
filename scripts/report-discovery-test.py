import unittest
from report_discovery import business_from_html, compact

class WebsiteDiscoveryTests(unittest.TestCase):
    def test_real_spelling_and_punctuation(self):
        html='<title>Inicio - Asier\'s Burger Route - Hamburguesería en el Cabanyal</title><p>Carrer del Dr. Lluch 249, Valencia</p>'
        b=business_from_html('Asiers burger','Valencia','https://example.org/',html)
        self.assertEqual(b['nombre'],"Asier's Burger Route")
        self.assertEqual(b['municipio'],'Valencia')
        self.assertEqual(b['direccion'],'') # Never invent an address from a query.
    def test_wrong_business_is_rejected(self):
        with self.assertRaisesRegex(ValueError,'nombre no coincide'):
            business_from_html('Asiers burger','Valencia','https://example.org/','<title>Otro restaurante</title><p>Valencia</p>')
    def test_structured_address_is_read_from_source(self):
        html='''<title>Inicio</title><script type="application/ld+json">{"@graph":[{"@type":"Restaurant","name":"Prueba Uno","address":{"streetAddress":"Calle Real 23","addressLocality":"Madrid"}}]}</script>'''
        b=business_from_html('Prueba Uno','Madrid','https://example.org',html)
        self.assertEqual((b['direccion'],b['municipio']),('Calle Real 23','Madrid'))
    def test_unconfirmed_location_stays_empty(self):
        b=business_from_html('Prueba Uno','Barcelona','https://example.org','<title>Prueba Uno</title>')
        self.assertEqual(b['municipio'],'');self.assertFalse(b['evidence']['locationConfirmed'])
    def test_script_text_does_not_confirm_location(self):
        b=business_from_html('Prueba Uno','Barcelona','https://example.org','<title>Prueba Uno</title><script>window.track="Barcelona";</script>')
        self.assertEqual(b['municipio'],'')

if __name__=='__main__':unittest.main()
