---
description: Genera las campañas de prospección que el equipo haya pedido desde el Hub y las sube
---

Haz el ciclo completo de prospección, de principio a fin, sin pedirle a la persona
que copie ni pegue nada.

## 1. Mira qué hay pedido

```bash
npm run outreach
```

Si no hay nada encargado, dilo y para. No inventes una campaña por tu cuenta.

Si hay varias y no cabe hacerlas todas con calidad, haz la más antigua primero y di
cuáles quedan.

## 2. Genera cada tanda

Sigue `skills/studio32-lead-prospector/SKILL.md`, **Modo C**, con el sector, la zona,
la cantidad y las notas de cada encargo.

Lo que no es negociable:

- **Verifica de verdad.** Carga la web de cada negocio y busca sus reseñas. Nada de
  emails, teléfonos ni recuentos inventados.
- **La puerta antes de subir.** Sin email público, sin detalle ancla con fuente, o sin
  un elogio con cita literal, ese lead no entra.
- **Seis sólidos valen más que veinte con relleno.** Si de veinte pedidos solo cinco
  aguantan, sube cinco y explica por qué cayeron los demás.
- **El cuerpo termina en "Un saludo," sin nombre.** La firma la compone el envío.

## 3. Súbela

Escribe el JSON en la carpeta temporal de la sesión (no en el repo: lleva datos de
contacto de negocios reales y este repositorio es público) y súbelo:

```bash
npm run outreach -- <ruta-del-json>
```

## 4. Cuenta qué pasó

En lenguaje llano y corto:

- Cuántos entraron y de qué campaña.
- **Cuáles se descartaron y por qué.** Es lo más útil del informe: dice si el sector o
  la zona son buen criterio. Si un sector entero no publica correo —las barberías, por
  ejemplo—, ese es el hallazgo, no un fallo.
- Cualquier dato que quede en duda y convenga mirar antes de aprobar.

No apruebes ni envíes nada. Eso lo hace una persona en el Hub, siempre.
