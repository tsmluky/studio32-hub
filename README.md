# Studio32 Hub

Studio32 Hub es una primera versión de un espacio interno para que el equipo tenga un punto de entrada diario: proyectos, conversación, decisiones, tareas, recursos y pizarra.

## Objetivo

La regla de producto es simple: menos ambicioso, más usado. El Hub no intenta reemplazar Drive, Notion o Calendar de golpe; empieza reuniendo el contexto y dejando enlaces claros a lo que ya existe.

## Prototipo actual

- Portada `Hoy` con foco personal, agenda, bloqueos y actividad.
- Vista de proyectos con estado, hitos y carga abierta.
- Inbox compartido para capturar y ordenar trabajo.
- Biblioteca de recursos, notas y decisiones.
- Conversación persistente y pizarra dentro de cada proyecto.
- Acceso por perfil y PIN de seis dígitos para Juanma, Pancho y Gonzalo.
- Búsqueda global, persistencia local y manifest PWA.

## Siguiente capa

Para uso real entre los tres miembros, el siguiente paso natural es conectar Supabase. La arquitectura propuesta está en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

- Auth privada para Studio32.
- Base de datos compartida para proyectos, mensajes, notas y tareas.
- Realtime para chat y pizarra.
- Storage para adjuntos ligeros.
- Integraciones con Google Drive/Calendar cuando el flujo diario ya este claro.

## Comandos

```bash
npm install
npm run dev
```

Para probarlo desde otro equipo de la misma red:

```bash
npm run dev:lan
```
