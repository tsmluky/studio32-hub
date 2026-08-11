// Acceso a la tabla `leads`: la bandeja de prospección.
//
// Vive fuera de App.tsx a propósito. Los leads NO son parte de `HubState`: ese blob
// se reescribe entero en cada guardado y un lead lleva huella, porqué y correo. Esto
// tiene su propia tabla, su propia carga y su propio realtime.

import { supabase } from './supabase'
import remitentesJson from './remitentes.json'

const WORKSPACE = 'studio32'

export type SenderId = 'juanma' | 'pancho' | 'gonzalo'

export type LeadEstado =
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'enviado'
  | 'fallido'
  | 'baja'
  | 'respondido'
  | 'no_interesa'

export type Remitente = { nombre: string; email: string; firma: string[] }

export const remitentes = remitentesJson.remitentes as Record<SenderId, Remitente>

export type Confianza = 'alta' | 'media' | 'baja'

/**
 * Una afirmación sobre el negocio, con su evidencia y de dónde salió. Es la forma de
 * `identidad`, `voz` y `lo_que_ya_funciona` en el esquema de la huella.
 */
export type Observacion = {
  valor: string
  evidencia: string
  fuente: 'web' | 'google_maps' | 'resenas' | 'instagram' | 'prensa' | 'otro'
  confianza: Confianza
}

/**
 * El dolor tiene forma propia en el esquema: no lleva `fuente`, y la afirmación va en
 * `dolor`, no en `valor`. No es una `Observacion` aunque se le parezca.
 */
export type Dolor = {
  dolor: string
  evidencia: string
  confianza: Confianza
}

export type Angulo = {
  angulo: string
  apoyado_en: string
}

export type Huella = {
  negocio?: Record<string, unknown>
  identidad?: Record<string, Observacion>
  voz?: Record<string, unknown>
  dolor?: Dolor[]
  angulos?: Angulo[]
  lo_que_ya_funciona?: Observacion[]
  verificacion?: Record<string, unknown>
}

export type Lead = {
  id: string
  nombre: string
  vertical: string
  ciudad: string
  email: string
  web: string | null
  maps_url: string | null
  telefono: string | null
  instagram: string | null
  huella: Huella
  porque: string
  sender_id: SenderId
  asunto: string
  cuerpo: string
  digital_score: number | null
  opportunity_score: number | null
  estado: LeadEstado
  motivo_rechazo: string | null
  enviado_el: string | null
  error_envio: string | null
  tanda: string | null
  created_at: string
}

const COLUMNAS =
  'id, nombre, vertical, ciudad, email, web, maps_url, telefono, instagram, huella, porque, ' +
  'sender_id, asunto, cuerpo, digital_score, opportunity_score, estado, motivo_rechazo, ' +
  'enviado_el, error_envio, tanda, created_at'

export async function fetchLeads(): Promise<Lead[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('leads')
    .select(COLUMNAS)
    .eq('workspace_id', WORKSPACE)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  // La lista de columnas se construye concatenando, así que supabase-js no puede
  // inferir la forma de la fila. El contrato real lo fija la migración.
  return (data ?? []) as unknown as Lead[]
}

/**
 * El `grant` de la tabla solo deja tocar estado, motivo, asunto, cuerpo y sender_id.
 * La huella, el porqué y los scores son inmutables desde el hub: son la evidencia que
 * justifica que el correo se enviara y tienen que seguir siendo auditables después.
 */
type CampoEditable = Partial<Pick<Lead, 'estado' | 'motivo_rechazo' | 'asunto' | 'cuerpo' | 'sender_id'>>

export async function updateLead(id: string, cambios: CampoEditable) {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('leads').update(cambios).eq('id', id)
  // El trigger `guard_lead_state` rechaza transiciones inválidas con una excepción.
  // Se propaga tal cual: si la interfaz intenta algo que la base no permite, es un
  // error de la interfaz y hay que verlo, no tragárselo.
  if (error) throw new Error(error.message)
}

export function subscribeToLeads(onChange: () => void) {
  const client = supabase
  if (!client) return () => {}
  const channel = client
    .channel('leads-bandeja')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leads', filter: `workspace_id=eq.${WORKSPACE}` },
      onChange,
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}

/**
 * El cuerpo se guarda SIN firma. Se compone aquí para previsualizar exactamente lo
 * mismo que compondrá el script de envío — misma fuente (`remitentes.json`), mismo
 * formato. Si esto y el script divergen, lo que se aprueba deja de ser lo que sale.
 */
export function componerCorreo(lead: Pick<Lead, 'cuerpo' | 'sender_id'>) {
  const remitente = remitentes[lead.sender_id]
  if (!remitente) return lead.cuerpo.trim()
  return `${lead.cuerpo.trim()}\n\n${remitente.firma.join('\n')}`
}

/** Solo lo de confianza alta o media puede citarse. Lo bajo orienta, no se enseña. */
export function citable(o: { confianza: Confianza }) {
  return o.confianza === 'alta' || o.confianza === 'media'
}

export function dolores(huella: Huella): Dolor[] {
  return (huella.dolor ?? []).filter((d) => d && typeof d === 'object' && d.dolor)
}

export function angulos(huella: Huella): Angulo[] {
  return (huella.angulos ?? []).filter((a) => a && typeof a === 'object' && a.angulo)
}
