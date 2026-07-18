import type { ReactNode } from 'react'
import '../src/style.css'

export const metadata = {
  title: 'Studio32 Hub',
  description: 'Espacio interno de trabajo para proyectos, chat, notas, tareas y pizarra.',
  icons: { icon: '/studio32-mark.svg' },
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
