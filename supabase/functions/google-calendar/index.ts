import { createClient } from 'npm:@supabase/supabase-js@2'
import { importPKCS8, SignJWT } from 'npm:jose@6'

type ServiceAccount = {
  client_email: string
  private_key: string
  private_key_id?: string
  token_uri?: string
}

type EventDate = { date?: string; dateTime?: string; timeZone?: string }
type CalendarEventInput = {
  summary?: string
  description?: string
  location?: string
  start?: EventDate
  end?: EventDate
}

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_AUDIENCE = 'https://oauth2.googleapis.com/token'
const allowedOrigins = new Set([
  'https://www.hub.studio32.es',
  'https://hub.studio32.es',
  'http://127.0.0.1:4176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://localhost:5174',
])

let cachedToken: { value: string; expiresAt: number } | null = null

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://www.hub.studio32.es',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(request: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function readServiceAccount() {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!raw) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON en los secretos de Supabase.')
  const account = JSON.parse(raw) as ServiceAccount
  if (!account.client_email || !account.private_key) throw new Error('Las credenciales de Google no son válidas.')
  return account
}

async function getGoogleToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const account = readServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const key = await importPKCS8(account.private_key.replace(/\\n/g, '\n'), 'RS256')
  const assertion = await new SignJWT({ scope: GOOGLE_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', ...(account.private_key_id ? { kid: account.private_key_id } : {}) })
    .setIssuer(account.client_email)
    .setAudience(account.token_uri ?? TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const response = await fetch(account.token_uri ?? TOKEN_AUDIENCE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const result = await response.json()
  if (!response.ok || !result.access_token) throw new Error(result.error_description ?? 'Google no ha aceptado las credenciales del calendario.')
  cachedToken = { value: result.access_token, expiresAt: Date.now() + Number(result.expires_in ?? 3600) * 1000 }
  return cachedToken.value
}

function sanitizeEvent(input: CalendarEventInput) {
  const summary = input.summary?.trim().slice(0, 300)
  const start = input.start
  const end = input.end
  if (!summary || !start || !end) throw new Error('La cita necesita título, inicio y fin.')
  const allDay = Boolean(start.date && end.date)
  const timed = Boolean(start.dateTime && end.dateTime)
  if (!allDay && !timed) throw new Error('Las fechas de la cita no son válidas.')
  return {
    summary,
    description: input.description?.trim().slice(0, 5000) ?? '',
    location: input.location?.trim().slice(0, 500) ?? '',
    start: allDay ? { date: start.date } : { dateTime: start.dateTime, timeZone: 'Europe/Madrid' },
    end: allDay ? { date: end.date } : { dateTime: end.dateTime, timeZone: 'Europe/Madrid' },
    extendedProperties: { private: { source: 'studio32-hub' } },
  }
}

async function googleRequest(path: string, init: RequestInit = {}) {
  const token = await getGoogleToken()
  const response = await fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (response.status === 204) return null
  const result = await response.json()
  if (!response.ok) throw new Error(result.error?.message ?? 'Google Calendar ha rechazado la operación.')
  return result
}

async function requireStudio32Member(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization) return false
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return false
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await client.auth.getUser()
  if (userError || !user) return false
  const { data, error } = await client.from('workspace_members').select('member_id').eq('workspace_id', 'studio32').eq('user_id', user.id).maybeSingle()
  return !error && Boolean(data)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Método no permitido.' }, 405)
  if (!(await requireStudio32Member(request))) return json(request, { error: 'No tienes acceso al calendario de Studio32.' }, 403)

  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')
  if (!calendarId) return json(request, { error: 'Falta configurar GOOGLE_CALENDAR_ID.' }, 503)
  const encodedCalendarId = encodeURIComponent(calendarId)

  try {
    const body = await request.json()
    if (body.action === 'list') {
      const timeMin = new Date(body.timeMin)
      const timeMax = new Date(body.timeMax)
      if (!Number.isFinite(timeMin.getTime()) || !Number.isFinite(timeMax.getTime()) || timeMax <= timeMin) throw new Error('El intervalo del calendario no es válido.')
      if (timeMax.getTime() - timeMin.getTime() > 370 * 24 * 60 * 60 * 1000) throw new Error('El intervalo solicitado es demasiado amplio.')
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '1000',
        timeZone: 'Europe/Madrid', fields: 'items(id,summary,description,location,htmlLink,start,end,status)',
      })
      const result = await googleRequest(`/calendars/${encodedCalendarId}/events?${params}`)
      return json(request, { events: result.items ?? [] })
    }

    if (body.action === 'create') {
      const event = sanitizeEvent(body.event ?? {})
      const result = await googleRequest(`/calendars/${encodedCalendarId}/events?sendUpdates=none`, { method: 'POST', body: JSON.stringify(event) })
      return json(request, { event: result }, 201)
    }

    if (body.action === 'update') {
      if (typeof body.eventId !== 'string' || !body.eventId) throw new Error('Falta identificar la cita.')
      const event = sanitizeEvent(body.event ?? {})
      const result = await googleRequest(`/calendars/${encodedCalendarId}/events/${encodeURIComponent(body.eventId)}?sendUpdates=none`, { method: 'PATCH', body: JSON.stringify(event) })
      return json(request, { event: result })
    }

    if (body.action === 'delete') {
      if (typeof body.eventId !== 'string' || !body.eventId) throw new Error('Falta identificar la cita.')
      await googleRequest(`/calendars/${encodedCalendarId}/events/${encodeURIComponent(body.eventId)}?sendUpdates=none`, { method: 'DELETE' })
      return json(request, { ok: true })
    }

    return json(request, { error: 'Acción de calendario no reconocida.' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado en Google Calendar.'
    return json(request, { error: message }, 400)
  }
})
