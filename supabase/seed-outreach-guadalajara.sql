-- Primera campaña de prospección, con datos reales.
--
-- El lead y su huella salen de la ejecución de la skill `huella-negocio` sobre
-- Clínica Dental Dr. Garcés el 5 de agosto de 2026: su web más 22 reseñas con
-- texto literal. Ninguna cita es inventada; cada una lleva su autor y su origen.
--
-- Idempotente: usa identificadores fijos y `on conflict do update`, así que se
-- puede reejecutar sin duplicar nada. Acotado al workspace de Studio32.

begin;

insert into public.outreach_campaigns (id, workspace_id, name, sector, city, oferta, status)
values (
  '11111111-1111-4111-8111-111111111111',
  'studio32',
  'Dentales Guadalajara',
  'Clínicas dentales',
  'Guadalajara',
  'Agente de IA en WhatsApp que atiende y da cita sobre la agenda real',
  'abierta'
)
on conflict (id) do update set
  name = excluded.name,
  sector = excluded.sector,
  city = excluded.city,
  oferta = excluded.oferta,
  status = excluded.status;

insert into public.outreach_leads (
  id, workspace_id, campaign_id,
  business_name, sector, city, address, postal_code,
  website, email, phone, maps_url,
  score, digital_level, has_whatsapp, has_online_booking, rating, reviews,
  problems, huella, huella_generated_at,
  status, owner_member_id, source
)
values (
  '22222222-2222-4222-8222-222222222222',
  'studio32',
  '11111111-1111-4111-8111-111111111111',
  'Clínica Dental Dr. Garcés',
  'Clínica dental',
  'Guadalajara',
  'C/ María Pacheco 58',
  '19001',
  'https://www.clinicadentaldrgarces.com/',
  'cdentaldrgarces@gmail.com',
  '949 23 21 91',
  'https://www.google.com/maps/search/?api=1&query=Cl%C3%ADnica+Dental+Dr.+Garc%C3%A9s+Guadalajara',
  97,
  'bajo',
  false,
  false,
  4.2,
  85,
  $problems$[
    "Sin WhatsApp: todo el contacto pasa por teléfono",
    "Sin reserva de cita online",
    "Sin teléfono pulsable en la home",
    "Sin redes sociales enlazadas",
    "Correo de contacto en Gmail",
    "Tres direcciones distintas entre directorios",
    "Horario publicado erróneo"
  ]$problems$::jsonb,
  $huella${
    "detalle_ancla": {
      "detalle": "Sus pacientes les adoran por el trato, y la única queja que se repite es la gestión de las citas: esperas de 40 a 75 minutos teniendo cita, y al menos una reserva olvidada. No tienen ninguna forma de pedir cita que no sea llamar.",
      "por_que_importa": "No hay que convencerles de que su atención es mejorable: lo dicen sus propios pacientes, y solo de la parte que Studio32 arregla.",
      "fuente": "Reseñas de David Piñero, Inma Andrés y J.J. contrastadas con la ausencia de WhatsApp y reserva online en su web"
    },
    "voz_del_cliente": {
      "elogios_recurrentes": [
        {
          "patron": "El trato del personal, por encima de los tratamientos",
          "cita": "Personal muy profesional y amable, te reciben siempre con una sonrisa.",
          "fuente": "Paco Carpeno · oopiniones",
          "veces": 9
        },
        {
          "patron": "Les quitan el miedo al dentista",
          "cita": "Desde que acudo a la consulta del Dr. Óscar Garcés, ir al dentista, en vez de una situación dolorosa, incómoda y a evitar, es una situación distendida.",
          "fuente": "Alfredo Marco Burgos · oopiniones",
          "veces": 3
        },
        {
          "patron": "El presupuesto, comparado con otras clínicas",
          "cita": "El presupuesto siempre super bien a comparación con otras clínicas y el trato estupendo.",
          "fuente": "Raquel Patiño Morales · oopiniones",
          "veces": 5
        }
      ],
      "quejas_recurrentes": [
        {
          "patron": "Esperas largas con cita dada, y citas que se pierden",
          "cita": "He ido dos veces con cita y me he tenido que ir después de esperar 50 y 40 minutos.",
          "fuente": "David Piñero · oopiniones",
          "veces": 3
        }
      ],
      "palabras_que_usan": ["el trato", "el presupuesto", "esperar", "la cita", "revisión", "urgencia sin cita"]
    },
    "huecos_digitales": [
      "Sin WhatsApp",
      "Sin reserva online",
      "Sin teléfono pulsable",
      "Sin redes enlazadas",
      "Horario publicado erróneo"
    ],
    "confianza": {
      "nivel": "alto",
      "no_encontrado": [
        "Nota media fiable: las fuentes dan 4.0, 4.2 y 4.3",
        "Fecha real de las reseñas"
      ]
    }
  }$huella$::jsonb,
  now(),
  'nuevo',
  'juanma',
  'skill:huella-negocio'
)
on conflict (id) do update set
  huella = excluded.huella,
  huella_generated_at = excluded.huella_generated_at,
  score = excluded.score,
  problems = excluded.problems;

insert into public.outreach_messages (
  id, workspace_id, lead_id,
  from_email, reply_to, to_email, to_name,
  subject, body, evidencia, status
)
values (
  '33333333-3333-4333-8333-333333333333',
  'studio32',
  '22222222-2222-4222-8222-222222222222',
  'hola@studio32.es',
  'hola@studio32.es',
  'cdentaldrgarces@gmail.com',
  'Clínica Dental Dr. Garcés',
  'La cita, por WhatsApp',
  $body$He estado leyendo vuestras reseñas y hay algo que se repite: la gente habla del trato antes que de los tratamientos. Uno de vuestros pacientes cuenta que ir al dentista pasó de ser "una situación dolorosa, incómoda y a evitar" a ser distendida. Eso no se consigue con tecnología.

Por eso me llamó la atención que la única forma de pedir cita sea llamando: en la web no hay WhatsApp ni reserva, y el botón de reservar lleva a un formulario.

En Studio32 montamos un asistente que atiende el WhatsApp de la clínica, contesta con vuestra información real y da cita sobre vuestra agenda, también cuando estáis cerrados.

Si queréis, os enseño en diez minutos cómo respondería con vuestros datos.$body$,
  $evidencia$[
    {
      "afirmacion": "la gente habla del trato antes que de los tratamientos",
      "cita": "Personal muy profesional y amable, te reciben siempre con una sonrisa.",
      "fuente": "Paco Carpeno · oopiniones · 9 reseñas con el mismo patrón"
    },
    {
      "afirmacion": "ir al dentista pasó de ser una situación dolorosa, incómoda y a evitar",
      "cita": "Desde que acudo a la consulta del Dr. Óscar Garcés, ir al dentista, en vez de una situación dolorosa, incómoda y a evitar, es una situación distendida.",
      "fuente": "Alfredo Marco Burgos · oopiniones"
    },
    {
      "afirmacion": "la única forma de pedir cita sea llamando",
      "cita": "En clinicadentaldrgarces.com no hay enlace de WhatsApp, ni teléfono pulsable, y el botón \"Reserva tu cita hoy mismo\" lleva a un formulario de contacto.",
      "fuente": "Lectura directa de la web, 5 de agosto de 2026"
    }
  ]$evidencia$::jsonb,
  'borrador'
)
on conflict (id) do update set
  subject = excluded.subject,
  body = excluded.body,
  evidencia = excluded.evidencia,
  status = 'borrador';

commit;
