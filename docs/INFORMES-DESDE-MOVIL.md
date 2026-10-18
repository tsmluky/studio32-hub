# Restaurante nuevo → diagnóstico en el teléfono

Implementado y publicado el 18/10/2026 en hub.studio32.es con autorización de Pancho.
Cloudflare Pages correcto y assets públicos comprobados. Pendiente aceptación desde teléfono físico/4G.

## Uso

Mi estudio → Prepara tu próxima visita → nombre/ciudad → confirmar nombre, dirección y web → preparar diagnóstico.
El encargo persiste al salir. Encargos recientes recupera búsquedas y errores. Descargar PDF o ver para imprimir.
Si el PC está apagado, los nuevos encargos esperan; los PDF subidos siguen accesibles con sesión Studio32.

## Resultado y límites

Diagnóstico de **una página A4**, con plantilla/fuentes/firma del motor. Auditoría actual de hasta ocho páginas;
sin modelos ni APIs de pago. Conserva auditoría original, comprueba disponibilidad/identidad básica, formato,
tamaño, una página, nombre y texto del PDF. Revisión humana antes de entregar: no sustituye revisar hallazgos.
Web sospechosa o caída queda en necesita revisión. El cierre sigue NEGOCIO.md del 18/10, sin prometer una web nueva.
No genera análisis completo, web nueva ni mediciones nuevas de recomendaciones de IA.

Nota y zona usan la referencia activa del motor: 891 webs en la prueba. El índice nuevo de Claude es otro frente.
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
  Sin service_role en navegador. Voz, notas, visitas y conversación siguen locales.

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
