# Prospección: de un sector a un correo enviado

Cómo funciona la cadena de prospección de Studio32, cómo se ejecuta y qué hace falta
para dejarla operativa.

## La idea

El cuello de botella de Studio32 es la distribución, no el producto. Esta cadena existe
para que **una persona prepare el trabajo y otra solo tenga que revisarlo y enviarlo**.

```
EL HUB                      ESTA MAQUINA                    EL HUB
Herramientas → Prospección
"Pedir campaña"
  sector · zona · oferta
        │
        └─ campaña 'pedida' ──►  npm run outreach
                                   lista los encargos y escupe
                                   el prompt listo para pegar
                                         │
                                   Claude Code + las 3 skills
                                   (suscripción, no API)
                                         │
                                   npm run outreach --
                                         │
                                         └─ 'abierta' ──►  revisar
                                                           aprobar
                                                              │
                                              Edge Function outreach-send
                                              SMTP de Hostinger
```

Quien decide a quién atacar ya no tiene que ser quien sabe ejecutar la skill.
Juanma rellena cuatro campos desde el móvil; el encargo espera en la cola.

La generación corre en local con la suscripción de Claude. **Supabase es la costura**: la
skill escribe filas, el Hub las lee. Si algún día hace falta que la generación corra sola
en un servidor, se mueve a Railway y el Hub no se entera.

## Las tres skills

Viven en `.claude/skills/` de este repositorio, así que viajan por git entre máquinas.

| Skill | Qué hace |
| --- | --- |
| `prospeccion` | Sector + zona → negocios reales con su auditoría digital y su puntuación |
| `huella-negocio` | Por negocio: qué vende, cómo habla, qué dicen sus clientes y el detalle ancla, cada dato con su fuente |
| `redactor-outreach` | Huella + oferta → el correo, con la evidencia que sostiene cada afirmación |

La huella tiene **dos consumidores**: el redactor de correos y el `tone.md` de un tenant
nuevo del agente. Se construye una vez y se usa dos veces.

## Cómo se lanza una campaña

1. Ejecutar las skills en Claude Code hasta obtener el JSON de campaña. El formato está en
   `scripts/outreach-ejemplo.json`.
2. Importarlo:

   ```
   npm run outreach -- ruta/al/archivo.json
   ```

3. Juanma entra en el Hub, revisa la cola, aprueba lo que le convence y pulsa Enviar una
   vez, sobre toda la tanda.

**El archivo de campaña no se versiona aquí.** Lleva datos de contacto de prospectos y este
repositorio es público. El ejemplo del repo usa un negocio ficticio a propósito.

## Reglas que el sistema no rompe

- **Ningún correo sale sin aprobación humana.** `approved_by` es obligatorio y solo la Edge
  Function con la clave de servicio puede marcar algo como enviado.
- **Nadie de la lista de bajas recibe nada.** Frontera dura en el envío.
- **A la misma dirección no se escribe dos veces en 60 días**, aunque sean leads distintos:
  dos leads pueden compartir buzón.
- **Máximo 25 por tanda, con pausa entre envíos.** Una ráfaga quema la reputación del
  dominio, y ese dominio también manda los avisos de citas de los clientes.
- **Reimportar no borra trabajo comercial.** Un lead que ya salió de "nuevo" conserva su
  estado, su responsable y sus notas.
- **Las quejas de sus clientes nunca se citan al prospecto.** Se le enseñan a quien revisa
  porque explican el lead y sirven para una llamada, pero echárselas en cara lo pierde.

## Identidad y duplicados

- **Dura:** el dominio normalizado. `http://www.x.com/` y `https://x.com` son el mismo
  negocio y la base lo impide.
- **Blanda:** teléfono, correo y nombre + código postal. No son únicos a propósito. Un
  negocio sin web es el lead más valioso, y un índice único ahí tiraría leads buenos en
  silencio. Se marca `duplicate_of` y lo decide una persona.

## Qué hace falta para dejarlo operativo

| | Estado |
| --- | --- |
| Tablas en Supabase | aplicadas |
| Vista en el Hub | en la rama `feat/prospeccion-email` |
| Importador | listo |
| Función `outreach-send` | escrita, **sin desplegar** |
| Secretos | **pendientes** |

Desplegar la función:

```
npx supabase login
npx supabase functions deploy outreach-send --project-ref wwhinwxedcvpxprmcsta
```

Secretos necesarios en Supabase → Edge Functions → Secrets:

- `SMTP_HOST` — `smtp.hostinger.com`
- `SMTP_PORT` — `465`
- `SMTP_USER` — `info@studio32.es`. **La cuenta real, no un alias.**
- `SMTP_PASS` — la contraseña de esa cuenta.
- `OUTREACH_FROM` — `Studio32 <info@studio32.es>`.
- `OUTREACH_UNSUBSCRIBE_BASE` — opcional. Sin él, el pie del correo pide responder BAJA.

## Por qué SMTP y no una API de correo

Studio32 tiene **una sola cuenta** en Hostinger, `info@studio32.es`, con alias para
cada socio: `juanma@`, `gonzalo@` y `francisco@`. El SMTP se autentica siempre como la
cuenta real y pone en `From:` el alias que toque — exactamente lo que hace el webmail.

Así el correo sale del dominio propio, las respuestas caen en la bandeja real donde se
sigue el hilo, y no hay proveedor intermedio del que depender.

**Cuidado con Pancho:** su identificador interno es `pancho` (así está en el login del
Hub y en `outreach_leads.owner_member_id`) pero su dirección de correo es
`francisco@studio32.es`. El mapeo vive en `src/remitentes.json` y es el único sitio
donde se cruzan las dos cosas.

**Por qué no Railway:** el plan Hobby bloquea el SMTP saliente (puertos 25, 465 y 587);
solo se abre a partir de Pro. Por eso el envío vive en una Edge Function de Supabase,
donde el 465 con TLS sí sale.

Para el importador hace falta además `.env.local` con `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`. Ese archivo está ignorado por git.

## Antes de escribir a un negocio real

Crear un lead de prueba con una dirección propia como destinatario, aprobarlo y enviarlo.
Si llega con el pie de baja y la cabecera `List-Unsubscribe`, la cadena funciona.

## Sectores que no funcionan por correo

**Mirar esto antes de aceptar una campaña.** Prospectar un sector de esta lista es
tiempo tirado: los negocios no publican correo y la puerta los descarta a todos.

| Sector | Qué pasa |
| --- | --- |
| Barberías y peluquerías | No publican correo. Van de Instagram, teléfono y Booksy. Comprobado el 12/08/2026 en Torrejón de Ardoz: cinco negocios con web propia, reseñas y reserva online, **ninguno con email**. |

Sectores que sí funcionan, comprobado: **clínicas dentales** (publican correo casi
siempre, tienen web y reseñas abundantes).

Si descubres otro sector muerto, **apúntalo aquí**. Es lo que impide que la siguiente
pasada vuelva a gastar media hora en lo mismo.

## Cuánto cuesta una tanda

Verificar un lead de verdad son 2-3 páginas cargadas: su web, sus reseñas, y a veces una
búsqueda para el correo. Con la criba previa, **una pasada razonable son 6 leads**.

Pedir 20 en una campaña está bien —es lo que se querría— pero se sirven en varias
pasadas. Una tanda que no termina no sube nada: el importador solo escribe cuando se le
llama, así que hay que subir de dos en dos y no dejarlo todo para el final.
