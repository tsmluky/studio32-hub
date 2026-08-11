// Índice de Herramientas.
//
// Es un contenedor, no una vista con contenido propio: aquí se van sumando las
// herramientas internas del equipo según se construyan. Existe como pantalla —y no
// solo como grupo del sidebar— porque en móvil el sidebar es una barra inferior de
// iconos y no puede mostrar un submenú. Una entrada, una pantalla, y dentro la lista.

import { ChevronRight, Send } from 'lucide-react'
import { PageHeading } from './ui'

export type ToolId = 'prospecting'

export const tools: Array<{
  id: ToolId
  label: string
  description: string
  icon: typeof Send
}> = [
  {
    id: 'prospecting',
    label: 'Prospección',
    description: 'Leads con el correo ya redactado, listos para aprobar y enviar.',
    icon: Send,
  },
]

export default function ToolsView({ onOpenTool }: { onOpenTool: (tool: ToolId) => void }) {
  return (
    <div className="page narrow-page">
      <PageHeading
        eyebrow="Interno"
        title="Herramientas"
        description="Lo que el equipo usa para trabajar mejor. Se irán sumando aquí."
      />
      <section className="surface tools-list">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button key={tool.id} type="button" className="tool-row" onClick={() => onOpenTool(tool.id)}>
              <span className="tool-icon"><Icon size={19} /></span>
              <span className="tool-copy">
                <strong>{tool.label}</strong>
                <small>{tool.description}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          )
        })}
      </section>
    </div>
  )
}
