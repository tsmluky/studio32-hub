---
description: Genera tandas de prospección de las campañas del Hub (varias en paralelo) y las sube
argument-hint: "[nº de campañas a la vez, por defecto 3]"
---

Trabaja en `repos/studio32/studio32-hub` (o donde esté el repo `studio32-hub` en esta
máquina).

Argumento: `$ARGUMENTS` — cuántas campañas trabajar **a la vez**. Si viene vacío, **3**.
Nunca más de 4: cada una son decenas de páginas cargadas, y el límite de uso de la
suscripción es de todas juntas.

## Regla que manda sobre todas: esto tiene que terminar

Cada campaña de la pasada da **como mucho 30 leads**. La cantidad que se pidió en el Hub
es orientativa, no un techo: una campaña sigue dando hasta que su zona se agota.
Verificar de verdad son 2-3 páginas por negocio, así que 30 es una pasada larga: por eso
se sube **de dos en dos o de tres en tres** según salen (B2), nunca al final. Si la pasada
se corta, lo subido ya está en el Hub; lo que falte se completa en otra.

Trabajar tres campañas a la vez **no cambia esa regla por campaña**: multiplica cuántas se
avanzan, no cuánto se estira cada una. Así una pasada da hasta ~90 leads.

No apruebes ni envíes nada, nunca. Eso lo hace una persona en el Hub.

---

## Parte A · Lo que haces tú (el que coordina)

### A1. Pon el repo al día y mira la cola

```bash
git pull --rebase
npm run outreach
```


### A2. Elige las campañas

Lee antes `docs/PROSPECCION.md` → "Sectores que no funcionan por correo" y "Zonas ya
exprimidas".

- Elige por **probabilidad de dar fruto**, no por antigüedad.
- **Nunca dos campañas del mismo sector en la misma ciudad** en una pasada (por ejemplo
  dos de dentales en Valencia con zonas distintas). Se pisarían los candidatos: dos
  agentes investigando la misma clínica y dos importaciones subiéndola a la vez.
- Si una campaña es de un sector o zona que ya consta como muerto, no la asignes: ciérrala
  tú (`npm run outreach -- --cerrar <id> "motivo"`) y elige otra.
- Si hay menos campañas válidas que el número pedido, **crea las que falten** en vez de
  quedarte corto: un sector que funciona (clínicas dentales, fisioterapia, centros de
  estética) en una capital de provincia que no tenga ya campaña de ese sector, con la
  oferta y las notas de las campañas hermanas:
  ```bash
  npm run outreach -- --crear "Clínicas dentales" "Córdoba capital" "<oferta>" "<notas>"
  ```
  Nunca en una zona de "Zonas ya exprimidas" ni en un sector de "Sectores que no
  funcionan por correo". Di en el resumen cuáles creaste.

### A3. Lanza un agente por campaña, todos a la vez

Con la herramienta de agentes, **todos en el mismo mensaje** para que corran en paralelo
(tipo `general-purpose`). A cada uno le pasas este encargo, rellenado:

> Eres uno de varios agentes generando prospección para Studio32 a la vez. Tu campaña,
> y solo esa:
> - Campaña: `<id>` — `<nombre>`
> - Sector: `<sector>` · Zona: `<zona>` · Faltan: `<n>` (tú haces como mucho 30, aunque falten menos)
> - Oferta: `<oferta>` · Notas: `<notas o "ninguna">`
>
> Trabaja en el repo `studio32-hub` (`<ruta absoluta del repo en esta máquina>`). Lee
> `.claude/commands/prospectar.md` → **Parte B** y síguela entera, al pie de la letra.
> Tu archivo JSON se llama `tanda-<id corto de la campaña>.json` y va en
> `<carpeta temporal de la sesión>/<id corto de la campaña>/`, nunca en el repo. Esa
> subcarpeta es solo tuya: todo lo que descargues o generes va ahí dentro.
>
> Cuando termines, responde SOLO con: cuántos leads subiste, cuáles cayeron y por qué
> (una línea cada uno), si cerraste la campaña y cuántos le faltan.

### A4. Cuenta qué pasó, corto

Cuando vuelvan todos:

- **Un correo por negocio, para siempre.** El importador ya no crea borrador para una
  dirección, un dominio propio o un negocio que ya tenga correo, y el envío lo bloquea
  aunque se cuele. Si el importador lista alguno como "ya se le escribe", cuéntalo.
- Cuántos leads subieron en total y cómo quedó la bandeja (vuelve a lanzar
  `npm run outreach` y copia la línea "Bandeja: …").
- Por campaña: cuántos subieron, **cuáles cayeron y por qué** (es lo más útil: dice si el
  criterio de búsqueda sirve) y qué queda pendiente.
- Si algún agente falló o se quedó a medias, dilo tal cual. Lo subido ya está en el Hub.
- Si hay algo nuevo que valga para próximas pasadas (una fuente de reseñas que funciona,
  una zona agotada, un obstáculo nuevo), apúntalo en `docs/PROSPECCION.md` y haz commit y
  push de ese archivo. **Solo aprendizajes, nunca datos de contacto de negocios.**

---

## Parte B · Trabajo por campaña (lo que hace cada agente)

### B1. Criba barata antes de investigar a fondo

Este es el paso que ahorra el tiempo. **No te lances a fondo con cada negocio.**

1. Mira qué negocios de tu zona ya tenemos, para no investigarlos otra vez:
   ```bash
   npm run outreach -- --conocidos "<zona>"
   ```
2. Saca candidatos del sector y la zona que **no** estén en esa lista, por rondas de
   10-12: la criba tira más de la mitad, así que para 30 leads harán falta varias. Cuando
   una fuente se agote (el listado no da más páginas), pasa a la siguiente.
3. Descarta de entrada: cadenas, franquicias, y los que no tengan web propia.
4. **Comprueba que hay correo público** antes de nada más. Sin correo el lead no puede
   entrar, así que investigarlo es tiempo tirado. El correo tiene que ser una dirección sin
   tildes ni eñes: el servidor no las envía y el importador las descarta.

Si tras la primera ronda quedan menos de 3 con correo, **para ahí**: ciérrala (B3)
explicándolo y no sigas. Si en rondas posteriores la zona deja de dar candidatos nuevos,
para también: la zona está agotada, dilo al terminar aunque no llegues a 30.

### B2. Investiga y sube, de dos en dos

Para los que pasaron la criba, y **como mucho 30**:

- Carga su web y busca sus reseñas. Nada inventado: ni correos, ni teléfonos, ni
  recuentos, ni citas. Si no lo has leído, no lo escribes.
- Sigue `skills/studio32-lead-prospector/SKILL.md` → Modo C para la forma del JSON y la
  huella. **La frase de oferta y un solo tratamiento (tú o vosotros) son requisito de
  entrada**, no estilo: un correo sin ellos no se sube.
- El cuerpo **no lleva saludo ni presentación** (empieza por lo que viste del negocio) y
  termina en "Un saludo y gracias por vuestro tiempo," **sin nombre**: el "Hola, soy…" y
  la firma los pone el envío con el nombre de quien apruebe.
- **La pauta del 02/10: evidencia → fricción → solución → pregunta.** Cuatro párrafos, de
  100 a 140 palabras. **Una** personalización (la evidencia más específica, no una lista),
  **una** fricción que hayas visto tú al pedir cita (lo observable, nunca "estáis perdiendo
  pacientes" ni lo que pasa por dentro), **una** solución y **una** pregunta. Se investiga
  mucho y se escribe poco: lo demás se queda en la huella. Léelo entero en
  `references/outreach-guidelines.md` → "Email frío". **Sin fricción vista, el lead no
  sube**: no se inventa una.
- La solución va en primera persona ("Es justo lo que montamos: …"), ligada a ESA
  fricción y sin técnica ni "IA" como argumento. **Nunca ofrezcas llamadas de teléfono**
  (el agente es solo WhatsApp) ni "un ejemplo real".
- **Un solo producto.** Ya no hay frase de "otros servicios" (webs, ficha de Google, correo,
  SEO): se enseñan cuando contestan. Si la oferta de la campaña es una web, esa es el único
  producto.
- El cierre va en su propio párrafo, una sola pregunta de sí o no: "¿Os enseño cómo
  funcionaría aplicado a vuestra clínica?" (o "vuestro centro"). Nunca reunión ni demo.
- La `evidencia` lleva `rol` (`personalizacion` / `friccion`), `confianza` (0 a 1; por
  debajo de 0,8 no es un hecho) y, en la fricción, el `angulo`. Es el registro de por qué
  se escribió ese correo.
- El asunto es corto y llano, sin parecer campaña: "Sobre las citas de X", "Pedir cita en
  X", "El WhatsApp de X", "Una idea para vuestra clínica", "Una cosa que vi en vuestra web".
  Nunca "Propuesta" ni "Oferta", ni promesas.
- **Tipografía de persona, no de máquina.** Comillas rectas " " para citar (nunca « » ni
  “ ”), tres puntos y no el carácter …, y **ninguna raya (— o –)**: coma, dos puntos o
  punto. El envío para cualquier correo con una raya, así que un borrador con ella no
  llegará a salir. Al subir, el importador lista lo que el envío pararía y, aparte, lo que
  se aparta de la pauta de estilo (eso son avisos: arréglalo si puedes, no para nada).

**Sube en cuanto tengas 2 o 3 listos**, no al final:

```bash
npm run outreach -- <ruta-del-json>
```

Reimportar es seguro: respeta lo que ya tenga trabajo hecho. Así, si la pasada se corta,
lo hecho ya está en el Hub en vez de perderse. Usa siempre el mismo archivo y ve
añadiendo leads: reimportar los primeros no los duplica.

Escribe el JSON en la carpeta temporal de la sesión, nunca en el repo: lleva datos de
contacto de negocios reales y el repositorio es público.

**Trabaja solo en tu subcarpeta** (`<carpeta temporal>/<id corto de la campaña>/`), y no
leas ni importes nada de fuera de ella. Los agentes de una pasada comparten la carpeta
temporal: el 25/09/2026 un agente importó los borradores de otro y dos leads de Zaragoza
acabaron en la campaña de Sevilla.

### B3. Si la campaña no da para más, ciérrala

Para que deje de aparecer en la cola y que quien la pidió sepa por qué:

```bash
npm run outreach -- --cerrar <id-campaña> "motivo en una línea"
```

No toques `docs/PROSPECCION.md` ni hagas commits: eso lo hace quien coordina, con lo que
le cuentes.
