# Prospección: de un sector a un correo enviado

Cómo funciona la cadena de prospección de Studio32, cómo se ejecuta y qué hace falta
para dejarla operativa.

## La idea

El cuello de botella de Studio32 es la distribución, no el producto. Esta cadena existe
para que **una persona prepare el trabajo y otra solo tenga que revisarlo y enviarlo**.

```
Claude Code, en local          →   archivo JSON de campaña
  skill prospeccion                 (campaña + leads + huella + borradores)
  skill huella-negocio
  skill redactor-outreach
        │
        │  npm run outreach:import
        ▼
    Supabase   ────────────────→   el Hub, sección Prospección
                                     revisar → aprobar → enviar
```

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
   npm run outreach:import -- ruta/al/archivo.json
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

- `RESEND_API_KEY` — la clave de Resend. El dominio ya está verificado ahí desde julio.
- `OUTREACH_FROM` — `Studio32 <hola@studio32.es>`.
- `OUTREACH_UNSUBSCRIBE_BASE` — opcional. Sin él, el pie del correo pide responder BAJA.

Para el importador hace falta además `.env.local` con `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`. Ese archivo está ignorado por git.

## Antes de escribir a un negocio real

Crear un lead de prueba con una dirección propia como destinatario, aprobarlo y enviarlo.
Si llega con el pie de baja y la cabecera `List-Unsubscribe`, la cadena funciona.
