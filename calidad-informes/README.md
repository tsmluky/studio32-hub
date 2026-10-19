# Calidad de informes · herramientas internas

Contrato y cobertura: repo `Visibilidad-IA`, `CALIDAD-INFORMES.md` y `RECORRIDO-INFORMES.md`. Evidencias privadas fuera de Git. Este directorio no forma parte del frontend ni ejecuta campañas. No modifica las colas ni los informes ya publicados.

- El dictamen con páginas y fuentes está en el repo privado `Visibilidad-IA`, `REVISION-INFORMES-2026-10-19.md`. No publicar nombres ni pruebas de negocios aquí.
- `PORTADO-HUELLA.md`: origen de la skill de Claude, consumidores actuales y portado por capacidades.
- `validar.py`: contrato ejecutable sin red ni llamadas a modelos.
- `test_validar.py`: regresiones de procedencia, sedes, contradicciones, promesas, métodos, cobertura, desconocidos, huella y aprobación.
- `preparar_revision.py`: ejemplo interno reproducible a partir de dos páginas guardadas de un caso privado. Se detiene si ya no encuentra las citas esperadas; no sirve para horarios arbitrarios.

Desde la raíz del Hub, usando el Python del motor (ajustar ruta relativa si los repos no son hermanos):

```powershell
$pythonMotor = '../../Visibilidad-IA/.venv/Scripts/python.exe'
& $pythonMotor -m unittest discover -s calidad-informes -p 'test_*.py' -v
& $pythonMotor calidad-informes/preparar_revision.py --motor-root ../../Visibilidad-IA --out .local/quality-reports/ejemplo --slug $slugDelCaso
& $pythonMotor calidad-informes/validar.py .local/quality-reports/ejemplo/expediente-ejemplo.json
& $pythonMotor calidad-informes/validar.py .local/quality-reports/ejemplo/expediente-ejemplo.json --entrega
```

El ejemplo es formalmente válido como revisión documental y **no apto para entrega comercial actual**: un hallazgo histórico, cobertura parcial, sin aprobación del completo. El último comando debe devolver **3**. Un error de contrato devuelve **2**; un borrador válido devuelve **0** sin `--entrega`. El JSON explica los motivos. Para mejoras, `--motor-root` conecta `visibilidad.validacion.entrega.obtener`, que revalida el expediente canónico; un booleano no sirve.

La revisión humana se vincula al hash de documento y al sello `seal(packet)` que incluye fuentes, afirmaciones y versiones. Cambiar cualquiera invalida la revisión. Es una constancia local de revisión, no una firma digital ni un sistema de permisos. No se crea un comando para aprobar automáticamente.

El validador verifica lo declarado: bytes/citas, referencias, sede, estados y coherencia de métodos. No comprende toda la prosa ni acredita que una fuente corresponda semánticamente a una afirmación. Las ausencias necesitan variantes declaradas; las frases no estructuradas siguen requiriendo revisión. V1 admite observaciones/propuestas; no puede aprobar arreglos ya aplicados. Falta adaptar capturas/salidas del motor al contrato y conectar esta puerta antes de `publish`. No confundir estos tests con una recertificación de los tres PDF históricos.
