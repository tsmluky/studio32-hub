# Portar Huella de Claude al recorrido de informes

19/10/2026 · alcance: reutilizar investigación verificable y personalización en auditorías. No portar automáticamente envío de campañas ni configuración de clientes.

## Origen real y contratos distintos

Origen encontrado en el escritorio: `skills/studio32-lead-prospector/SKILL.md`, `references/huella.md`, `references/huella.schema.json` y `.claude/commands/prospectar.md`. El Modo C escribe `detalle_ancla`, `voz_del_cliente`, `huecos_digitales` y `confianza`; lo consumen importador, UI y reescritor. Mantener compatibilidad con él. El schema histórico describe otra ruta. La huella de `Visibilidad-IA/visibilidad/webnueva/huella.py` es una tercera forma para premium web.

No copiar una forma sobre otra ni afirmar que una skill Markdown se ejecuta sola en Qwen. Necesita herramientas disponibles, un coordinador que haga los pasos y validadores independientes del modelo.

## Qué se conserva y qué se adapta

| Capacidad original | Portado para informes | Disponibilidad actual |
|---|---|---|
| `places_search` identifica negocios | Registro público/OSM, web indicada y verificación de sede; búsqueda web disponible al agente según entorno | Ya existe búsqueda parcial del Hub. No sustituye toda la cobertura de Places ni aporta reseñas de Google |
| `web_fetch` | Captura HTML + textos/documentos + URL/fecha/hash; navegador para rutas dinámicas | Auditor actual recupera hasta ocho páginas. Capturas/cabeceras/documentos deben incorporarse explícitamente al expediente |
| `web_search` | Búsqueda por nombre/sede/dato con fuente registrada; sin API de pago predeterminada | No hay buscador general integrado en worker. Si no está disponible, parcial; nunca simular resultado |
| Leer reseñas reales | Incorporación manual o conector autorizado, citas y autor/URL/fecha; deduplicar por reseña, no por fragmento | Sin recopilador remoto de reseñas en completo. No fabricar 15–20 para cumplir una cuota |
| Detalle ancla y fortalezas | Personalizar hallazgos y conservar lo que funciona | Se puede construir desde web verificada sin reseñas; confianza por afirmación |
| Dolor comercial | Prioridad por tarea/SEO/seguridad con prueba | No convertir juicio comercial en defecto técnico ni inferir ingresos perdidos |
| Puntuación del lead y filtro rating/email | Solo para cualificación de campañas | **No aplicar** a una auditoría pedida: un negocio sin email o con pocas reseñas puede auditarse |
| JSON importable y envío aprobado | Adaptador separado de salida, revisión humana existente | No ejecutar importador/SMTP al generar un informe |

## Contrato puente propuesto

El expediente común no reemplaza `huella` de campañas: lo referencia por ID/version y enlaza fuentes verificadas. Campos: entidad/sede, versión de origen, herramientas realmente usadas, fuentes (tipo/autor/URL/fecha/hash/cita), observaciones (afirmación, fuentes, literal/inferencia, confianza razonada), detalle propio, fortalezas y pendientes. Distinguir texto del dueño de opinión de cliente. Un patrón necesita más de una reseña independiente; una sola cita sostiene una opinión individual, no «sus clientes siempre…».

Conversión del Modo C: `detalle_ancla` → observación particular; `elogios_recurrentes` → patrón solo con sus evidencias individuales; `huecos_digitales` → candidatos a hallazgo, no fallos aprobados; `confianza.nivel` → contexto histórico, nunca prueba; `no_encontrado` → pendientes acotados. Un string «Autor · Google» sin URL/copia no permite reconstruir la fuente: debe enriquecerse o quedar como no verificado.

El validador v1 comprueba fuentes y reglas de hallazgos; **no es todavía un minero autónomo de Huella**. El primer portado correcto requiere un caso con web, uno sin reseñas y uno con sedes múltiples; comprobar preservación de citas, abstención, aislamiento de sedes y rechazo de afirmaciones sin fuentes. Hacerlo sin mutaciones de campañas ni llamadas de pago.

## Aceptación para conectarlo al worker

- Registro del paso Huella con versión de skill, fuentes, salida y hash; no basta la etiqueta «skill usada».
- La ausencia de herramientas queda visible y reduce cobertura, nunca crea falsos fallos del negocio.
- La misma investigación alimenta diagnóstico y completo, sin duplicar modelos ni fuentes.
- Fallos reales de los tres casos dejan de aparecer; la calidad de redacción se revisa sobre PDF final.
- Rechazo del control impide publicar **la nueva versión**, conserva la aprobada anterior y deja motivo accionable. Esta integración está pendiente; no se afirma activa con este paquete de reglas.
