// Tipos compartidos entre App.tsx y las vistas que viven en su propio archivo.
//
// Existen aquí y no en App.tsx porque App.tsx importa las vistas: si una vista le
// importara un tipo a él, se crearía un ciclo.

export type MemberId = 'juanma' | 'pancho' | 'gonzalo'

export type HubSyncStatus = 'idle' | 'loading' | 'ready' | 'error'
