# Estado — studio32-hub

> Se **sobrescribe**, no se acumula. Tope ~100 líneas. Última actualización: 2026-08-07.

## Qué es

Workspace interno del equipo (Juanma, Pancho, Gonzalo). Vive en `hub.studio32.es`.
El build estático se publica desde el repo gemelo `studio32-hub-live` — **generado, no
se edita a mano**.

## Dónde está ahora

- `main` limpio y desplegado. Última entrega: entrada "Alta de asistente" en el sidebar.
- Auth y estado en Supabase. Tablas: `workspaces`, `workspace_members`, `hub_states`.
- Vistas activas: Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca.
- Existe un repo hermano `studio32-hub-agent` (bot de Telegram del hub, en Railway).

## En curso — Prospección: bandeja inversa de leads

Herramienta interna de captación. La idea: en vez de que el equipo busque a quién
escribir, la skill sube leads **con el correo ya redactado y su porqué**, y Juanma o
Gonzalo solo leen y aprueban. Aprobar es la decisión; el envío va después.

Estado por piezas:

| Pieza | Estado |
|---|---|
| Skill `studio32-lead-prospector` rescatada al repo (`skills/`) | Hecho |
| Esquema de huella (`skills/.../references/huella.*`) | Hecho |
| Modo C de la skill (tanda para el hub) | Hecho |
| Convención `.ai/` en este repo | Hecho |
| Migración `leads` escrita | Hecho — **sin aplicar todavía** |
| Script de subida de tanda | **Pendiente — siguiente paso** |
| Vista "Prospección" en el hub | Pendiente |
| Script local de envío por SMTP | Pendiente |

> **Acción pendiente de una persona:** aplicar
> `supabase/migrations/20260807160000_leads.sql` en el editor SQL de Supabase.
> En este repo las migraciones **no se aplican solas** — `supabase:bootstrap` solo
> crea usuarios y membresías. Hasta que se pegue ese SQL, no hay tabla `leads`.

### Lo que hay que saber antes de seguir

- **Los leads NO van en `hub_states.payload`.** Ese blob se reescribe entero en cada
  cambio; meter correos ahí lo hace crecer sin freno y encarece cada guardado.
  Tabla propia, con el mismo patrón de RLS (`is_workspace_member`).
- **El hub nunca guarda credenciales de envío.** Solo `sender_id`. Las App Passwords
  viven en el `.env` local de quien ejecuta el script, fuera de git.
- **La huella es esquema compartido con `studio32-agent`.** Si un lead convierte,
  alimenta `templates/<vertical>/`. Cambiarla afecta a los dos lados.

## Riesgo abierto

`src/App.tsx` son ~3.000 líneas en un solo archivo. La vista de Prospección no debe
engordarlo más: extraerla a su propio módulo desde el principio.

## Bloqueadores

Ninguno técnico. El de contexto: la regla de congelación de scope
(cero features nuevas hasta que gh-dent esté vivo en producción) sigue vigente y esto
la roza. Se avanza por ser captación, no producto, pero el reloj del primer cliente
sigue parado.

## Al terminar cualquier tarea aquí

`git pull --rebase` al empezar, y commit + push de `.ai/` al cerrar. Este repo se
trabaja desde portátil y sobremesa: si te lo saltas, `STATE.md` entra en conflicto.
