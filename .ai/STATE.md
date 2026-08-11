# Estado — studio32-hub

> Se **sobrescribe**, no se acumula. Tope ~100 líneas. Última actualización: 2026-08-11.

## Qué es

Workspace interno del equipo (Juanma, Pancho, Gonzalo). Vive en `hub.studio32.es`.
El build estático se publica desde el repo gemelo `studio32-hub-live` — **generado, no
se edita a mano**.

## Dónde está ahora

- Auth y estado en Supabase. Tablas: `workspaces`, `workspace_members`, `hub_states`, `leads`.
- Vistas: Hoy, Tareas, Calendario, Proyectos, Inbox, Biblioteca y **Herramientas**.
- Existe un repo hermano `studio32-hub-agent` (bot de Telegram del hub, en Railway).

## Herramientas · Prospección — el ciclo completo

Herramienta interna de captación, y la primera dentro de "Herramientas". La idea: en
vez de que el equipo busque a quién escribir, la skill sube leads **con el correo ya
redactado y su porqué**, y en el hub solo se lee y se decide.

El ciclo, de punta a punta:

1. **Local** — la skill `studio32-lead-prospector` (Modo C) busca, mina la huella y
   redacta un correo por lead. Salida: un JSON de tanda.
2. **Local** — `npm run leads:subir -- tanda.json` aplica la puerta (evidencia,
   antipatrones, dedupe) y sube lo que pasa. Sin `--confirmar` solo revisa.
3. **Hub** — Herramientas › Prospección. Se lee el porqué, se ajusta el correo si hace
   falta, y se aprueba o se rechaza. Quien aprueba puede quedarse el envío.
4. **Local** — `npm run leads:enviar` manda los aprobados por SMTP desde el buzón real
   de cada uno. Sin `--confirmar` solo muestra qué saldría.
5. **Hub** — tras el envío, se marca a mano si respondió o no le interesa.

Estado por piezas: **todas hechas**. Skill, esquema de huella, tabla `leads`, script de
subida, vista del hub y script de envío.

> **Acción pendiente de una persona:** pegar `SUPABASE_DB_URL` en el `.env` local
> (Supabase → Project Settings → Database → Connection string, puerto 5432) y ejecutar
> `npm run supabase:migrate`. **Hasta entonces la tabla `leads` no existe** y la vista
> de Prospección muestra el aviso de que no puede leer la bandeja.
>
> Después, quien vaya a enviar añade su App Password a su `.env` (ver `.env.example`).

### Lo que hay que saber antes de tocarlo

- **Los leads NO van en `hub_states.payload`.** Ese blob se reescribe entero en cada
  cambio. Tabla propia, con RLS por `is_workspace_member`.
- **El hub nunca guarda credenciales de envío.** Solo `sender_id`. Las App Passwords
  viven en el `.env` local de quien ejecuta el script, fuera de git.
- **El cuerpo se guarda sin firma.** La compone el envío desde `src/remitentes.json`,
  que es fuente única compartida entre el hub (previsualizar) y el script (enviar).
  Por eso "lo envío yo" puede reasignar remitente sin romper el correo.
- **La huella, el porqué y los scores no se editan desde el hub.** El `grant` de la
  tabla solo deja tocar estado, motivo, asunto, cuerpo y remitente: la evidencia es lo
  que justifica que el correo se enviara y tiene que seguir siendo auditable.
- **Solo el script puede marcar 'enviado'.** El trigger `guard_lead_state` se lo
  prohíbe al hub, para que un fallo de interfaz no dé por enviado algo que no salió.
- **La huella es esquema compartido con `studio32-agent`.** Si un lead convierte,
  alimenta `templates/<vertical>/`. Cambiarla afecta a los dos lados.

### Cabos sueltos conocidos

- **No hay seguimientos.** Un negocio se contacta una vez y su email/dominio queda
  ocupado para siempre. Añadir una segunda tanda al mismo negocio pediría un concepto
  de paso/secuencia que hoy no existe. Fue decisión consciente: es donde más fácil se
  cruza la línea de ser pesado.
- **El envío no es inmediato.** Depende de que alguien ejecute `leads:enviar`. Si el
  retraso entre aprobar y enviar molesta, la salida es un worker, y entonces con OAuth
  `gmail.send` en vez de App Password (ver DECISIONS 2026-08-07).
- **Un lead solo lo puede enviar quien tenga esas credenciales.** Los de otros
  remitentes quedan aprobados esperando; el script los lista como bloqueados.

## Riesgo abierto

`src/App.tsx` sigue en ~3.000 líneas. Prospección y Herramientas se hicieron fuera
(`src/ProspectingView.tsx`, `src/ToolsView.tsx`, `src/leads.ts`, `src/ui.tsx`).
Mantener la regla: vista nueva, archivo nuevo.

## Bloqueadores

Ninguno técnico. El de contexto: la regla de congelación de scope (cero features
nuevas hasta que gh-dent esté vivo en producción) sigue vigente y esto la roza. Se
avanza por ser captación, no producto, pero el reloj del primer cliente sigue parado.

## Al terminar cualquier tarea aquí

`git pull --rebase` al empezar, y commit + push de `.ai/` al cerrar. Este repo se
trabaja desde portátil y sobremesa: si te lo saltas, `STATE.md` entra en conflicto.
