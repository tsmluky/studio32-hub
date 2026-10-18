# Restaurante nuevo → diagnóstico en el teléfono

Implementado el 18/10/2026. Cliente pendiente de publicar en hub.studio32.es y aceptar desde teléfono físico/4G.

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
Puede faltar el local o su web; no inventa datos. PDF de la misma versión reutilizado siete días. Caducar no borra
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
con copia local; resultado final conservado. Sin mensajes ni visitas. Pendiente publicación y aceptación física.

```powershell
node scripts/probar-informes-remotos.mjs
node node_modules/supabase/dist/supabase.js db query --linked --file scripts/report-security-test.sql -o json
..\..\Visibilidad-IA\.venv\Scripts\python scripts/report-motor-test.py
npx tsc --noEmit
npm run build:static
```
