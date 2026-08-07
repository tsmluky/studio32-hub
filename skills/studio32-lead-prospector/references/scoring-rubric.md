# Scoring Rubric — Studio32 Lead Prospector

Dos puntuaciones independientes, ambas 0-100. **Cada score que reportes debe poder desglosarse en los factores de abajo.** Si no puedes desglosarlo, no lo reportes — usa "N/D" o banda cualitativa.

---

## 1. Digital Presence Score (0-100)

Mide la calidad actual de la presencia digital del negocio. **Más bajo = peor presencia = más oportunidad para Studio32.**

### Bandas

| Banda | Rango | Interpretación |
|---|---|---|
| Muy pobre | 0-20 | Sin web, solo Maps o IG inactivo |
| Débil | 21-40 | Web obsoleta, sin reservas, sin CTA, no mobile |
| Aceptable | 41-60 | Web funcional pero con problemas claros |
| Buena | 61-80 | Web decente, presencia coherente, margen de mejora |
| Sólida | 81-100 | Presencia premium, baja prioridad para Studio32 |

### Factores (suma ponderada)

Asigna puntos por cada factor. Suma final = Digital Presence Score.

| Factor | Peso máx | Cómo evaluar |
|---|---:|---|
| Tiene web propia | 15 | Sí=15, solo redes/Maps=0, web de plataforma genérica (Wix sin dominio)=5 |
| Calidad visual de la web | 15 | Premium=15, decente=10, plantilla básica=5, obsoleta=0 |
| Mobile-friendly | 10 | Responsive y bien=10, responsive con problemas=5, no responsive=0 |
| Mensaje y CTA claros | 10 | Propuesta + CTA visible=10, propuesta sin CTA=5, ninguno=0 |
| Sistema de reservas / contacto fácil | 10 | Reservas online + WA=10, solo formulario=5, solo teléfono=2, nada=0 |
| Google Business completo | 10 | Fotos+horario+web+reseñas respondidas=10, parcial=5, mínimo=0 |
| Presencia coherente en redes | 10 | IG activo + branding coherente=10, IG inactivo o caótico=3, sin redes=0 |
| Volumen y calidad de reseñas | 10 | >100 reseñas y >4.3=10, 30-100=7, <30=3 |
| SEO local básico | 5 | Aparece en búsqueda local del sector=5, no aparece=0 |
| Branding y fotos | 5 | Fotos profesionales y branding cuidado=5, amateur=0 |

**Total máximo: 100**

### Reglas de honestidad

- Si **no has cargado la web** con `web_fetch`, no puedes puntuar "Calidad visual" ni "Mobile-friendly" ni "Mensaje y CTA". Déjalos en N/D y baja el techo del score reportado.
- Si **places_search no devolvió web**, "Tiene web propia" = 0, y debes intentar `web_search` antes de confirmar que no hay web.
- Reseñas: usa el número real de `places_search`. No estimes.

---

## 2. Studio32 Opportunity Score (0-100)

Mide el atractivo del negocio como lead. **Más alto = mejor lead.**

### Bandas

| Banda | Rango | Acción recomendada |
|---|---|---|
| Baja prioridad | 0-30 | Descartar o dejar para más adelante |
| Oportunidad media | 31-60 | Lead secundario, contactar en segunda ronda |
| Buen lead | 61-80 | Contactar, preparar approach personalizado |
| Lead prioritario | 81-100 | Contactar en primera tanda, considerar mini auditoría |

### Factores

| Factor | Peso máx | Cómo evaluar |
|---|---:|---|
| Mala presencia digital corregible | 25 | Inverso del Digital Score: (100 - Digital Score) × 0.25. Cuanto peor la presencia, más oportunidad. |
| Encaje sectorial con Studio32 | 20 | Sector prioritario (ver SKILL.md)=20, encaje medio=10, encaje débil=0 |
| Señales de capacidad de pago | 20 | Ticket alto/local cuidado/varias ubicaciones/reputación premium=20, mixto=10, dudoso=5, claramente low-cost=0 |
| Argumento comercial claro identificable | 15 | Hay 2+ ángulos concretos para el outreach=15, hay 1 ángulo=8, no se identifica claramente=0 |
| Competencia cercana mejor posicionada digitalmente | 10 | Competencia con web premium=10, competencia mixta=5, todos igual=0 |
| Volumen de tracción (reseñas, antigüedad) | 10 | Negocio establecido con tracción=10, en crecimiento=5, muy nuevo=2 |

**Total máximo: 100**

### Reglas de honestidad

- "Señales de capacidad de pago" es la más subjetiva. Justifícala con **observables concretos**: número de ubicaciones, ticket medio si aparece en web, calidad de las fotos del local en Google Maps, antigüedad. Sin observables → puntúa 5 (dudoso), no inventes.
- "Competencia cercana mejor posicionada" requiere **haber buscado competencia**. Si no lo has hecho, déjalo en N/D.
- "Argumento comercial claro": tienes que poder escribir los ángulos en una frase cada uno. Si no puedes redactarlos, el factor es 0.

---

## Desglose obligatorio en Top 3

Para cada lead del Top 3, muestra el desglose así (formato compacto):

```
Digital Presence: 32/100
  - Web propia: 0/15 (solo Instagram)
  - Calidad visual: N/D (no aplica sin web)
  - Mobile: N/D
  - Mensaje/CTA: N/D
  - Reservas/contacto: 2/10 (solo teléfono en bio IG)
  - Google Business: 7/10 (completo pero sin responder reseñas)
  - Redes coherentes: 8/10 (IG activo, branding cuidado)
  - Reseñas: 10/10 (147 reseñas, 4.6)
  - SEO local: 5/5 (aparece top 3 Maps)
  - Branding/fotos: 0/5 (no hay web; en IG sí pero no cuenta aquí)

Studio32 Opportunity: 84/100
  - Mala presencia corregible: 17/25 ((100-32)×0.25)
  - Encaje sectorial: 20/20 (hamburguesería urbana premium)
  - Capacidad de pago: 15/20 (local en zona céntrica, fotos premium en IG)
  - Argumento comercial: 15/15 (3 ángulos: sin web, sin reservas, dependencia total IG)
  - Competencia mejor posicionada: 7/10 (2 de 3 competidores cercanos tienen web decente)
  - Tracción: 10/10 (147 reseñas, 3 años activo)
```

Esto **no es decoración**. Es lo que separa la skill de un buscador de Google.

---

## Cuando NO mostrar score numérico

Si después de tu análisis tienes **menos de 4 factores verificados** en cualquiera de los dos scores, **no muestres número**. Reporta banda cualitativa:

> Digital Presence: **débil** (web no encontrada, presencia limitada a IG)
> Studio32 Opportunity: **media-alta** (encaje sectorial y reseñas fuertes, capacidad de pago por confirmar)

Esto es mejor que un "47/100" inventado.
