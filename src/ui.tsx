// Piezas de presentación compartidas entre vistas.
//
// Estaban dentro de App.tsx. Salieron al añadir la vista de Prospección: dos vistas
// en archivos distintos no pueden importarlas de App.tsx sin crear un ciclo, porque
// App.tsx importa las vistas. Se extrae lo que se toca, no más.

import type { ReactNode } from 'react'

export function PageHeading({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string
  title: string
  description: string
  meta?: ReactNode
}) {
  return (
    <header className="page-heading">
      <span>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </span>
      {meta && <div className="page-heading-meta">{meta}</div>}
    </header>
  )
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="empty-state">{icon}<strong>{title}</strong><p>{body}</p></div>
}
