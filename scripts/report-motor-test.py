import importlib.util
from pathlib import Path
import socket
import unittest
spec=importlib.util.spec_from_file_location('adapter',Path(__file__).with_name('report-motor.py'))
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)

class NetworkTests(unittest.TestCase):
    def test_reject_internal_urls(self):
        for url in ['file:///etc/passwd','http://localhost','https://pc.local','http://example.com:4311','https://user:pass@example.com']:
            with self.subTest(url=url),self.assertRaises(ValueError):adapter.public_url(url)
    def test_connection_rejects_private_ips(self):
        original=socket.getaddrinfo
        try:
            adapter.safe_network()
            for host in ['127.0.0.1','::1','192.168.1.1','169.254.169.254']:
                with self.subTest(host=host),self.assertRaises(OSError):socket.getaddrinfo(host,80)
        finally:socket.getaddrinfo=original
    def test_candidates_normalize_and_block_private_protocols(self):
        c=adapter.candidate({'nombre':'Prueba','web':'file:///secret','lat':'39.4','lon':'-0.3'})
        self.assertEqual(c['web'],'');self.assertEqual(c['lat'],39.4)
        self.assertEqual(c['id'],adapter.candidate({'nombre':'Prueba','web':'file:///secret','lat':39.4,'lon':-.3})['id'])

if __name__=='__main__':unittest.main()
