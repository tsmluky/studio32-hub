// Tipos de diagnostico.js para el Hub (TypeScript). Deno no los necesita.
export type EstadoHallazgo = 'bien' | 'mejorable' | 'falla'
export interface Hallazgo {
  area?: string
  estado: EstadoHallazgo
  titulo: string
  detalle?: string
  fuente: string
}
export declare const ESTADOS: Record<EstadoHallazgo, { etiqueta: string; color: string; fondo: string }>
export declare function diagnosticoDeLead(lead: unknown): Hallazgo[]
export declare function revisarDiagnostico(hallazgos: Hallazgo[]): string[]
export declare function htmlDiagnostico(datos: { negocio: string; ciudad?: string; hallazgos: Hallazgo[]; fecha?: Date }): string
