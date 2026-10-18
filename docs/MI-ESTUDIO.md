# Mi estudio · primer recorrido integrado

18 de octubre de 2026. Primera fase local, ampliada con informes remotos y publicada en `hub.studio32.es`.

## Abrir y detener

Doble clic en **`Abrir mi estudio.cmd`**, en la raíz del Hub. Arranca los servicios en segundo plano
y abre `http://127.0.0.1:4310/mesa.html`. Para cerrarlos: **`Detener mi estudio.cmd`**. Los datos se conservan.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/iniciar-mi-estudio.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/iniciar-mi-estudio.ps1 -Detener
```

Necesita Node con `node:sqlite` (probado con 24.19), dependencias del Hub, `py -3`, Ollama y `qwen3.5:4b`
ya descargado. Comprueba memoria/puertos y cierra solo sus procesos, por PID y hora de arranque.
No modifica variables de entorno del usuario ni toma servicios ajenos.

Voz instalada en este equipo. Para reconstruirla en otro checkout:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/instalar-voz-local.ps1
```

Entorno separado y Whisper small; versiones probadas en `scripts/voice-requirements.lock.txt`.
PyAV 16.1.0 fijado porque PyAV 19 eliminó un argumento usado por faster-whisper 1.2.1.
Sin APIs de transcripción. Fuente técnica: [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

## Recorrido disponible

- **Mi mesa:** negocios, PDF existentes, últimos documentos, visitas y encargos.
- **Negocios:** búsqueda por nombre o zona, ficha, fuente/fecha, auditoría, PDF, notas y asistente.
  Lectura actual: 8 fichas y 8 PDF reales. Sin muestras inventadas ni nuevas mediciones del motor.
- **Seguridad:** evidencia guardada de enlaces ocultos con fecha y páginas afectadas; no afirma su estado actual.
- **Asistente:** proveedor canónico `studio32-agent/src/providers/ollama.js`; Qwen puede encadenar búsqueda y PDF
  y reunir propuestas de nota/visita. Conversación general y por negocio. Recibe extractos limitados de notas
  confirmadas y visitas. Historial y catálogo del prompt acotados.
- **Audio:** grabación de hasta 60 segundos o adjunto → Whisper CPU int8 → texto editable → envío separado.
  Sin voz de salida. Copia temporal eliminada al terminar o fallar la transcripción.
- **Guardado:** formulario de revisión, hora de visita explícita en España peninsular, validación fuera del modelo,
  transacción e idempotencia. La hora queda vacía para evitar confirmar una invención. Completar visitas desde la agenda.
- **Actividad:** cola local, respuesta/error visible y recuperación tras reinicio. No envía mensajes ni reserva citas de clientes.

La app autenticada tiene entrada **Mi estudio** y retorno a las herramientas previas. La preview local usa el mismo
componente sin cargar credenciales de Supabase ni simular una sesión. `static/mesa.html` es de desarrollo y no entra
en el build público. Auth y permisos existentes permanecen en el recorrido autenticado.

## Datos y límites

Lectura de `datos/fichas/`, `datos/auditorias/`, `datos/seguridad/` y PDF del repo hermano `Visibilidad-IA`.
Raíz opcional `STUDIO32_MOTOR_ROOT`. No modifica el motor. El worker importa sus módulos en un subproceso aislado. Los PDF previos se sirven por catálogo,
sin ruta arbitraria. Los datos personales del Hub viven en **`.local/operations/operations.sqlite`**, con WAL;
fuera de Git y `hub_states.payload`. Copia coherente: detener y copiar `.local/operations` completa.

Servicios: Vite 4310, gestión 4311 y Ollama 11435. Solo loopback. Sesión aleatoria por arranque,
validación de Host/Origin/Fetch Metadata, sin CORS ni claves de cliente. Política en `asistente-policy.cjs`.
El servicio de gestión no importa el store del agente ni mezcla visitas propias con reservas de clientes.

**Ampliación del 18/10:** búsqueda nueva, cola Supabase, worker, Diagnóstico y descarga privada implementados y probados.
Migración aditiva aplicada y cliente publicado con autorización de Pancho. Pendiente aceptación desde teléfono físico.
Detalle: `INFORMES-DESDE-MOVIL.md`.
Voz/notas/agenda locales; prospección previa sigue en el Hub. No abre puertos ni configura asistentes de clientes.

## Verificación

- TypeScript y build estático correctos. 13 pruebas núcleo + 8 política: persistencia, idempotencia, atomicidad,
  aislamiento de encargos, herramientas encadenadas y cambios horarios de Madrid.
- Ocho comprobaciones HTTP reales: sesión, origen, PDF válido y rechazo de rutas/escrituras inválidas.
- Navegador en móvil 375 px y escritorio: búsqueda→PDF, contexto por negocio, propuesta doble con hora vacía,
  descarte y guardado/lectura de una nota de prueba. Nota retirada por ID/contenido exactos; copia local conservada.
- Audio sintético español subido desde la interfaz: ~4,15 s por la API local, texto editable enviado al asistente.
  La voz de Francisco y el micrófono físico aún requieren una prueba suya.
- Ninguna visita real ni API de pago. Pruebas de la fase local, anteriores a la integración Supabase descrita arriba.

```powershell
node --test scripts/operations-core.test.mjs scripts/asistente-policy.test.cjs
node scripts/probar-servicio-local.mjs  # servicio arrancado; no guarda notas ni visitas
npx tsc --noEmit
npm run build:static
```

Siguiente tramo: aceptar descarga/impresión desde teléfono real. Después, análisis completo e índice nuevo,
coordinado con el frente de Claude.
