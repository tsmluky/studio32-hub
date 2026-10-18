# Prueba del asistente local

18/10/2026. Entrada por texto o nota de audio y respuesta escrita. Sin sintesis de voz.
No esta conectado al Hub ni ejecuta operaciones reales.

## Candidatos iniciales

| Tarea | Candidato | Motivo de la prueba |
|---|---|---|
| Entender peticiones y elegir herramientas | Qwen3.5 4B en Ollama, Q4_K_M | Soporte de herramientas; descarga actual de unos 4 GB con componentes de vision. Se prueba solo texto |
| Alternativa mas ligera | Qwen3 4B en Ollama, Q4_K_M | Soporte de herramientas; unos 2,5 GB de descarga |
| Transcribir notas en espanol | Whisper small mediante faster-whisper, CPU int8 | Separar la transcripcion de la carga de la grafica; calidad y tiempo pendientes |

El tamano de descarga no es el consumo de RAM/VRAM de ejecucion. Estos son candidatos,
no una seleccion basada en resultados del equipo. No se promete que baste el modelo pequeno.

Fuentes primarias consultadas:

- https://ollama.com/library/qwen3.5:4b
- https://ollama.com/library/qwen3:4b
- https://huggingface.co/Qwen/Qwen3.5-4B
- https://docs.ollama.com/api/chat
- https://github.com/SYSTRAN/faster-whisper

## Primer intento: recursos insuficientes

- Ollama 0.34.4 instalado; GTX 1080 de 8 GB y 31,68 GiB de RAM.
- El servidor de prueba arranco en 127.0.0.1:11435, con nube desactivada y contexto de 4096.
  El log detecto la GTX 1080 mediante Vulkan. No demuestra rendimiento de inferencia.
- Windows fallo al iniciar otra consola por memoria virtual insuficiente. Se detuvo solo el
  arbol del servidor creado para esta prueba. No se modifico paginacion ni ningun proceso ajeno.
- Lectura posterior: 50,36 GiB de limite de compromiso y entre 0,03 y 0,18 GiB de margen.
  Otro proceso Python tenia unos 25,78 GiB privados. Su trabajo no se ha identificado ni detenido.
  RAM fisica libre y margen de compromiso son medidas distintas; habia RAM libre pero el compromiso estaba agotado.
- No se descargo el modelo, no se hizo inferencia ni se transcribio audio.
- El evaluador y su lanzador se prepararon para probar cuando haya margen.

## Prueba real del 18/10, 11:56–12:20

Al volver a comprobar habia 16,6 GiB de RAM y 21,7 GiB de compromiso libres. Se descargo
`qwen3.5:4b` en el almacen de X:, sin APIs de pago. Ollama uso CUDA 12 para la GTX 1080;
su API informo 3.130.009.844 bytes de modelo en VRAM, con contexto 4096. No es una medida del pico total de GPU.

| Ensayo | Resultado |
|---|---|
| Primera tanda, 13 casos con instrucciones base | 11/13; mediana 1,67 s; primera carga 19,8 s |
| Segunda tanda, instrucciones mas explicitas | 11/13 tras corregir un falso fallo del evaluador; mediana 1,73 s; maximo 7,36 s |
| Adaptador canonico: pedir documento, recibir resultado ficticio y devolver enlace | Correcto; 9,55 s incluyendo carga |
| Adaptador canonico: nota y visita, con politica y resultados ficticios | Correcto; 11,5 s incluyendo carga |

En la primera tanda el modelo eligio una sucursal sin preguntar; en la segunda pidio elegirla
pero invento las 10:00 cuando no se habia indicado hora. El otro fallo de la segunda tanda fue
pedir solo la nota en la primera respuesta de una orden doble. Una primera respuesta no prueba
que el bucle vaya a omitir la segunda accion: el ensayo con continuacion del adaptador completo ambas.
No interpretar estas cifras como fiabilidad en produccion o en audio real.

Se corrigio el evaluador para aceptar una peticion explicita de aclaracion sin signo de interrogacion.
El JSON original y su reevaluacion se conservan por separado; no hubo una tercera inferencia para esa correccion.

`scripts/asistente-policy.cjs` valida las propuestas contra negocio, fecha, hora y zona ya resueltos
por el servidor, una seleccion o una confirmacion. No acepta esos valores como "verificados" por el modelo.
Rechaza negocio ambiguo y hora ausente, y normaliza una hora sin offset solo si coincide con el
instante verificado en la zona indicada. Devuelve el plan normalizado entero o ninguna accion;
no ejecuta ni persiste nada. Ocho pruebas correctas. Falta conectarlo a las herramientas reales del Hub,
resolver el contexto verificado y asegurar autorizacion, deduplicacion y persistencia.

En `studio32-agent` se agrego proveedor local opt-in, sin cambiar defaults, control humano ni store.
Suite completa 124/124. La prueba del adaptador carga solo ese modulo canonico, no reservas ni credenciales.
El servidor propio se detuvo al finalizar cada ensayo. La captura/transcripcion de audio sigue pendiente.

## Prueba lista para ejecutar

Desde la raiz del repo, en Windows PowerShell:

```powershell
.\scripts\probar-asistente-local.ps1
```

Alternativa mas ligera:

```powershell
.\scripts\probar-asistente-local.ps1 -Modelo qwen3:4b
```

Otros ensayos, usando el modelo ya descargado:

```powershell
.\scripts\probar-asistente-local.ps1 -InstruccionesEstrictas
.\scripts\probar-asistente-local.ps1 -SoloAdaptador
.\scripts\probar-asistente-local.ps1 -PlanMultiple
node --test scripts/asistente-policy.test.cjs
```

Los ensayos del adaptador requieren los repos `studio32-hub` y `studio32-agent` como hermanos.

El lanzador necesita Python accesible con `py -3` y Ollama en PATH. Comprueba recursos antes de
arrancar o descargar. El umbral de 8 GiB comprometibles libres y 4 GiB de RAM libre es un margen
conservador del ensayo, no un requisito oficial del modelo.
Arranca un servicio propio y oculto en 11435, descarga solo el modelo elegido si falta,
ejecuta la evaluacion y detiene solo su arbol al terminar. Conserva los modelos en el almacen
ya configurado de Ollama. No cambia variables persistentes ni toca el servicio habitual en 11434.
Si el puerto de prueba ya esta ocupado, se detiene sin modificar su servicio.

Resultados y logs: `.local/asistente/` (ya ignorada por `.gitignore`).
No subirlos automaticamente ni confundir su estado de bloqueo con una nota de calidad del modelo.

## Que mide

`scripts/evaluar-asistente-local.py` plantea 13 instrucciones en espanol, con negocios ficticios:

- abrir un informe guardado sin regenerarlo;
- pedir un Diagnostico o completo nuevo;
- entender manana y el proximo jueves con hora de Madrid;
- preguntar cuando falta la hora o hay dos negocios con el mismo nombre;
- buscar un negocio desconocido sin inventar su identificador;
- guardar una nota sin crear una visita no solicitada;
- consultar un trabajo y pedir dos acciones juntas;
- ignorar instrucciones citadas del contenido de una web.

Comprueba herramientas y argumentos de la primera respuesta. No las ejecuta. Registra tiempo,
respuesta original, digest del modelo y fallos; interrumpe ante errores de infraestructura.
La deteccion automatica de aclaraciones comprueba signos o peticiones explicitas, no que su contenido sea correcto:
las respuestas necesitan revision humana. Esta evaluacion no mide transcripcion, dialogos de varios turnos,
persistencia, autorizacion, rendimiento sostenido ni el recorrido completo del Hub.

Comprobaciones sin modelo:

```powershell
py -3 scripts/evaluar-asistente-local.py --inventory
py -3 scripts/evaluar-asistente-local.py --self-check
```

Codigo de salida: evaluador 0 (pasan los casos), 1 (fallos del modelo), 2 (infraestructura);
lanzador 3 (recursos insuficientes antes de arrancar).

## Siguiente verificacion

Conectar al Hub el proveedor y la politica ya preparados, con ficha y contexto verificados, y probar
la escritura en un entorno separado. El modelo es candidato para un flujo controlado; los datos criticos
no pueden depender solo de sus instrucciones. Evaluar notas de voz reales en espanol, incluidos nombres
de locales, ruido de calle y fechas. Sin APIs de pago ni sustitucion automatica al fallar.
