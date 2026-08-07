# studio32-hub

El contexto de este repo vive en `.ai/`. **Este archivo es solo un puntero — no
añadas contenido aquí**, o volverá a divergir de su gemelo `AGENTS.md`.

## Antes de tocar nada

1. `.ai/STATE.md` — dónde está el proyecto ahora y qué hay a medias.
2. `.ai/CONVENTIONS.md` — stack, comandos, y la regla de qué NO va en `payload`.
3. `.ai/DECISIONS.md` — solo si necesitas saber **por qué** algo es como es.

Contexto del ecosistema completo: repo `Studio32` → `notes/CONTEXTO.md`.

## Al terminar una tarea

- Reescribe `.ai/STATE.md` si el estado cambió (**sobrescribir, no acumular**).
- Añade a `.ai/DECISIONS.md` toda decisión no obvia, con su porqué.
- Commit y push de `.ai/` — es lo que sincroniza portátil y sobremesa.

## Reglas que no se rompen

- **Rutas relativas siempre.** Nada de `C:\Users\...` ni nombres de máquina.
- `git pull --rebase` al empezar, push al terminar. Dos máquinas trabajan este repo.
- **Lo que crece sin techo no va en `hub_states.payload`** — ese blob se reescribe
  entero en cada guardado. Tabla propia con RLS.
- **Ninguna tabla sin RLS.** La clave anon está en el cliente.
- **No engordar `src/App.tsx`.** Vista nueva, archivo nuevo.
- `studio32-hub-live` y `static-dist/` son build generado: no se editan a mano.
- Si algo de `.ai/` ya no es cierto, **corrígelo**. Doc obsoleta es peor que nada.
