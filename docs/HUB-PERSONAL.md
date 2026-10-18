# Hub personal de Studio32

Documento de definición, iniciado el 18/10/2026 con Pancho. No describe funciones ya implementadas.
Las propuestas de este documento siguen pendientes de contrastar con su uso.

## Confirmado por Pancho · 18/10/2026

- El Hub debe reunir la gestión de Studio32: negocios, clientes contratados, información,
  informes, herramientas y trabajos. El primer usuario es Pancho; puede incorporarse un comercial después.
- El móvil es el punto de acceso principal cuando está en la calle. Quiere actuar desde él,
  además de consultar información. El sobremesa encendido ejecutará los procesos.
- Los informes deben quedar organizados dentro de cada restaurante o proyecto, con su información.
- Buscar un restaurante debe aprovechar los datos e informes ya guardados. Desde su ficha quiere
  ver o descargar el Diagnóstico y el análisis completo, y pedir su generación cuando sea necesario.
- Quiere lanzar trabajos, conocer su avance y recuperar el resultado: campañas, prospección e informes.
- Evitar APIs de pago. Las gratuitas se pueden usar dentro de sus condiciones y cupos;
  reutilizar información disponible y evitar repetir trabajo.
- Prospección es una parte útil del Hub actual: pedir campaña, revisar y enviar.
- Quiere poder ejecutar la skill de prospección desde el móvil. Modificar la configuración del
  mailing desde ahí también le interesa, pero no lo fija como requisito inmediato.
- Proyectos, Biblioteca, Inbox y Tareas apenas se usan hoy. No asumir que deben ser la navegación futura.
- Biblioteca se había imaginado como información propia y marcadores útiles; su encaje queda por definir.
- El alta de asistente interesa, pero el formulario actual resulta complejo y abrir otra página molesta.
  No hay todavía requisitos para rehacerlo.
- No tiene una rutina de calendario establecida ni una elección cerrada para la pantalla inicial.
- Empezar por lo que va a utilizar ahora y ampliar con el uso; el objetivo es entender y gestionar
  el trabajo real de Studio32 desde una interfaz cuidada.

## Base existente, revisada en el repositorio

- El Hub tiene Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca y Herramientas.
- Herramientas contiene Prospección. El modelo de miembros sigue incluyendo a tres personas.
- La maqueta de Visibilidad-IA propone Hoy, Restaurantes, Rutas y Trabajos. No equivale a una integración.
- El Hub usa Supabase; el estado general vive en `hub_states`, y prospección en tablas propias.
- Las convenciones exigen RLS y tablas propias para historiales y datos que crecen.
- No se ha comprobado en esta definición el estado de producción, los permisos reales ni los cupos disponibles.

## Segunda ronda · búsqueda, hallazgos e IA local

### Confirmado por Pancho · 18/10/2026

- La entrada habitual es el nombre del restaurante. La zona y la web pueden ayudar, pero el usuario
  no debería tener que investigar y rellenar toda la ficha. Quiere construir una base reutilizable de locales.
- Al encontrarlo quiere el Diagnóstico, su posición y sus oportunidades de mejora reales.
- La prioridad debe reflejar la gravedad: problemas de seguridad por delante de detalles menores.
  El texto alternativo de una foto no debe presentarse con la misma importancia que un problema serio.
- Quiere aprovechar el sistema existente de campañas, Supabase y ejecución en el ordenador.
- Quiere utilizar IA alojada en su PC para analizar fichas y producir informes evitando saldo de DeepSeek.

### Comprobaciones de código y equipo

- `src/CampaignRequest.tsx` y `src/outreach.ts`: el formulario guarda la campaña con estado `pedida`.
- `scripts/outreach.mjs` dirige la lectura de pendientes y la importación de resultados;
  `scripts/import-outreach.mjs` guarda leads y mensajes en Supabase y pasa la campaña a `abierta`.
- `.claude/commands/prospectar.md` describe la generación local mediante Claude Code.
  El formulario por sí solo no arranca ese trabajo. No se ha probado la recogida automática en producción.
- `visibilidad/auditor.py` ya descarga y comprueba webs sin API de IA.
- `visibilidad/ficha.py` extrae datos estructurados y usa IA para interpretar texto, con citas verificadas por código.
- `visibilidad/dolores.py` ya separa dolores de detalles técnicos y usa prioridades numéricas;
  esto es una base para revisar, no una validación de impacto comercial ni una escala de seguridad.
- Equipo comprobado: i7-7800X, unos 32 GB de RAM y GTX 1080 con 8 GB de VRAM.
  Ollama instalado, API local sin responder al consultar; no se ha arrancado ningún servicio.
  Hay manifiestos de `llama3:latest`, `deepseek-coder:6.7b` y `nomic-embed-text:latest`;
  su presencia no prueba integridad de pesos, calidad ni rendimiento.

### Propuesta de comportamiento

- Buscar primero por nombre en los datos propios. Ante homónimos, ofrecer dirección/zona
  para elegir el local; no asociar automáticamente una web solo por parecido del nombre.
- Si no existe, localizar candidatos en fuentes disponibles y gratuitas, verificar identidad
  y guardar procedencia y fecha. SQL consulta lo guardado; hace falta una capa distinta para descubrirlo.
- La base inicial de OpenStreetMap y el estudio regional no contienen todos los locales.
- La posición es la del índice Studio32 y su conjunto de comparación con fecha;
  no presentarla como puesto real en ChatGPT ni como ranking de todos los restaurantes.
- Propuesta de prioridad: seguridad confirmada, impedimentos para consultar/contactar/reservar,
  problemas de información esencial e idiomas, y detalles técnicos. Revisar casos concretos.
- Gravedad, evidencia y esfuerzo se muestran por separado. Un hallazgo dudoso requiere comprobación;
  no convertir una sospecha en una alerta crítica. Evitar prometer ventas perdidas o mejoras de ranking.
- El diagnóstico puede indicar que no hay problemas importantes; no forzar una venta en todos los locales.

### Prueba local sugerida antes de elegir modelo

Usar textos ya guardados y datos comprobados de tres fichas existentes, sin nuevas llamadas de pago.
Ejecutar extracción por fragmentos, validar citas y comparar datos, omisiones y contradicciones.
Medir tiempo y memoria. Generar el PDF con las plantillas del motor; no pedir al modelo que invente una auditoría.
No usar una respuesta local como medición de lo que recomienda ChatGPT.

Primera decisión técnica pendiente: comprobar qué modelo local da calidad suficiente en este equipo.
No se ha descargado ningún modelo ni realizado inferencia en esta ronda.

## Tercera ronda · asistente de gestión dentro del Hub

### Confirmado por Pancho · 18/10/2026

- Quiere incorporar un asistente virtual de gestión dentro del Hub.
- Quiere enviar notas de audio desde el teléfono para registrar lo hablado y crear citas o visitas.
- Confirma que el asistente responde por escrito: no necesita voz de salida ni conversacion de voz en directo.
- Señala como base el agente de recepción y reservas de Studio32 y pide aprovecharlo.
- El proveedor de IA queda pendiente: menciona OpenAI, DeepSeek o alojamiento local.
  Esta conversación no activa APIs de pago ni el servicio existente.

### Revisión del agente existente

Fuente canónica: repo `studio32-agent`; consultados AGENTS.md, `.ai/STATE.md`, `.ai/CONVENTIONS.md`
y el código. No se ha comprobado el despliegue actual; el estado local está fechado el 01/10.
Pancho indica que el agente está funcionando. La revisión aquí acredita piezas de código reutilizables.

- `src/orchestrator.js`: bucle de conversación y herramientas, historial, control humano,
  protección contra mensajes duplicados y comprobación de confirmaciones de citas.
- `src/tools/index.js`: consultar disponibilidad y agenda, crear/mover/cancelar citas,
  registrar leads y derivar a humano. Son acciones del negocio receptor, no la gestión de Studio32.
- `src/llm.js` y `src/providers/openai.js`: proveedor simulado o cliente compatible con OpenAI,
  con endpoint y modelo configurables. No hay adaptador local validado en esta revisión.
  La exigencia de clave, los parámetros y los tiempos actuales requieren revisar compatibilidad.
- Hay metadatos de audio en un canal WhatsApp; no se encontró un recorrido de transcripción
  en `src/`. Hace falta grabación/subida desde el Hub y transcripción para alimentar el agente.
- La memoria y las herramientas actuales tienen contratos por tenant y control humano que se deben preservar.

### Propuesta de integración

Reutilizar el núcleo mediante un perfil de gestión y herramientas propias, manteniendo una fuente
de código compartida. No crear una copia independiente del agente de recepción.
Las visitas comerciales de Studio32 no se guardan automáticamente como reservas de un restaurante o clínica.
El almacenamiento de esa agenda y su relación con el calendario del Hub quedan por concretar.

Recorrido: audio en Hub → transcripción → interpretación → herramienta autorizada → resultado
guardado → respuesta con enlace a la ficha, visita o informe correspondiente.

Primeras acciones candidatas:

- Encontrar/abrir un negocio y consultar sus documentos.
- Registrar una nota de visita y vincularla al negocio.
- Programar una visita o seguimiento, resolviendo fecha, hora y contacto cuando hagan falta.
- Pedir un Diagnóstico al trabajador y consultar su estado; responder «encargado» mientras se genera.

El asistente y los botones deben usar las mismas operaciones y permisos. Confirmar éxito solo
después de la escritura o ejecución real. Evitar duplicar citas al reenviar audio o reintentar.
Propuesta: registrar notas y ejecutar acciones internas bien definidas con poco roce; preguntar
cuando falten datos o haya ambigüedad. La política exacta de confirmación sigue pendiente.

### Elección de modelos pendiente

La transcripción y el razonamiento/uso de herramientas son tareas distintas. Se propone evaluar
transcripción local (por ejemplo Whisper/faster-whisper) y un modelo local con llamada a herramientas.
El soporte de Ollama para herramientas no demuestra que cualquier modelo instalado las use bien.
Validar comprensión de fechas, elección de negocio, selección de herramientas y latencia antes de elegir.
No hay llamadas de pago ni cambio automático a un proveedor externo al fallar el local.

CLAUDE.md menciona ensayos locales para fichas en otras sesiones: coordinar la selección y los recursos
antes de descargar modelos o poner pruebas concurrentes a competir por la GPU.

Ensayo preparado el 18/10: `docs/ASISTENTE-LOCAL.md`, evaluador de 13 peticiones ficticias y lanzador
`scripts/probar-asistente-local.ps1`. Candidato Qwen3.5 4B; alternativa Qwen3 4B; transcripcion candidata
Whisper small en CPU. Son propuestas sin resultado de calidad: Windows tenia el compromiso de memoria
casi agotado por otro proceso. Se detuvo el servidor propio; no se descargaron modelos ni se hizo inferencia.

Actualizacion, 18/10 al liberar recursos: Qwen3.5 4B descargado y probado en la GTX 1080 por CUDA 12.
Primera tanda 11/13, mediana 1,67 s; con instrucciones explicitas, 11/13 tras corregir un falso fallo
del evaluador. No basta el prompt para impedir inventar una hora o elegir sucursal. Preparada politica
separada en `scripts/asistente-policy.cjs` (8 pruebas), pendiente de integracion real.
Proveedor canonico agregado en `studio32-agent` (124 pruebas correctas). Dos ensayos reales del modelo
con respuestas ficticias de herramientas completan consulta de informe y nota+visita. Sin escrituras reales.
Detalle, limites y comandos en `docs/ASISTENTE-LOCAL.md`; voz de entrada y UI aun pendientes.

## Propuesta inicial, todavía por validar

### Primer recorrido completo

Buscar un restaurante → identificar la ficha correcta → abrir los documentos disponibles
o pedir uno → ver el trabajo → revisar el resultado → registrar la visita y el siguiente paso.

La ficha reúne contacto, web, documentos con fecha y versión, situación comercial,
notas, trabajos y próxima acción. El detalle exacto se definirá con Pancho.

La misma ficha puede empezar como negocio por visitar y pasar a cliente contratado,
conservando su historial. No dar de alta dos veces el mismo negocio.

### Pantallas candidatas

- Inicio: resultados listos, situaciones que requieren atención, seguimientos y trabajos en marcha.
- Negocios: búsqueda y fichas, inicialmente centradas en restaurantes.
- Herramientas: pedir informes y campañas mediante formularios propios de cada herramienta.
- Actividad: cola, avance, fallos y resultados de los trabajos.

Son agrupaciones para probar en una maqueta, no una navegación aprobada. Pendientes y próximas
acciones pueden salir del trabajo registrado, sin obligar a mantener otro tablero a mano.

### Conexión con el sobremesa

Extender el patrón ya existente de campañas: el Hub guarda una petición autenticada en una cola;
un trabajador del sobremesa la recoge, ejecuta una operación permitida y publica estado y resultado.
Es posible diseñarlo sin abrir una API pública directamente al ordenador. Falta concretar la
ejecución desatendida, la toma exclusiva de trabajos, su recuperación y el seguimiento.

Los documentos ya publicados deberían poder consultarse aunque el sobremesa esté apagado;
los trabajos nuevos quedarían pendientes y la interfaz mostraría la última conexión conocida.
Esto no implica todavía soporte del móvil sin conexión a Internet.

Una skill contiene instrucciones: para ejecutarla desde un botón hay que identificar su motor,
herramientas, autenticación y condiciones de uso. El botón no aporta por sí solo esa capacidad.
No se presupone que una suscripción pueda convertirse en una API o servicio desatendido.

Una petición repetida debe recuperar el trabajo existente cuando corresponda. Mostrar fecha
y procedencia de los datos; actualizar debe ser una acción diferenciada de abrir un informe guardado.
Definir cómo recuperar trabajos interrumpidos antes de poner el trabajador en marcha.

### Primera entrega sugerida

Probar el recorrido de búsqueda y consulta con los restaurantes e informes existentes.
Después conectar una generación real de Diagnóstico y su seguimiento en el sobremesa.
Mantener el comportamiento de envío de correo fuera de esta primera integración.

## Siguiente ronda

1. Contrastar una ficha móvil y el acceso al asistente por texto/audio con un recorrido concreto.
2. Precisar cómo se guardan las visitas y seguimientos, y cuándo se pide confirmación.
3. Cuándo le basta el informe guardado y cuándo necesita una medición nueva.

Después: maqueta móvil con ese recorrido, ajustes de Pancho e implementación por recorridos completos.
Presupuesto, permisos de futuros usuarios y alcance del alta de asistentes quedan para rondas posteriores.
