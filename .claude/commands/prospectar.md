---
description: Genera UNA tanda de prospección de las pedidas en el Hub y la sube
---

Trabaja en `repos/studio32/studio32-hub`.

## Regla que manda sobre todas: esto tiene que terminar

Una pasada son **como mucho 6 leads y unos 25 minutos**. Nunca 20, aunque la campaña
pida 20: verificar de verdad son 2-3 páginas por negocio, y una tanda que no termina no
sube nada y no sirve de nada.

Seis sólidos son una tanda buena. Si la campaña pedía más, se dice en el informe y se
completa en otra pasada.

## 1. Elige UNA campaña

```bash
npm run outreach
```

Si no hay nada pedido, dilo y para.

**Una sola por pasada**, aunque haya varias. Elige por probabilidad de dar fruto, no por
antigüedad: mira `docs/PROSPECCION.md` → "Sectores que no funcionan por correo" antes de
elegir. Si la única pendiente es de un sector muerto, ciérrala (paso 4) y para.

## 2. Criba barata antes de investigar a fondo

Este es el paso que ahorra el tiempo. **No te lances a fondo con cada negocio.**

1. Una búsqueda para sacar 10-12 candidatos del sector y la zona.
2. Descarta de entrada: cadenas, franquicias, y los que no tengan web propia.
3. **Comprueba que hay correo público** antes de nada más. Sin correo el lead no puede
   entrar, así que investigarlo es tiempo tirado.

Si tras la criba quedan menos de 3 con correo, **para ahí**: el sector no funciona por
correo. Cierra la campaña (paso 4) explicándolo y no sigas.

## 3. Investiga y sube, de dos en dos

Para los que pasaron la criba, y **como mucho 6**:

- Carga su web y busca sus reseñas. Nada inventado: ni correos, ni teléfonos, ni
  recuentos, ni citas. Si no lo has leído, no lo escribes.
- Sigue `skills/studio32-lead-prospector/SKILL.md` → Modo C para la forma del JSON y la
  huella.
- El cuerpo termina en "Un saludo," **sin nombre**: la firma la pone el envío.

**Sube en cuanto tengas 2 o 3 listos**, no al final:

```bash
npm run outreach -- <ruta-del-json>
```

Reimportar es seguro: respeta lo que ya tenga trabajo hecho. Así, si la pasada se corta,
lo hecho ya está en el Hub en vez de perderse.

Escribe el JSON en la carpeta temporal de la sesión, nunca en el repo: lleva datos de
contacto de negocios reales y el repositorio es público.

## 4. Si la campaña no da para más, ciérrala

Para que deje de aparecer en la cola y que quien la pidió sepa por qué:

```bash
npm run outreach -- --cerrar <id-campaña> "motivo en una línea"
```

## 5. Cuenta qué pasó, corto

- Cuántos subieron y a qué campaña.
- **Cuáles cayeron y por qué.** Es lo más útil: dice si el criterio de búsqueda sirve.
- Qué queda pendiente de esa campaña, si es que queda.

No apruebes ni envíes nada. Eso lo hace una persona en el Hub, siempre.
