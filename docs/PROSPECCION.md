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
- **A un negocio se le escribe una sola vez, para siempre.** Ni a la misma dirección, ni a
  otra de su mismo dominio propio (`info@` y `citas@` de la misma clínica), ni a otro lead
  con su teléfono. Lo comprueban el importador (no crea el borrador) y el envío (lo
  bloquea). Antes era "no dos veces en 60 días", y el 25/09/2026 se mandaron dos correos
  a la misma cuenta.
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

## Por qué los envíos no salían en "Enviados"

Entregar por SMTP y guardar copia en Enviados son **dos operaciones distintas contra dos
servicios distintos**. El SMTP entrega y ahí acaba su trabajo; la copia la escribe siempre
el cliente de correo, por IMAP, contra la carpeta del buzón. Como la Edge Function solo
hablaba SMTP, los correos salían de verdad y la carpeta se quedaba vacía — lo que hacía
dudar de si el envío había ocurrido, teniéndolo registrado en el Hub.

Desde el 12/08 la función escribe también la copia, por IMAP, con la **misma cuenta** que
ya usa para enviar: no hace falta ningún secreto nuevo. Opcionales, por si acaso:

- `IMAP_HOST` / `IMAP_PORT` — por defecto `imap.hostinger.com` y `993`.
- `IMAP_SENT_FOLDER` — forzar la carpeta. Normalmente no hace falta: se descubre sola
  preguntándole al servidor cuál marca con el atributo `\Sent`. En Hostinger sale
  `INBOX.Sent`, comprobado con un envío real el 12/08/2026.
- `OUTREACH_SENT_COPY=off` — apagar la copia.

**La copia nunca puede estropear un envío.** Se escribe después de dar el correo por
enviado, no lanza errores hacia arriba, y si falla una vez deja de intentarse en el resto
de la tanda: 25 mensajes esperando a un IMAP que no contesta agotarían el tiempo de la
función con los correos ya entregados.

Dónde se comprueba de verdad si algo salió: **el estado en el Hub** (`enviado`, con su
`sent_at`), no la carpeta del webmail.

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

## La oferta de web: a quién SÍ y a quién NO se le puede escribir

**Comprobado el 05/09/2026.** La intuición natural es buscar negocios **sin web** para
ofrecerles una. Es la puerta equivocada, y el motivo es sencillo:

> Un negocio sin web tampoco publica correo. Son el mismo negocio.

Verificado en nueve candidatos de Málaga, Zaragoza y Sevilla, todos con muchas reseñas y
**ninguno con correo público en ninguna fuente primaria**: MB Dental Universitas (296
opiniones, sin web, solo ficha de Doctoralia), Estética Vanessa Jurado (764 opiniones en
Treatwell, `vanessajurado.com` **no resuelve**), Piel de Melocotón (336), Duallook (399),
Aldentista (dominio caído), El Tocador, Marine Zakaryan, Diamonds Beauty Center y Sems.

Son leads buenos y están identificados, pero **no se les llega por correo**. Necesitan
Instagram, teléfono o visita, y eso no lo hace la Edge Function: es trabajo a mano. Si
alguna vez se ataca esa lista, hay que sacarla del circuito del Hub.

### Dónde sí funciona la oferta de web

En negocios que **sí tienen web** y esa web está rota, partida o desatendida. Ahí hay
correo (está en su propia web) y hay evidencia dura, que además es más fácil de defender
que un juicio de diseño. Los tres patrones que han salido:

| Patrón | Ejemplo real |
| --- | --- |
| **Contenido congelado** | Fisiomar Sevilla: el 5 de septiembre su web sigue publicando el horario de verano y unas vacaciones del 3 al 24 de agosto. |
| **Marca partida en dos dominios** | Skin Harmony Málaga: la web es `skinharmonymalaga.es` y el correo que publica en ella es `@skinharmonyestetica.com`. |
| **La reputación vive en casa ajena** | Skin Harmony otra vez: 263 opiniones en Treatwell y su ficha no enlaza a su web. También vale para Doctoralia en dental. |

**El ángulo no es "vuestra web es mala".** Es un dato comprobable con fecha: la web dice
hoy algo que ya no es verdad. Se abre reconociendo lo que está bien hecho y se señala el
desfase, que es lo que se arregla.

## Sectores que no funcionan por correo

**Mirar esto antes de aceptar una campaña.** Prospectar un sector de esta lista es
tiempo tirado: los negocios no publican correo y la puerta los descarta a todos.

| Sector | Qué pasa |
| --- | --- |
| Barberías y peluquerías | No publican correo. Van de Instagram, teléfono y Booksy. Comprobado el 12/08/2026 en Torrejón de Ardoz: cinco negocios con web propia, reseñas y reserva online, **ninguno con email**. |

Sectores que sí funcionan, comprobado: **clínicas dentales** (publican correo casi
siempre, tienen web y reseñas abundantes), **fisioterapia** (comprobado el 12/08/2026 en
Guadalajara: de nueve centros con web propia, ocho publicaban correo) y **centros de
estética** (comprobado el 16/08/2026 en Valencia: de diez candidatas de Treatwell, ocho
tenían correo verificable).

**Centros de estética: Treatwell es la fuente de reseñas, no Doctoralia.** Este sector
casi no tiene ficha en Doctoralia (es de salud, no de belleza); `treatwell.es/
establecimientos/tipo-centro-wellness/en-<ciudad>-<provincia>-es/` y las variantes por
tratamiento (`tratamiento-tratamientos-faciales`, etc.) listan el centro, su nota media,
su número de opiniones y el enlace a su ficha, que sí trae opiniones literales con
nombre y fecha — igual de fiable que Doctoralia para dentales.

**Nuevo obstáculo de correo, distinto a "no publican":** dos candidatas (Onírika,
Cosméticaclub) tienen correo en su web, pero protegido con ofuscación Cloudflare
(`/cdn-cgi/l/email-protection`) — un humano lo ve al cargar la página porque el
navegador lo desofusca con JavaScript, pero no se puede copiar el texto literal desde
una carga automatizada. Se descartaron por no poder verificar la cadena exacta, no por
falta de correo real. Si vuelve a pasar, probar el aviso legal (a veces está en texto
plano ahí aunque en contacto esté ofuscado) antes de descartar.

**Confirmado el 18/09/2026:** el atajo del aviso legal funciona. Cosméticaclub (Valencia)
seguía con el correo de contacto ofuscado por Cloudflare, pero su aviso legal lo publicaba
en texto plano — se pudo verificar y subir. Onírika en cambio lo tiene ofuscado en los dos
sitios y sigue sin poder verificarse.

**En clínicas dentales el cuello de botella es justo el contrario: el correo.**
Comprobado el 15/08/2026 en Valencia: reseñas sobran —cualquier clínica con ficha en
Doctoralia pasa de 100 opiniones con citas literales y autor— pero de doce candidatas
con web propia, **cinco no publicaban ninguna dirección de correo**, ni en contacto ni
en el aviso legal. Cribar por correo primero, como dice el paso 2, y no al revés.

**Correos placeholder de plantilla: parecen correo público y no lo son.** Comprobado el
14/09/2026 en Alicante: una clínica publicaba `contacto@tuclinica.com` como dirección de
contacto — el texto de ejemplo de la plantilla web, sin personalizar, que nadie lee en ese
buzón. Antes de dar un correo por bueno, comprobar que el dominio de la dirección
coincide con el negocio (no un genérico tipo `tuclinica.com`, `tuempresa.com`) y que no
hay un segundo correo en la misma web sin relación clara con el nombre de la clínica: si
lo hay, descartar por no ser fiable en vez de subirlo.

Dos atajos que ahorran la mitad del tiempo en este sector:

- **`doctoralia.es/clinicas/odontologia/<ciudad>` es el mejor punto de partida.** Lista
  clínicas con su dirección, su número de opiniones y el enlace a su ficha. Adivinar el
  slug de una clínica concreta (`/clinicas/<nombre-que-suena-bien>`) devuelve 404 casi
  siempre; salir del listado, no.
- **Si no hay correo en contacto, mirar el aviso legal antes de descartar.** Varias lo
  publican solo ahí, a nombre del titular. Cuenta como correo público, pero conviene
  anotarlo en `confianza` porque a veces es una cuenta personal.

**Cuidado con el nombre duplicado entre ciudades.** Comprobado el 05/09/2026 en
Alicante: una búsqueda de "Clínica Dental Dr. Jorge Fonseca" devolvió un dominio
(`clinicasdrfonseca.com`) que un resumen de búsqueda daba por bueno, pero al cargar la
página de verdad resultó ser "Odontomerida", una clínica homónima en Mérida. Hay más de
un dentista con el mismo nombre y apellido en España. Antes de dar por buena una web,
cargarla y comprobar que la dirección o la ciudad coinciden con las del negocio que se
está investigando — si no se puede verificar, se descarta sin subir nada, como pasó
aquí.

**En fisioterapia el cuello de botella no es el correo, son las reseñas.** Ocho de nueve
tenían correo público, pero solo cuatro tenían una cita literal con autor localizable, y
por eso solo cuatro pasaron la puerta. Al cribar, comprobar el correo **y** que exista
ficha en Doctoralia o testimonios firmados en su web: sin lo segundo el lead se cae igual,
y se cae después de haber gastado el tiempo.

**Cuidado con los centros multiespecialidad que salen en búsquedas de "clínica dental".**
Comprobado el 15/09/2026 en Alicante: Critón Salud y Unnic Salud y Bienestar aparecen en
listados de clínicas dentales, pero sus únicas reseñas verificables eran de medicina
estética, urología o ginecología — ninguna de odontología. Sin una reseña que hable
específicamente del servicio dental, no hay huella honesta que escribir: descartar antes
de invertir tiempo en el resto de la investigación. Mismo patrón, distinto disfraz, que
Adeslas Fabra i Puig en Barcelona (una clínica de seguro/franquicia que salía en el
listado de Doctoralia bajo un nombre de calle) y que Espai Salut Sant Gervasi (centro
multidisciplinar de fisio/psicología/podología, no una clínica dental) — los tres se
cayeron en la criba inicial, no después de investigarlos a fondo.

El caso de nombre duplicado entre ciudades (documentado el 05/09 con Jorge Fonseca en
Alicante/Mérida) se repitió el 15/09 con el mismo negocio: sigue sin fuente primaria que
confirme la sede de Alicante, así que sigue descartado.

**La misma confusión pasa dentro de la misma ciudad, entre negocios familiares.**
Comprobado el 18/09/2026 en Málaga: "Clínica Cuevas Queipo" aparece con ese apellido en
al menos dos direcciones distintas (Especería 11 y Velázquez 52), cada una con su propio
correo. Sin una fuente primaria que diga cuál es cuál, se descarta entera en vez de
adivinar y arriesgarse a escribirle a la clínica equivocada.

Si descubres otro sector muerto, **apúntalo aquí**. Es lo que impide que la siguiente
pasada vuelva a gastar media hora en lo mismo.

## Zonas ya exprimidas

**Fisioterapia · Guadalajara capital — agotada a 15/08/2026, con 7 leads.** No es que el
sector falle: es que la ciudad tiene los centros que tiene. Estos se comprobaron uno a
uno y **no entran**, así que no vuelvas a investigarlos salvo que cambie algo:

| Negocio | Correo | Por qué se cayó |
| --- | --- | --- |
| Clínica Corposane | sí | Ficha de Doctoralia vacía. Comprobado dos veces |
| Pelvitae | sí | 55 opiniones, pero ninguna citable con autor |
| Fisioalma | sí | Solo un testimonio en su web, sin firmar |
| Instituto de Fisioterapia y Deporte | sí | "Aún no ha recibido ninguna opinión" |
| Alea Fisioterapia | sí | 151 reseñas en Google, ninguna citable con autor |
| Fisioterapia Peinado | sí | Sin ficha localizable con opiniones |
| Fisiolux | **no** | No publica correo |
| Arte Fisioterapia | **no** | Su web no carga (error de TLS) y no hay correo en ningún directorio |

Fíjate en el patrón: **seis de los ocho tienen correo y se caen igual, por las reseñas.**
Confirma lo de más arriba — en fisioterapia la puerta que descarta no es el correo.

**Dónde seguir cuando haga falta más volumen:** Azuqueca de Henares (19200) tiene al
menos cuatro centros con web propia sin tocar —FisioAzuqueca, Fisiobrain, Alana,
Policlínica Acacias—. Es campaña aparte, no se coló en esta: la que estaba pedida decía
Guadalajara y ampliar la zona por mi cuenta habría falseado lo que se encargó.

**Fisioterapia · Torre del Mar — pedida a 25, servidos 5 el 23/08/2026, queda poco.** El
pueblo no da para 25: entre Doctoralia, `fisioterapia.io` y búsqueda directa salieron unos
once centros, y no hay más. Los cinco que entraron —Clínica Fisiomar, ACOSTA fisioterapia
avanzada y osteopatía, Axarclinic, Clínica Valenzuela y Fisioesmile— tienen todos correo
público y reseñas con cita y autor, comprobado uno a uno.

**Aquí el correo no fue el cuello de botella, tampoco las reseñas: fue la fuente.** Cinco
de los seis descartados se caen por no tener ficha en ningún sitio que publique el texto
de la reseña, no por no tener reseñas. Ver más abajo lo de `sportmedicine.es`, que es lo
que salvó a cuatro de los cinco que sí entraron.

| Negocio | Correo | Por qué se cayó |
| --- | --- | --- |
| AXIO Fisioterapia | sí, `info@axiofisioterapia.com` | 34 reseñas (4.9) y ninguna localizable con texto y autor: los testimonios de su web salen como "Reseña Google" sin firmar y no tiene ficha en Doctoralia ni en sportmedicine.es. **Es el primero a recuperar si aparece la fuente** |
| Clinica Bonal | no encontrado | 249 opiniones en Doctoralia con citas y autor, pero sin web propia y sin correo en ningún directorio. Lead bueno para llamada o visita, no para correo |
| Fisioterapia Torre | no | Web propia desde 1999, pero no publica correo ni en contacto ni en aviso legal (su `/contacto/` y `/aviso-legal/` dan 404) |
| Kineca Clinic | no comprobado | "aún no ha recibido ninguna opinión" en Doctoralia |
| Clínica Cañaveral Fisioterapia | no comprobado | 1 opinión en Doctoralia |
| Benalfisio Centro de Fisioterapia | — | Sale en el listado de Torre del Mar pero su ficha lo sitúa en Guadix (18510). No es de la zona |

**Lo que queda sin tocar en Torre del Mar, para otra pasada:** POLICLÍNICAS SALUD 101
(5.0, 32 reseñas) y Sanurart (5.0, 28), los dos con dirección en el 29740 y ninguno
investigado. Dan como mucho para dos leads más, así que la campaña se queda abierta pero
no llegará a 25 ni de lejos.

**Si hace falta más volumen en la Axarquía:** Vélez-Málaga capital está a tres kilómetros
y tiene centros grandes sin tocar —Fidias Center Vélez (419 opiniones en Doctoralia),
Neuronax (64), Clínica de Fisioterapia y Osteopatía Máximo, Clinica El Olivar—. Es campaña
aparte: la pedida decía Torre del Mar, y aunque sea el mismo municipio son dos localidades
distintas.

**Clínicas dentales · Azuqueca de Henares — agotada a 16/08/2026, con 4 leads.** Pedía
10; el pueblo no da para tantas. Mismo patrón que fisioterapia en la misma zona: **el
correo no es el problema, las reseñas citables sí.**

| Negocio | Correo | Por qué se cayó |
| --- | --- | --- |
| Dentalius | sí | 27 opiniones en Google (4.7), ninguna con texto y autor localizable en ningún agregador probado |
| Odonto Azuqueca / DentaLmc | no verificable en su propia web ni aviso legal | Sus 4 valoraciones de Doctoralia son solo estrellas, "el usuario no dejó ninguna opinión escrita" |
| Antonio Gelpi Prat | no encontrado en ningún directorio | 24 opiniones (5.0) pero sin correo publicado en ningún sitio |
| Clínica Dental Pérez-Stad | sí, pero personal (Hotmail) | Sin web propia y sin ninguna reseña localizable con autor |
| Clínica Dental Dra. Nieves Golbano | no verificable | Su dominio no resuelve (dos intentos, con y sin `www`) |

Los cuatro que sí entraron —Policlínica Acacias, Somosierra, Gold Dental, Clínica Dental
La Paz— tienen todos correo público y reseñas con cita y autor, comprobado uno a uno.

**Clínicas dentales · Murcia capital — pasada del 19/09/2026, 3 leads.** Aquí el cuello
de botella no es el correo ni las reseñas: es que **casi todas las clínicas independientes
ya tienen botón de WhatsApp en su web**, y la oferta (agente de WhatsApp para dar cita)
pierde el hueco. De unas 30 candidatas, 17 cayeron solo por eso. Al cribar, mirar si la
web enseña WhatsApp antes de investigar reseñas. Sin investigar quedaron Ronda Levante,
Cora del Val, Más Bermejo, Ortodental y Arg Dental.

**Clínicas dentales · Granada capital — pasada del 19/09/2026, 3 leads.** Cayeron por
grupo/franquicia (Corral & Vargas, Clident, Marta García), por sedes fuera de la capital
(Armilla) o por reseñas antiguas y anónimas en Doctoralia (2011-2021). Tres de los
correos que entraron son de Gmail/Yahoo, con confianza `medio`.

**Clínicas dentales · Valladolid capital — pasada del 19/09/2026, 5 leads.** El listado de
`doctoralia.es/clinicas/odontologia/valladolid` da pocas reseñas por clínica pequeña: rinde
más entrar por la web de cada una. Los correos Gmail personales y el correo de la agencia
que hizo la web (que aparece en el pie) no cuentan como correo del negocio. Queda por
investigar la segunda página del listado.

## Cuánto cuesta una tanda

Verificar un lead de verdad son 2-3 páginas cargadas: su web, sus reseñas, y a veces una
búsqueda para el correo. Desde el 25/09/2026 cada campaña da **hasta 30 leads por
pasada** (antes 6), así que la pasada es larga y subir según salen es obligatorio.

Pedir 20 en una campaña está bien —es lo que se querría— pero se sirven en varias
pasadas. Una tanda que no termina no sube nada: el importador solo escribe cuando se le
llama, así que hay que subir de dos en dos y no dejarlo todo para el final.

## Dónde están las reseñas literales (y dónde no)

La puerta pide **cita literal con autor**, y ahí se va la mitad del tiempo si se busca a
ciegas. Ir directo a la fuente que funciona por sector:

| Sector | Fuente que sí da citas literales |
| --- | --- |
| Clínicas dentales, medicina estética | `doctoralia.es/clinicas/<slug>` |
| Centros de estética, peluquería | `treatwell.es/establecimiento/<slug>` |
| Fisioterapia | `doctoralia.es`, pero **por profesional, no por centro** |

**En fisioterapia las opiniones cuelgan del fisioterapeuta, no de la clínica.** El centro
suele salir con cero opiniones mientras sus fisios tienen treinta cada uno. El atajo:
abrir `doctoralia.es/fisioterapeuta/<ciudad>`, que lista profesionales con su centro y su
número de opiniones, y entrar por la ficha de quien más tenga. Buscar por el nombre de la
clínica devuelve fichas vacías y hace pensar que no hay reseñas.

Si el centro no está en Doctoralia, mirar los **testimonios firmados de su propia web**
antes de descartarlo: sirven para la puerta, aunque suelen estar sin renovar desde hace
años y bajan la confianza a `medio`.

**`sportmedicine.es` sí sirve, y es el hallazgo de la pasada del 23/08/2026.** A
diferencia del resto de agregadores, replica las reseñas de Google **enteras, con nombre
de autor y fecha**, y con la fecha de la última actualización de la ficha. Salvó cuatro de
los cinco leads de Torre del Mar, donde ninguna clínica con web moderna tenía ficha en
Doctoralia. La URL tiene la forma
`sportmedicine.es/<nombre-del-negocio>-<ciudad>-<id>/` y se encuentra buscando
`sportmedicine.es "<nombre del negocio>" <ciudad> opiniones`; adivinar el id no funciona.
Al citarlo, la fuente honesta es "Autor · Google (vía sportmedicine.es), <fecha>", porque
la reseña es de Google pero no se ha leído en Google. `holisticcenter.es` y
`fisioterapiavigo.es` replican la misma ficha pero **sin** los textos: solo nota y
recuento, no valen para la puerta.

**`fisioterapia.io/listados/fisioterapeutas/<provincia>/<ciudad>/` es el mejor censo de un
pueblo.** No trae reseñas literales, pero lista todos los centros con dirección, nota y
número de reseñas de Google en una sola página. Sirve para la criba del paso 2 y saca
negocios que ni Doctoralia ni una búsqueda normal devuelven.

**Los agregadores no sirven**: top-rated.online, cylex, expirit y similares devuelven
403, y los resúmenes que salen en los resultados de búsqueda vienen parafraseados y sin
autor, que es exactamente lo que la puerta rechaza.

Si un negocio no tiene ficha en la fuente de su sector, **descártalo y sigue**. Buscar
sus reseñas por otros diez sitios cuesta más que el lead.
