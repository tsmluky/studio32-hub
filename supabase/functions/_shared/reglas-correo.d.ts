// Tipos de reglas-correo.js para el Hub (TypeScript). Deno no los necesita.
export declare const DESPEDIDA: string
export declare function normalizarTipografia(texto: string): string
export declare function revisarCorreo(correo: { subject?: string; body?: string; to_email?: string }): string[]
