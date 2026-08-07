# Output Template — Studio32 Lead Prospector

Plantilla del output final. Sigue este orden exacto. **No añadas secciones ni cambies el orden** — la consistencia hace que el usuario pueda escanear rápido entre ejecuciones.

---

## Plantilla completa

```markdown
# Lead Research Studio32 — [Sector] en [Ubicación]

## Resumen ejecutivo

- **Sector:** [sector analizado]
- **Ubicación:** [zona]
- **Leads analizados:** [N totales]
- **Leads en Top 3 prioritario:** [N con Opportunity Score ≥ 75]
- **Hallazgo principal:** [1 frase con el patrón más relevante. Ej: "7 de 10 negocios premium del sector no tienen web propia y dependen de Instagram para conversión"]
- **Recomendación:** [1 frase. Ej: "Atacar primero los 3 con Opportunity ≥80; preparar mini auditoría visual de 1 página para cada uno"]

---

## Tabla de leads priorizados

Ordenada por Opportunity Score descendente.

| # | Negocio | Web | IG | Reseñas | Digital Score | Opportunity Score | Servicio recomendado | Gancho |
|---|---|---|---|---|---:|---:|---|---|
| 1 | [Nombre] | [url o "No"] | [@handle o "No"] | [N / rating] | [score o banda] | [score o banda] | [web premium / reservas / WA / chatbot / auditoría] | [1 frase] |
| 2 | ... | ... | ... | ... | ... | ... | ... | ... |
| ... | | | | | | | | |

---

## Top 3 oportunidades

### 1. [Nombre del negocio]

**Datos verificados:**
- Web: [url o "No encontrada"]
- Instagram: [@handle o "No encontrado"]
- Google Maps: [N reseñas, rating X.X]
- Ubicación: [dirección/zona]
- Notas: [fotos premium en IG / varias ubicaciones / etc — solo lo verificado]

**Por qué es buen lead:**
[2-3 frases concretas. Mencionar encaje sectorial, capacidad de pago aparente, y por qué la presencia digital actual es palanca clara.]

**Problemas detectados:**
- [Problema 1 verificado]
- [Problema 2 verificado]
- [Problema 3 verificado]

**Qué puede ofrecer Studio32:**
- [Servicio 1 con justificación de 1 línea]
- [Servicio 2 con justificación de 1 línea]
- [Servicio 3 con justificación de 1 línea]

**Desglose de scoring:**
```
Digital Presence: XX/100
  - Web propia: X/15 ([nota])
  - Calidad visual: X/15 ([nota])
  - Mobile: X/10 ([nota])
  - Mensaje/CTA: X/10 ([nota])
  - Reservas/contacto: X/10 ([nota])
  - Google Business: X/10 ([nota])
  - Redes coherentes: X/10 ([nota])
  - Reseñas: X/10 ([nota])
  - SEO local: X/5 ([nota])
  - Branding/fotos: X/5 ([nota])

Studio32 Opportunity: XX/100
  - Mala presencia corregible: X/25
  - Encaje sectorial: X/20
  - Capacidad de pago: X/20 ([observable])
  - Argumento comercial: X/15
  - Competencia mejor posicionada: X/10
  - Tracción: X/10
```

**Mensajes de outreach:**

📱 **WhatsApp / DM Instagram (corto):**
> [Mensaje 2-3 líneas, 40-60 palabras]
>
> — Francisco / Studio32

✉️ **Email frío (medio):**
> **Asunto:** [4-7 palabras]
>
> [Cuerpo 80-120 palabras]
>
> — Francisco
> Studio32 · Digital Systems

🗣️ **Guion visita presencial / llamada:**
> [4-6 frases hablado]

---

### 2. [Nombre del negocio]

[Misma estructura que el 1]

---

### 3. [Nombre del negocio]

[Misma estructura que el 1]

---

## Leads descartados o de baja prioridad

(Solo incluir esta sección si hay descartes relevantes. Útil para que el usuario aprenda el criterio.)

- **[Nombre]** — Descartado: [razón en 1 línea. Ej: "cadena con 40+ ubicaciones, no es ICP de Studio32"]
- **[Nombre]** — Baja prioridad: [razón]

---

## Próximos pasos recomendados

1. Contactar primero los leads con Opportunity Score ≥ 75 (orden: [#1] → [#2] → [#3]).
2. Preparar mini auditoría visual de 1 página para cada uno del Top 3.
3. Probar WhatsApp / DM antes que email frío — tasa de respuesta más alta en local.
4. Esperar 5-7 días antes de follow-up. Un único follow-up, no más.
5. Registrar respuesta y resultado en CRM / Notion para iterar el criterio de scoring.

---

## Notas metodológicas

(Opcional, solo si hay limitaciones relevantes que el usuario deba conocer.)

- [Ej: "No pude cargar la web de [X] — el dominio respondió con error. Score parcial."]
- [Ej: "places_search devolvió pocos resultados en esta zona — considera ampliar el radio o el sector."]
```

---

## Variaciones según volumen

- **1-3 leads totales**: omite la tabla resumen, ve directo a detalle por lead.
- **4-9 leads**: tabla + Top 3 detallado completo.
- **10+ leads**: tabla + Top 3 detallado + sección "Leads descartados" obligatoria.

## Idioma

Por defecto: español. Si el usuario escribe consistentemente en inglés o el negocio analizado es internacional, ajusta.

## Cuando exportar

Si el usuario pide explícitamente CSV / JSON / HTML, generar el archivo y usar `present_files`. **No exportes por defecto** — el output en chat es suficiente para la mayoría de casos.

Estructura CSV recomendada:
```
prioridad,nombre,sector,ciudad,web,instagram,resenas_count,rating,digital_score,opportunity_score,servicio_recomendado,gancho
```
