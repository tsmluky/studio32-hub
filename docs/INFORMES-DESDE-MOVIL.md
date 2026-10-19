# Restaurante nuevo → informes y asistente en el teléfono

Implementado y publicado el 18/10/2026 en hub.studio32.es con autorización de Pancho.
Cloudflare Pages correcto y assets públicos comprobados. Pancho confirmó el recorrido desde su teléfono el 19/10. Red 4G e impresión no especificadas.

## Uso

Mi estudio → Negocios → nombre/ciudad → confirmar nombre, dirección y web → elegir diagnóstico o análisis completo.
Para locales ya guardados, «Pedir completo» en Tus informes. También puedes pedirlo al asistente seleccionando el negocio.
El encargo persiste al salir. Encargos recientes recupera búsquedas y errores. Descargar PDF o ver para imprimir.
Si el PC está apagado, los nuevos encargos esperan; los PDF subidos siguen accesibles con sesión Studio32.

## Resultado y límites

Diagnóstico de **una página A4**, con plantilla/fuentes/firma del motor. Auditoría actual de hasta ocho páginas;
sin modelos ni APIs de pago. Conserva auditoría original, comprueba disponibilidad/identidad básica, formato,
tamaño, una página, nombre y texto del PDF. Revisión humana antes de entregar: no sustituye revisar hallazgos.
Web sospechosa o caída queda en necesita revisión. El cierre sigue NEGOCIO.md del 18/10, sin prometer una web nueva.
El análisis completo usa las mismas evidencias actuales y añade todos los checks (también los correctos), prioridades,
soluciones y fuentes. Usa el diseño A4 del motor, comprobando el número de páginas. No genera web nueva,
antes/después ni pruebas en seis idiomas. Esas mediciones no se simulan: el PDF explica su alcance.
La caché distingue tipo de informe y versión del renderizador.

Desde la revisión del 19/10, las plantillas nuevas del Hub no muestran nota, puesto ni cifras del índice histórico: su validez es otro frente. Presentan las comprobaciones automáticas y sus límites, sin inferir resultados de modelos a partir de etiquetas técnicas.
Busca primero en datos/indice/universo.json, más amplio que las fichas preparadas. Fallback Nominatim/OpenStreetMap
para restaurantes en España: búsqueda explícita, caché persistente siete días, identificación/atribución y
separación superior a un segundo. La [política pública](https://operations.osmfoundation.org/policies/nominatim/)
exige caché, identificación, atribución y máximo global de una petición/segundo; prohíbe autocomplete y extracción
sistemática. Endpoint STUDIO32_NOMINATIM_URL configurable; revisar proveedor al crecer el equipo/volumen.
Puede faltar el local o su web; no inventa datos. En ese caso permite indicar una web pública: el PC comprueba
el nombre contra su título o datos estructurados antes de devolver un candidato seleccionable. Dirección/ciudad
no confirmadas quedan vacías; no se inventan coordenadas. La web verificada se guarda en `.local/report-worker/known-webs.json`
para futuras búsquedas. No integra un buscador general de Internet ni garantiza encontrar cualquier negocio solo por nombre.
PDF de la misma versión reutilizado siete días. Caducar no borra
documentos; no hay todavía archivo/borrado automático ni control de cuotas Storage. Usa capacidad Supabase existente.

## Arquitectura y permisos

Teléfono autenticado → RPC/cola Supabase → worker saliente PC → motor aislado → bucket privado → registro → descarga
firmada de dos minutos. Sin puertos nuevos. Miembros/roles existentes conservados.

- ops_report_jobs: propietario individual; documentos/heartbeat compartidos solo por workspace Studio32.
- Navegador: consulta y RPC de encargo. No reclama trabajos, publica ni suplanta propietarios. RLS y grants explícitos.
- Lease 90 s renovada cada 20; recuperación tras caída, máximo tres interrupciones, un trabajo activo global.
  Reserva caducada no publica; idempotencia por usuario/request_key.
- Archivos inmutables por lease; DB publicada después de subir. Fallo de red ambiguo puede dejar un objeto privado
  huérfano: no se borra un documento que quizá quedó publicado.
- Python sin claves heredadas ni APIs de modelos; bloqueo de conexiones/redirecciones a IP privadas/reservadas y
  protocolos no públicos. Solo script fijo de ajuste A4 de la plantilla.
- Publicado: sesión Supabase real/RLS. Preview: pasarela de sesión loopback y propietario configurado.
  Sin service_role en navegador. Voz, notas, visitas y conversación remotas usan la cola independiente descrita abajo.

## Operación y prueba

Migración 20261018190000_ops_report_journey.sql aplicada al Supabase del Hub, validada primero con rollback.
No se ejecutó el resto de migraciones. scripts/configurar-informes-remotos.mjs usa Supabase CLI autenticada y
escribe archivos ignorados: .local/report-worker/worker.env (privado, solo PC) y .env.local (cliente público).
Nunca imprime claves; no sincronizar la credencial privada al portátil.

Abrir mi estudio incluye worker configurado. Detener mi estudio cierra solo sus procesos registrados.
Worker independiente: `node scripts/report-worker.mjs`. No hay tarea Windows nueva: tras reiniciar hay que arrancarlo.
No toca NBA. Logs en .local/report-worker/worker.log; entrada/auditoría/HTML/PDF por UUID en jobs/.

Probado Unsushi sin ficha preparada: selección a 375 px, encargo Supabase, auditoría real PC, PDF A4 de una página,
subida privada y descarga idéntica por SHA-256/tamaño. PDF renderizado/revisado. Ensayos propios anteriores retirados
con copia local; resultado final conservado. Sin mensajes ni visitas. Publicado; pendiente aceptación física.

```powershell
node scripts/probar-informes-remotos.mjs
node node_modules/supabase/dist/supabase.js db query --linked --file scripts/report-security-test.sql -o json
..\..\Visibilidad-IA\.venv\Scripts\python scripts/report-motor-test.py
..\..\Visibilidad-IA\.venv\Scripts\python scripts/report-discovery-test.py
npx tsc --noEmit
npm run build:static
```

## Corrección y prueba con sesión real del Hub público

La primera publicación no había probado de extremo a extremo la UI autenticada: la pasarela local usaba otro
RPC con privilegios de servicio. No equivalía a validar la sesión pública. Pancho cuestionó esta confianza.

En su sesión pública se reprodujo la búsqueda «Asiers burger» sin resultados. La web existe, pero no estaba
en las fuentes consultadas. Se añadió la continuación por web, sin depender de scraping de buscadores que
pueden bloquear o restringir su uso. RPC autenticada nueva `ops_enqueue_lookup_web`; migración aditiva aplicada.
El subproceso conserva los bloqueos de IP privada/protocolos y no recibe claves del worker.

Prueba real a 375 px: búsqueda vacía → web indicada → nombre comprobado → selección → encargo desde el cliente
público → PC genera PDF nuevo (sin caché) → Storage → enlace y botón de descarga del navegador. Resultado Asiers,
384.741 bytes, SHA-256 idéntico. PDF A4 de una página revisado visualmente. Evidencia local en
`.local/report-worker/authenticated-e2e.json` y `produccion-asiers-descargado.pdf`.

Worker detenido antes de enviar otra búsqueda: encargo en cola conservado al salir de la pantalla, completado
al reiniciar el worker. PDF ya existente descargado mientras estaba detenido. Evidencia `recovery-test.json`.
La caída en mitad de una auditoría activa no quedó ensayada: terminó antes de poder interrumpirla.
Las leases tienen validación SQL, pero no se presenta ese caso como probado en un proceso real.

Más y Herramientas ahora abren herramientas dentro del mismo entorno. Prospección carga sus datos al abrirse;
campañas e historial de 274 correos comprobados. No se envió, aprobó, descartó ni cambió el envío automático.
Aceptación desde Safari/Chrome del teléfono físico e impresión en papel siguen pendientes.


## Asistente desde la sesión publicada

`ops_assistant_jobs`: RPC autenticada con operaciones permitidas, límite cinco pendientes e idempotencia por usuario.
`ops_assistant_threads`: snapshots acotados, con RLS por propietario (no se comparten conversaciones entre comerciales).
`ops_assistant_workers`: disponibilidad real del servicio, modelo y voz. No usa `hub_states.payload`.
`node scripts/assistant-worker.mjs`: saliente e independiente del worker de informes; Qwen3.5 4B en 11435.
SQLite separado por UUID de propietario en `.local/cloud-agent/`; logs en `worker.log`.
Lease 90 segundos renovada cada 20, publicación atómica con comprobación de lease y máximo tres recuperaciones.
Mensajes iniciales y respuesta final publicados por separado. Un informe encargado devuelve tarjeta de progreso, no un PDF ficticio.
El catálogo del asistente remoto sale de los documentos compartidos del workspace; no expone rutas locales.
Los enlaces privados se firman con la sesión del navegador. Confirmar notas/visitas sigue siendo una acción explícita y editable.
No envía campañas ni hace reservas a clientes.

Audio de hasta 60 segundos/8 MB: bucket privado `studio32-audio`, prefijo del propietario, RPC comprueba la ruta;
Whisper local → borrador editable. No envía el texto automáticamente y no genera voz de respuesta.
El worker borra su archivo temporal y el objeto de Storage después del intento de transcripción.
Los objetos que se suban y no lleguen a encolarse por cierre del navegador pueden necesitar limpieza manual;
no se ha añadido una política global de borrado. Texto y conversaciones conservados, sin política de retención automática todavía.

Migración aditiva `20261018230000_ops_assistant_complete.sql`, validada con rollback antes de aplicarla.
Prueba de permisos adicional: `scripts/assistant-security-test.sql` (rollback).
El arranque controlado incluye ambos workers; tras reiniciar Windows sigue siendo necesario abrir Mi estudio.
No se ha instalado una tarea de arranque ni cambiado servicios del sistema.


### Evidencia pública del completo y asistente (18/10, noche)

Asiers solicitado por texto desde la sesión pública a 375 px: respuesta del agente → tarjeta de encargo
→ PC generó un PDF nuevo → subida privada → botón Descargar PDF. 11 páginas A4, los 27 títulos de checks
conservados, 626.486 bytes. SHA-256 del botón y del enlace firmado devuelto por el agente idénticos a Storage.
Encargo `389661a6-d72b-48dd-bcab-0469242fc89b`; evidencia ignorada `assistant-complete-e2e.json`.
No es una simulación de proveedor: respondió Qwen local. Primera respuesta general ~13 s; encargo del completo ~10 s de asistente y ~13 s de motor en este caso; no son un SLA.

Audio sintético español adjuntado en la UI pública, transcrito por Whisper en PC, devuelto sin enviar al modelo.
El nombre propio se transcribió mal; se corrigió en el borrador antes de enviarlo y el agente recuperó el completo
guardado mediante enlace privado funcional. Confirmada la eliminación del objeto de audio y archivo temporal.
Propuesta de nota creada por la UI, editable y descartada: no se guardó una nota ni una visita real.
Falta la voz real de Pancho, permisos del micrófono del móvil y prueba física de descarga/impresión.

Pedido directo «Pedir completo» de Unsushi desde la biblioteca pública, sin asistente: encargo `15ad0060-8350-4791-9268-925dabd1a49a`, auditoría/PDF nuevos, progreso observado y documento disponible al volver tras cambiar de pantalla.


## Revisión del 19/10: teléfono, Xaruga y fallos encontrados

Pancho confirmó diagnóstico y completo descargables desde su teléfono, incluyendo un restaurante nuevo: Xaruga.
Se contrastaron sus encargos y originales: 23 s diagnóstico/13 s completo desde encolado hasta publicación, ambos
al primer intento y sin caché. PDFs 1/11 A4, 27 checks y estados coincidentes; tamaño/SHA-256 verificados.

Se detectaron dos problemas reales. Los procesos estaban parados con registro obsoleto: restaurados; el lanzador
ahora recupera ausentes y conserva los sanos. `probar-recuperacion-arranque.ps1` detiene únicamente la interfaz
registrada, prueba recuperación y verifica que cuatro procesos y una segunda apertura no cambien sus PID.
No se ha instalado una tarea de Windows: después de reiniciar el PC hay que abrir Mi estudio.

Los textos heredados del motor afirmaban comprensión/recomendación a partir de señales técnicas y proyectaban
puestos del índice histórico. Nuevas plantillas aisladas (`report_complete.py`, ambos tipos) muestran observaciones,
evidencias, interpretación prudente y soluciones propuestas. No dan esos puestos, porcentajes ni resultados no medidos.
Prioridad de información útil y fallos de acceso por delante de detalles menores; se evita repetir idiomas entre prioridades.
Versiones `diagnostico-hub-3` y `completo-hub-2`; los PDF antiguos quedan conservados. Biblioteca: último PDF por negocio/tipo.
El control de entrega comercial de `visibilidad/completo.py` permanece intacto; la auditoría automática del Hub no lo sustituye.

Repetición real desde UI pública a 375 px, con servicios restaurados: nombre → selección → diagnóstico nuevo,
completo pedido al modelo local → subida privada → descarga por botón y enlaces de sesión. 14/10 s de cola+motor
para los informes de esta ronda; respuesta del modelo puede añadir tiempo. 245.589/470.571 bytes, hashes idénticos.
Antes/después, recomendación y calidad de los detectores no se dan por validados porque termine un PDF.

Pruebas repetibles añadidas:

```powershell
..\..\Visibilidad-IA\.venv\Scripts\python scripts/report-presentation-test.py
node node_modules/supabase/dist/supabase.js db query --linked --file scripts/report-resilience-test.sql -o json
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/probar-recuperacion-arranque.ps1
```

La prueba SQL usa transacción y rollback: lease expirada de ambas colas, reserva nueva, rechazo de publicación vieja,
finalización única y máximo tres interrupciones. No equivale a matar un worker durante una auditoría en producción.
La prueba del lanzador sí detiene y recupera la interfaz real, manteniendo los trabajadores.
Evidencia privada local en `.local/report-worker/qa-2026-10-19/verification.json` y
`.local/operations/recuperacion-verificada.json`; no se suben audios, claves, PDFs ni datos a Git.
