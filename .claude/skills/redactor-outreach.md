---
name: redactor-outreach
description: "Escribe el correo de prospección de un negocio a partir de su huella y de la oferta de la campaña, dejando cada afirmación respaldada por una cita verificable. Produce el archivo de campaña listo para importar al Hub. Usa esta skill cuando el usuario quiera redactar correos de prospección, escribir el mensaje para un lead, preparar una campaña de outreach, convertir huellas en correos, o generar borradores para que alguien los revise. Triggers: 'escribe el correo para', 'redacta la campaña', 'genera los borradores', 'prepara los correos de prospección', 'convierte estas huellas en correos', 'redactor de outreach', 'escribe a estos leads', 'prepara la campaña de [zona]'."
---

# Redactor de outreach

Coges la huella de un negocio y la oferta de la campaña, y escribes el correo que Juanma
podrá enviar **sin reescribirlo**. Ese es el único criterio de éxito: si hay que retocarlo,
la skill ha fallado.

**Regla fundamental: cada afirmación sobre el negocio va acompañada de la cita que la
sostiene.** Si no puedes citar la fuente, no lo escribes. Un correo que dice algo falso
sobre un negocio quema al prospecto y a Studio32 a la vez.

---

## Paso 1 — Reunir el material

Necesitas dos cosas:

- **La huella del negocio**, que produce la skill `huella-negocio`: detalle ancla, voz del
  cliente, mapa emocional, huecos digitales y nivel de confianza.
- **La campaña**: sector, zona y sobre todo **la oferta**, que es lo que se les propone.

Si falta la huella, no improvises: ejecuta antes `huella-negocio`. Sin huella solo se puede
escribir un correo genérico, que es justo lo que no queremos.

---

## Paso 2 — Decidir si este lead se escribe

Mira `confianza.nivel` antes de escribir nada.

- **Alto** — adelante, el correo puede hacer afirmaciones concretas.
- **Medio** — escribe más corto y apóyate solo en lo verificado. Nada de citar reseñas
  cuyo patrón tenga menos de tres apariciones.
- **Bajo** — **no escribas un correo concreto.** O lo dejas sin borrador para revisión
  manual, o escribes cuatro líneas sin ninguna afirmación sobre ellos. Es mejor no escribir
  que inventar.

Si no hay `detalle_ancla`, trátalo como confianza baja aunque diga otra cosa: sin ancla no
hay motivo creíble para ese correo.

---

## Paso 3 — Elegir el ángulo

Esta es la mecánica que funciona, y conviene no salirse de ella:

> **La queja elige el tema. El elogio abre la puerta. Un hecho neutro justifica el correo.**

- **La queja recurrente te dice de qué hablar**, porque es el dolor real del negocio. Pero
  **nunca se menciona.** Echarle en cara a alguien lo que dicen sus clientes es la forma más
  rápida de perderlo.
- **El elogio recurrente abre**, porque es verdad, es suyo y le halaga sin adular. Además
  demuestra que has mirado de verdad.
- **El hecho neutro** —lo que le falta en su web, comprobable en dos segundos— es lo que
  justifica que le escribas, y no puede sonar a reproche: es una observación.

Ejemplo real, de Clínica Dental Dr. Garcés: la queja recurrente eran las esperas y las citas
perdidas, así que el tema es la gestión de citas. El elogio abre el correo. Y el hecho
neutro —que solo se puede pedir cita llamando— justifica el mensaje. La queja no aparece.

---

## Paso 4 — Escribir

### Estructura

1. **Una frase de apertura con el elogio real**, citando o parafraseando muy de cerca lo que
   dicen sus clientes.
2. **El hecho neutro**, enlazado con un "por eso me llamó la atención que…".
3. **Qué hace Studio32**, en una frase, con la oferta de la campaña. Sin adjetivos.
4. **Un cierre de bajo compromiso.** Enseñar algo, no vender.

Cuatro párrafos cortos. Si pasa de seis líneas de texto, sobra.

### Tono

Español de España, tuteo o "vosotros" según el destinatario. **Cercano y directo, pero con
palabras normales y completas.** Nada de slang ni coloquialismos.

Usa **las palabras que usan sus clientes**, que están en `voz_del_cliente.palabras_que_usan`.
Si sus pacientes dicen "el presupuesto", no escribas "la propuesta económica".

### Lista negra

Prohibidas, sin excepción:

- Superlativos vacíos: "el mejor", "líderes", "referentes".
- Palabras de folleto: "soluciones integrales", "revolucionamos", "llevar al siguiente
  nivel", "marketing 360", "sinergia", "potenciar".
- Sobrepromesa: "garantizamos", "resultados en 30 días", cualquier cifra de retorno.
- Adulación falsa: "he estado admirando vuestro trabajo".
- Fórmulas de venta: "¿tienes 15 minutos?", "solo te robo un minuto".
- Emojis.
- **Precios.** En un correo frío no van.
- Mencionar España o Valencia.

### Asunto

Corto, concreto y sin gancho de venta. Que describa el tema, no que intente engañar para
que se abra. "La cita, por WhatsApp" funciona; "Una oportunidad para tu clínica" no.

---

## Paso 5 — La evidencia

Por cada afirmación del correo que diga algo **sobre ese negocio**, añade una entrada:

```json
{
  "afirmacion": "el trozo literal del correo que afirma algo",
  "cita": "la cita literal o el hecho comprobado que lo sostiene",
  "fuente": "autor · directorio, o dónde se comprobó"
}
```

Lo que describe a Studio32 no necesita evidencia; lo que describe al prospecto, siempre.

**Comprobación final antes de dar el correo por bueno:** lee cada frase y pregúntate si
afirma algo sobre ellos. Si lo hace y no está en `evidencia`, o lo respaldas o lo quitas.

---

## Paso 6 — Guardar en formato de campaña

La salida es el archivo que consume el Hub. Formato en
`studio32-hub/scripts/outreach-ejemplo.json`, y se importa con:

```
npm run outreach -- ruta/al/archivo.json
```

Cada lead lleva sus datos, su `huella` y su `message` con `subject`, `body` y `evidencia`.
El archivo **no se guarda dentro del repositorio**: lleva datos de contacto de prospectos y
`studio32-hub` es público.

No pongas el enlace de baja en el cuerpo: lo añade la función de envío, que es quien conoce
el token de cada lead.

---

## Paso 7 — Presentar

Muestra, por cada lead:

1. El asunto y el correo entero, para que se pueda leer sin abrir nada.
2. Cuántas afirmaciones llevan evidencia.
3. Los que se han quedado **sin borrador por confianza baja**, y por qué.

Y al final, la ruta del archivo y el comando para importarlo.

No muestres precios sugeridos ni consejos de venta.

---

## Anexo — Un correo que funciona, anotado

Para Clínica Dental Dr. Garcés, ofreciéndoles el agente de WhatsApp:

> **Asunto: la cita, por WhatsApp**
>
> He estado leyendo vuestras reseñas y hay algo que se repite: la gente habla del trato
> antes que de los tratamientos. Uno de vuestros pacientes cuenta que ir al dentista pasó de
> ser "una situación dolorosa, incómoda y a evitar" a ser distendida. Eso no se consigue con
> tecnología.
>
> Por eso me llamó la atención que la única forma de pedir cita sea llamando: en la web no
> hay WhatsApp ni reserva, y el botón de reservar lleva a un formulario.
>
> En Studio32 montamos un asistente que atiende el WhatsApp de la clínica, contesta con
> vuestra información real y da cita sobre vuestra agenda, también cuando estáis cerrados.
>
> Si queréis, os enseño en diez minutos cómo respondería con vuestros datos.

Por qué funciona: abre con algo suyo y verdadero; la cita literal es de un paciente real y
desarma; el hecho neutro es comprobable y no acusa; la oferta va en una frase sin adjetivos;
y el cierre pide diez minutos para enseñar, no para vender. **La queja que originó todo el
ángulo —las esperas— no aparece por ninguna parte.**
