# Studio32 Hub

Studio32 Hub es una primera versión de un espacio interno para que el equipo tenga un punto de entrada diario: proyectos, conversación, decisiones, tareas, recursos y pizarra.

## Objetivo

La regla de producto es simple: menos ambicioso, más usado. El Hub no intenta reemplazar Drive, Notion o Calendar de golpe; empieza reuniendo el contexto y dejando enlaces claros a lo que ya existe.

## Versión actual

- Portada `Hoy` con foco personal, agenda, bloqueos y actividad.
- Vista de proyectos con estado, hitos y carga abierta.
- Inbox compartido para capturar y ordenar trabajo.
- Biblioteca de recursos, notas y decisiones.
- Conversación persistente y pizarra dentro de cada proyecto.
- Acceso por perfil y PIN de seis dígitos para Juanma, Pancho y Gonzalo.
- Vista diaria con fecha real, foco editable de cada miembro y bloqueos visibles.
- Agenda compartida editable y progreso de proyecto calculado desde las tareas.
- Búsqueda global y manifest PWA.
- Autenticación real con Supabase Auth y cambio de PIN personal.
- Datos compartidos con RLS, Realtime y control de cambios simultáneos.

La propuesta para probarlo con el equipo durante una semana está en [docs/TEAM_PILOT.md](docs/TEAM_PILOT.md).

## Infraestructura

La aplicación está conectada a Supabase. La arquitectura y el procedimiento de alta están en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

- `workspaces` y `workspace_members` limitan el acceso al equipo.
- `hub_states` guarda el estado operativo compartido de esta primera versión.
- Las políticas RLS exigen una sesión válida y pertenencia a Studio32.
- Realtime mantiene sincronizados los tres dispositivos.
- El registro público está fuera de la interfaz; las cuentas se crean con el script de administración.

## Comandos

```bash
npm install
npm run dev
```

El build de producción compatible con Workers se genera con:

```bash
npm run build
```

La compilación estática usada por el hosting público se genera con:

```bash
npm run build:static
```

Para probarlo desde otro equipo de la misma red:

```bash
npm run dev:lan
```
