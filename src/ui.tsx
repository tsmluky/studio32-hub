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

export function SectionHeader({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <header className="section-header">
      <span>{icon}<strong>{title}</strong></span>
      {action && <span className="section-action">{action}</span>}
    </header>
  )
}

export function StatusBadge({ children }: { children: string }) {
  return <span className="status-badge" data-status={children}>{children}</span>
}
