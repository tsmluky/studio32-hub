"use client"

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  KeyRound,
  LibraryBig,
  Lightbulb,
  Link as LinkIcon,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { isSupabaseConfigured, pinToPassword, supabase } from './supabase'

type MemberId = 'juanma' | 'pancho' | 'gonzalo'
type ProjectId = string
type MainView = 'today' | 'projects' | 'inbox' | 'library' | 'project'
type ProjectTab = 'overview' | 'tasks' | 'conversation' | 'board' | 'files'
type TaskStatus = 'todo' | 'doing' | 'done'
type CaptureType = 'task' | 'note' | 'decision' | 'link'
type UpdateKind = 'message' | 'note' | 'decision'
type BoardLane = 'ideas' | 'decided' | 'doing'
type TeamAvailability = 'focus' | 'available' | 'blocked' | 'away'
type ProjectArea = 'studio32' | 'clients' | 'archive'

type Member = {
  id: MemberId
  name: string
  initials: string
  role: string
  email: string
  color: string
}

type Project = {
  id: ProjectId
  name: string
  client: string
  area: ProjectArea
  status: string
  focus: string
  nextMilestone: string
  accent: string
  topics: string[]
}

type Task = {
  id: string
  projectId: ProjectId
  title: string
  status: TaskStatus
  ownerId: MemberId
  due: string
  priority: 'Alta' | 'Media' | 'Baja'
  blocked?: boolean
}

type Update = {
  id: string
  projectId: ProjectId
  authorId: MemberId
  kind: UpdateKind
  body: string
  createdAt: string
}

type Resource = {
  id: string
  projectId: ProjectId
  title: string
  type: 'Drive' | 'PDF' | 'Notion' | 'Link'
  url: string
  updatedAt: string
}

type InboxItem = {
  id: string
  type: CaptureType
  title: string
  detail?: string
  authorId: MemberId
  createdAt: string
}

type BoardItem = {
  id: string
  projectId: ProjectId
  title: string
  lane: BoardLane
  authorId: MemberId
}

type TeamCheckIn = {
  memberId: MemberId
  availability: TeamAvailability
  focus: string
  updatedAt: string
}

type AgendaEvent = {
  id: string
  time: string
  title: string
  meta: string
}

type CapturePayload = {
  type: CaptureType
  title: string
  detail?: string
  destination: 'inbox' | ProjectId
  ownerId?: MemberId
  due?: string
  priority?: Task['priority']
}

type ProjectInput = Omit<Project, 'id' | 'accent'>

type HubState = {
  selectedProjectId: ProjectId
  projects: Project[]
  tasks: Task[]
  updates: Update[]
  resources: Resource[]
  inbox: InboxItem[]
  boardItems: BoardItem[]
  teamCheckIns: TeamCheckIn[]
  agendaEvents: AgendaEvent[]
}

type HubSyncStatus = 'idle' | 'loading' | 'ready' | 'error'

const members: Member[] = [
  { id: 'juanma', name: 'Juanma', initials: 'JM', role: 'Equipo Studio32', email: 'juanma@studio32.es', color: '#2f6f73' },
  { id: 'pancho', name: 'Pancho', initials: 'PA', role: 'Equipo Studio32', email: 'pancho@studio32.es', color: '#9a5a32' },
  { id: 'gonzalo', name: 'Gonzalo', initials: 'GZ', role: 'Equipo Studio32', email: 'gonzalo@studio32.es', color: '#486ca8' },
]

const initialProjects: Project[] = [
  {
    id: 'studio32',
    name: 'Studio32 Hub',
    client: 'Proyecto interno',
    area: 'studio32',
    status: 'Activo',
    focus: 'Construir y mejorar el espacio de trabajo del estudio.',
    nextMilestone: 'Primera semana de uso real',
    accent: '#2f6f73',
    topics: [],
  },
]

const initialState: HubState = {
  selectedProjectId: 'studio32',
  projects: initialProjects,
  tasks: [],
  updates: [],
  resources: [],
  inbox: [],
  boardItems: [],
  teamCheckIns: [],
  agendaEvents: [],
}

const navigation: Array<{ id: Exclude<MainView, 'project'>; label: string; icon: typeof Home }> = [
  { id: 'today', label: 'Hoy', icon: Home },
  { id: 'projects', label: 'Proyectos', icon: FolderKanban },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'library', label: 'Biblioteca', icon: LibraryBig },
]

const captureLabels: Record<CaptureType, string> = {
  task: 'Tarea',
  note: 'Nota',
  decision: 'Decisión',
  link: 'Enlace',
}

const updateLabels: Record<UpdateKind, string> = {
  message: 'Mensaje',
  note: 'Nota',
  decision: 'Decisión',
}

const availabilityLabels: Record<TeamAvailability, string> = {
  focus: 'En foco',
  available: 'Disponible',
  blocked: 'Bloqueado',
  away: 'Fuera',
}

const projectAreaLabels: Record<ProjectArea, string> = {
  studio32: 'Studio32',
  clients: 'Clientes',
  archive: 'Archivo',
}

const projectStatusOptions = ['Activo', 'En pausa', 'Bloqueado', 'Completado', 'Archivado']

function normalizeProject(project: Project): Project {
  const area = project.area === 'clients' || project.area === 'archive' || project.area === 'studio32'
    ? project.area
    : project.id === 'studio32' ? 'studio32' : 'clients'
  return {
    ...project,
    area,
    topics: Array.isArray(project.topics) ? project.topics.filter((topic) => typeof topic === 'string' && topic.trim()) : [],
  }
}

function normalizeHubState(payload: unknown): HubState {
  if (!payload || typeof payload !== 'object') return initialState
  const normalized = { ...initialState, ...payload } as HubState
  return {
    ...normalized,
    projects: Array.isArray(normalized.projects) && normalized.projects.length
      ? normalized.projects.map(normalizeProject)
      : initialProjects,
  }
}

function usePersistentHubState(activeMemberId: MemberId | null) {
  const [state, setState] = useState<HubState>(initialState)
  const [status, setStatus] = useState<HubSyncStatus>(isSupabaseConfigured ? 'idle' : 'ready')
  const [error, setError] = useState('')
  const revisionRef = useRef(0)

  useEffect(() => {
    if (isSupabaseConfigured || !activeMemberId) return
    const stored = localStorage.getItem('studio32-hub-v5')
    if (!stored) return

    try {
      setState({ ...initialState, ...JSON.parse(stored) } as HubState)
    } catch {
      localStorage.removeItem('studio32-hub-v5')
    }
  }, [activeMemberId])

  useEffect(() => {
    if (!supabase || !activeMemberId) {
      if (isSupabaseConfigured) setStatus('idle')
      return
    }
    const client = supabase

    let cancelled = false
    setStatus('loading')
    setError('')

    const loadState = async () => {
      const { data, error: loadError } = await client
        .from('hub_states')
        .select('payload, revision')
        .eq('workspace_id', 'studio32')
        .maybeSingle()

      if (cancelled) return

      if (loadError) {
        setError('No se han podido cargar los datos compartidos.')
        setStatus('error')
        return
      }

      if (data?.payload) {
        revisionRef.current = Number(data.revision)
        setState(normalizeHubState(data.payload))
        setStatus('ready')
        return
      }

      const { data: created, error: createError } = await client
        .from('hub_states')
        .insert({ workspace_id: 'studio32', payload: initialState })
        .select('payload, revision')
        .single()

      if (cancelled) return
      if (createError) {
        setError('No se ha podido preparar el espacio compartido.')
        setStatus('error')
        return
      }

      revisionRef.current = Number(created.revision)
      setState(normalizeHubState(created.payload))
      setStatus('ready')
    }

    void loadState()

    const channel = client
      .channel('studio32-hub-state')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hub_states', filter: 'workspace_id=eq.studio32' },
        (event) => {
          const row = event.new as { payload?: unknown; revision?: number } | null
          const payload = row?.payload
          const incomingRevision = Number(row?.revision ?? 0)
          if (payload && incomingRevision >= revisionRef.current) {
            revisionRef.current = incomingRevision
            setState(normalizeHubState(payload))
            setStatus('ready')
            setError('')
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void client.removeChannel(channel)
    }
  }, [activeMemberId])

  const persistSharedState = async (
    updater: (current: HubState) => HubState,
    next: HubState,
    expectedRevision: number,
  ) => {
    if (!supabase || !activeMemberId) return
    const client = supabase
    const save = (payload: HubState, revision: number) => client
      .from('hub_states')
      .update({ payload })
      .eq('workspace_id', 'studio32')
      .eq('revision', revision)
      .select('payload, revision')
      .maybeSingle()

    const { data, error: saveError } = await save(next, expectedRevision)

    if (saveError) {
      setError('Hay cambios pendientes de sincronizar. Comprueba la conexión.')
      setStatus('error')
      return
    }

    if (data) {
      revisionRef.current = Number(data.revision)
      setError('')
      setStatus('ready')
      return
    }

    const { data: latest, error: reloadError } = await client
      .from('hub_states')
      .select('payload, revision')
      .eq('workspace_id', 'studio32')
      .single()

    if (reloadError) {
      setError('El Hub ha cambiado en otro dispositivo. Recarga para continuar.')
      setStatus('error')
      return
    }

    const rebased = updater(normalizeHubState(latest.payload))
    setState(rebased)
    const { data: retried, error: retryError } = await save(rebased, Number(latest.revision))
    if (retryError || !retried) {
      setError('No se ha podido combinar un cambio simultáneo. Recarga para continuar.')
      setStatus('error')
      return
    }

    revisionRef.current = Number(retried.revision)
    setError('')
    setStatus('ready')
  }

  const updateState = (updater: (current: HubState) => HubState) => {
    setState((current) => {
      const next = updater(current)
      if (isSupabaseConfigured) {
        const expectedRevision = revisionRef.current
        void persistSharedState(updater, next, expectedRevision)
      } else {
        localStorage.setItem('studio32-hub-v5', JSON.stringify(next))
      }
      return next
    })
  }

  return [state, updateState, status, error] as const
}

function getMember(id: MemberId) {
  return members.find((member) => member.id === id) ?? members[0]
}

function getProject(projects: Project[], id: ProjectId) {
  return projects.find((project) => project.id === id) ?? projects[0]
}

function getProjectProgress(state: HubState, projectId: ProjectId) {
  const projectTasks = state.tasks.filter((task) => task.projectId === projectId)
  if (!projectTasks.length) return 0
  return Math.round((projectTasks.filter((task) => task.status === 'done').length / projectTasks.length) * 100)
}

function formatOpenTasks(count: number, short = false) {
  if (short) return `${count} ${count === 1 ? 'abierta' : 'abiertas'}`
  return `${count} ${count === 1 ? 'tarea abierta' : 'tareas abiertas'}`
}

function getTodayLabel() {
  const formatted = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Madrid',
  }).format(new Date())
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function getGreeting() {
  const hour = Number(new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Madrid',
  }).format(new Date()))
  if (hour < 14) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const pinLength = 6

function demoPinStorageKey(memberId: MemberId) {
  return `studio32-demo-pin-v1:${memberId}`
}

async function hashDemoPin(memberId: MemberId, pin: string) {
  const input = new TextEncoder().encode(`studio32-local:${memberId}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function App() {
  const [activeMemberId, setActiveMemberId] = useState<MemberId | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [state, updateState, syncStatus, syncError] = usePersistentHubState(activeMemberId)

  useEffect(() => {
    if (supabase) {
      const resolveMember = (email?: string | null) => {
        const member = members.find((candidate) => candidate.email.toLowerCase() === email?.toLowerCase())
        setActiveMemberId(member?.id ?? null)
        setAuthReady(true)
      }

      void supabase.auth.getSession().then(({ data }) => resolveMember(data.session?.user.email))
      const { data } = supabase.auth.onAuthStateChange((_event, session) => resolveMember(session?.user.email))
      return () => data.subscription.unsubscribe()
    }

    const stored = localStorage.getItem('studio32-current-member-v3')
    if (members.some((member) => member.id === stored)) {
      setActiveMemberId(stored as MemberId)
    }
    setAuthReady(true)
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The Hub still works when service workers are unavailable.
    })
  }, [])
  const [view, setView] = useState<MainView>('today')
  const [projectTab, setProjectTab] = useState<ProjectTab>('overview')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [projectEditor, setProjectEditor] = useState<{ mode: 'create' } | { mode: 'edit'; projectId: ProjectId } | null>(null)
  const [pinChangeOpen, setPinChangeOpen] = useState(false)
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false)
  const [search, setSearch] = useState('')

  const activeMember = activeMemberId ? getMember(activeMemberId) : null
  const selectedProject = getProject(state.projects, state.selectedProjectId)

  const saveProject = (project: ProjectInput) => {
    if (projectEditor?.mode === 'edit') {
      const projectId = projectEditor.projectId
      updateState((current) => ({
        ...current,
        projects: current.projects.map((item) => item.id === projectId ? { ...item, ...project } : item),
      }))
      setProjectEditor(null)
      return
    }

    const accents = ['#2f6f73', '#486ca8', '#9a5a32', '#7a5b8e', '#68733f']
    const nextProject: Project = {
      ...project,
      id: makeId('project'),
      accent: accents[state.projects.length % accents.length],
    }
    updateState((current) => ({
      ...current,
      projects: [...current.projects, nextProject],
      selectedProjectId: nextProject.id,
    }))
    setProjectEditor(null)
    setProjectTab('overview')
    setView('project')
  }

  const openProject = (projectId: ProjectId) => {
    updateState((current) => ({ ...current, selectedProjectId: projectId }))
    setProjectTab('overview')
    setMobileAccountOpen(false)
    setSearch('')
    setView('project')
  }

  const selectView = (nextView: Exclude<MainView, 'project'>) => {
    setMobileAccountOpen(false)
    setSearch('')
    setView(nextView)
  }

  const signIn = async (memberId: MemberId, pin: string) => {
    if (supabase) {
      const member = getMember(memberId)
      const password = await pinToPassword(memberId, pin)
      const { error } = await supabase.auth.signInWithPassword({ email: member.email, password })
      if (error) return 'El PIN no es correcto o el acceso todavía no está activo.'
      return null
    }

    localStorage.setItem('studio32-current-member-v3', memberId)
    setActiveMemberId(memberId)
    return null
  }

  const signOut = async () => {
    setMobileAccountOpen(false)
    if (supabase) {
      await supabase.auth.signOut()
      return
    }
    localStorage.removeItem('studio32-current-member-v3')
    setActiveMemberId(null)
  }

  const changePin = async (currentPin: string, nextPin: string) => {
    if (!supabase || !activeMemberId) return 'No se puede cambiar el PIN en este dispositivo.'
    const member = getMember(activeMemberId)
    const currentPassword = await pinToPassword(activeMemberId, currentPin)
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: member.email, password: currentPassword })
    if (verifyError) return 'El PIN actual no es correcto.'

    const nextPassword = await pinToPassword(activeMemberId, nextPin)
    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword })
    if (updateError) return 'No se ha podido cambiar el PIN. Inténtalo de nuevo.'
    return null
  }

  const toggleTask = (taskId: string) => {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, status: task.status === 'done' ? 'todo' : 'done', blocked: false } : task,
      ),
    }))
  }

  const addMessage = (projectId: ProjectId, body: string) => {
    if (!activeMemberId || !body.trim()) return
    updateState((current) => ({
      ...current,
      updates: [
        {
          id: makeId('u'),
          projectId,
          authorId: activeMemberId,
          kind: 'message',
          body: body.trim(),
          createdAt: 'Ahora',
        },
        ...current.updates,
      ],
    }))
  }

  const addBoardItem = (projectId: ProjectId, title: string) => {
    if (!activeMemberId || !title.trim()) return
    updateState((current) => ({
      ...current,
      boardItems: [
        ...current.boardItems,
        { id: makeId('b'), projectId, title: title.trim(), lane: 'ideas', authorId: activeMemberId },
      ],
    }))
  }

  const updateTeamCheckIn = (availability: TeamAvailability, focus: string) => {
    if (!activeMemberId || !focus.trim()) return
    updateState((current) => ({
      ...current,
      teamCheckIns: current.teamCheckIns.some((checkIn) => checkIn.memberId === activeMemberId)
        ? current.teamCheckIns.map((checkIn) =>
            checkIn.memberId === activeMemberId
              ? { ...checkIn, availability, focus: focus.trim(), updatedAt: 'Ahora' }
              : checkIn,
          )
        : [...current.teamCheckIns, { memberId: activeMemberId, availability, focus: focus.trim(), updatedAt: 'Ahora' }],
    }))
  }

  const addAgendaEvent = (event: Omit<AgendaEvent, 'id'>) => {
    if (!event.title.trim() || !event.time) return
    updateState((current) => ({
      ...current,
      agendaEvents: [
        ...current.agendaEvents,
        { ...event, id: makeId('a'), title: event.title.trim(), meta: event.meta.trim() || 'Studio32' },
      ].sort((a, b) => a.time.localeCompare(b.time)),
    }))
  }

  const removeAgendaEvent = (eventId: string) => {
    updateState((current) => ({
      ...current,
      agendaEvents: current.agendaEvents.filter((event) => event.id !== eventId),
    }))
  }

  const advanceBoardItem = (itemId: string) => {
    const laneOrder: BoardLane[] = ['ideas', 'decided', 'doing']
    updateState((current) => ({
      ...current,
      boardItems: current.boardItems.map((item) => {
        if (item.id !== itemId) return item
        const nextIndex = (laneOrder.indexOf(item.lane) + 1) % laneOrder.length
        return { ...item, lane: laneOrder[nextIndex] }
      }),
    }))
  }

  const addCapture = (payload: CapturePayload) => {
    if (!activeMemberId || !payload.title.trim()) return
    const title = payload.title.trim()
    const detail = payload.detail?.trim()

    updateState((current) => {
      if (payload.destination === 'inbox') {
        return {
          ...current,
          inbox: [
            {
              id: makeId('i'),
              type: payload.type,
              title,
              detail,
              authorId: activeMemberId,
              createdAt: 'Ahora',
            },
            ...current.inbox,
          ],
        }
      }

      if (payload.type === 'task') {
        return {
          ...current,
          tasks: [
            {
              id: makeId('t'),
              projectId: payload.destination,
              title,
              status: 'todo',
              ownerId: payload.ownerId ?? activeMemberId,
              due: payload.due ?? 'Sin fecha',
              priority: payload.priority ?? 'Media',
            },
            ...current.tasks,
          ],
        }
      }

      if (payload.type === 'link') {
        return {
          ...current,
          resources: [
            {
              id: makeId('r'),
              projectId: payload.destination,
              title,
              type: 'Link',
              url: detail || '#',
              updatedAt: 'Ahora',
            },
            ...current.resources,
          ],
        }
      }

      return {
        ...current,
        updates: [
          {
            id: makeId('u'),
            projectId: payload.destination,
            authorId: activeMemberId,
            kind: payload.type,
            body: detail ? `${title}: ${detail}` : title,
            createdAt: 'Ahora',
          },
          ...current.updates,
        ],
      }
    })

    setCaptureOpen(false)
  }

  const moveInboxItem = (itemId: string, projectId: ProjectId) => {
    const item = state.inbox.find((candidate) => candidate.id === itemId)
    if (!item) return

    updateState((current) => {
      const withoutItem = current.inbox.filter((candidate) => candidate.id !== itemId)
      if (item.type === 'task') {
        return {
          ...current,
          inbox: withoutItem,
          tasks: [
            {
              id: makeId('t'),
              projectId,
              title: item.title,
              status: 'todo',
              ownerId: item.authorId,
              due: 'Sin fecha',
              priority: 'Media',
            },
            ...current.tasks,
          ],
        }
      }
      if (item.type === 'link') {
        return {
          ...current,
          inbox: withoutItem,
          resources: [
            {
              id: makeId('r'),
              projectId,
              title: item.title,
              type: 'Link',
              url: item.detail || '#',
              updatedAt: 'Ahora',
            },
            ...current.resources,
          ],
        }
      }
      return {
        ...current,
        inbox: withoutItem,
        updates: [
          {
            id: makeId('u'),
            projectId,
            authorId: item.authorId,
            kind: item.type,
            body: item.detail ? `${item.title}: ${item.detail}` : item.title,
            createdAt: 'Ahora',
          },
          ...current.updates,
        ],
      }
    })
  }

  const dismissInboxItem = (itemId: string) => {
    updateState((current) => ({ ...current, inbox: current.inbox.filter((item) => item.id !== itemId) }))
  }

  if (!authReady) {
    return <SystemScreen title="Abriendo Studio32 Hub" description="Comprobando tu sesión segura..." />
  }

  if (!activeMember) {
    return <AccessScreen onAuthenticate={signIn} sharedAuth={isSupabaseConfigured} />
  }

  if (syncStatus === 'loading' || syncStatus === 'idle') {
    return <SystemScreen title={`Hola, ${activeMember.name}`} description="Cargando el espacio compartido..." />
  }

  if (syncStatus === 'error' && state === initialState) {
    return <SystemScreen title="No podemos abrir el Hub" description={syncError} actionLabel="Cerrar sesión" onAction={signOut} />
  }

  const searchTerm = search.trim().toLocaleLowerCase('es')

  return (
    <div className="hub-shell">
      <Sidebar
        activeView={view}
        activeMember={activeMember}
        inboxCount={state.inbox.length}
        selectedProjectId={state.selectedProjectId}
        projects={state.projects}
        onNavigate={selectView}
        onOpenProject={openProject}
        onCapture={() => setCaptureOpen(true)}
        onChangePin={isSupabaseConfigured ? () => setPinChangeOpen(true) : undefined}
        onSignOut={signOut}
      />

      <section className="workspace">
        <header className="workspace-topbar">
          <div className="mobile-topbar-brand" aria-label="Studio32 Hub">
            <span className="brand-mark">32</span>
            <span><strong>Studio32</strong><small>Hub</small></span>
          </div>
          <label className="global-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar en el Hub..."
              aria-label="Buscar en Studio32"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
          </label>
          <div className="topbar-actions">
            {syncError && <span className="sync-warning"><AlertCircle size={15} /> {syncError}</span>}
            <button
              className="mobile-account-trigger"
              type="button"
              onClick={() => setMobileAccountOpen((current) => !current)}
              aria-label={`Cuenta de ${activeMember.name}`}
              aria-expanded={mobileAccountOpen}
            >
              <Avatar member={activeMember} />
            </button>
            <button className="primary-action" type="button" onClick={() => { setMobileAccountOpen(false); setCaptureOpen(true) }} data-testid="quick-capture" aria-label="Capturar">
              <Plus size={17} />
              <span>Capturar</span>
            </button>
          </div>
          {mobileAccountOpen && (
            <section className="mobile-account-menu" aria-label={`Cuenta de ${activeMember.name}`}>
              <header>
                <Avatar member={activeMember} />
                <span><strong>{activeMember.name}</strong><small>{activeMember.email}</small></span>
                <button type="button" onClick={() => setMobileAccountOpen(false)} aria-label="Cerrar menú de cuenta"><X size={17} /></button>
              </header>
              {isSupabaseConfigured && (
                <button type="button" onClick={() => { setMobileAccountOpen(false); setPinChangeOpen(true) }}><KeyRound size={17} /> Cambiar PIN</button>
              )}
              <button type="button" onClick={() => void signOut()}><LogOut size={17} /> Cerrar sesión</button>
            </section>
          )}
        </header>

        <main className="workspace-main">
          {searchTerm ? (
            <SearchResults
              term={searchTerm}
              state={state}
              onOpenProject={openProject}
              onToggleTask={toggleTask}
            />
          ) : view === 'today' ? (
            <TodayView
              member={activeMember}
              state={state}
              onToggleTask={toggleTask}
              onOpenProject={openProject}
              onOpenInbox={() => selectView('inbox')}
              onUpdateCheckIn={updateTeamCheckIn}
              onAddAgendaEvent={addAgendaEvent}
              onRemoveAgendaEvent={removeAgendaEvent}
            />
          ) : view === 'projects' ? (
            <ProjectsView
              state={state}
              onOpenProject={openProject}
              onCreateProject={() => setProjectEditor({ mode: 'create' })}
              onEditProject={(projectId) => setProjectEditor({ mode: 'edit', projectId })}
            />
          ) : view === 'inbox' ? (
            <InboxView
              items={state.inbox}
              projects={state.projects}
              onMove={moveInboxItem}
              onDismiss={dismissInboxItem}
              onCapture={() => setCaptureOpen(true)}
            />
          ) : view === 'library' ? (
            <LibraryView state={state} onOpenProject={openProject} />
          ) : (
            <ProjectView
              project={selectedProject}
              state={state}
              activeMember={activeMember}
              activeTab={projectTab}
              onBack={() => selectView('projects')}
              onTabChange={setProjectTab}
              onToggleTask={toggleTask}
              onAddMessage={addMessage}
              onAddBoardItem={addBoardItem}
              onAdvanceBoardItem={advanceBoardItem}
              onCapture={() => setCaptureOpen(true)}
              onEditProject={() => setProjectEditor({ mode: 'edit', projectId: selectedProject.id })}
            />
          )}
        </main>
      </section>

      {captureOpen && (
        <CaptureDialog
          selectedProjectId={view === 'project' ? state.selectedProjectId : undefined}
          projects={state.projects}
          activeMemberId={activeMember.id}
          onClose={() => setCaptureOpen(false)}
          onSubmit={addCapture}
        />
      )}
      {projectEditor && (
        <ProjectDialog
          project={projectEditor.mode === 'edit' ? getProject(state.projects, projectEditor.projectId) : undefined}
          onClose={() => setProjectEditor(null)}
          onSubmit={saveProject}
        />
      )}
      {pinChangeOpen && activeMember && (
        <PinChangeDialog
          member={activeMember}
          onClose={() => setPinChangeOpen(false)}
          onSubmit={changePin}
        />
      )}
    </div>
  )
}

function SystemScreen({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void | Promise<void>
}) {
  return (
    <main className="access-screen">
      <section className="access-panel system-panel" aria-live="polite">
        <div className="brand-lockup access-brand">
          <span className="brand-mark">32</span>
          <span><strong>Studio32 Hub</strong><small>Espacio de trabajo privado</small></span>
        </div>
        <div className="system-message">
          <span className="system-loader" aria-hidden="true" />
          <h1>{title}</h1>
          <p>{description}</p>
          {actionLabel && onAction && <button className="access-submit" type="button" onClick={() => void onAction()}>{actionLabel}</button>}
        </div>
      </section>
    </main>
  )
}

function AccessScreen({
  onAuthenticate,
  sharedAuth,
}: {
  onAuthenticate: (memberId: MemberId, pin: string) => Promise<string | null>
  sharedAuth: boolean
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<MemberId | null>(null)
  const [mode, setMode] = useState<'setup' | 'unlock'>('unlock')
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedMember = selectedMemberId ? getMember(selectedMemberId) : null

  const selectMember = (memberId: MemberId) => {
    setSelectedMemberId(memberId)
    setMode(sharedAuth || localStorage.getItem(demoPinStorageKey(memberId)) ? 'unlock' : 'setup')
    setPin('')
    setConfirmation('')
    setError('')
  }

  const goBack = () => {
    setSelectedMemberId(null)
    setPin('')
    setConfirmation('')
    setError('')
  }

  const resetLocalPin = () => {
    if (!selectedMember) return
    localStorage.removeItem(demoPinStorageKey(selectedMember.id))
    setMode('setup')
    setPin('')
    setConfirmation('')
    setError('')
  }

  const updatePin = (value: string, setter: (next: string) => void) => {
    setter(value.replace(/\D/g, '').slice(0, pinLength))
    if (error) setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedMember) return

    if (pin.length !== pinLength) {
      setError(`El PIN debe tener ${pinLength} dígitos.`)
      return
    }

    if (sharedAuth) {
      setBusy(true)
      const authenticationError = await onAuthenticate(selectedMember.id, pin)
      if (authenticationError) {
        setBusy(false)
        setPin('')
        setError(authenticationError)
      }
      return
    }

    if (mode === 'setup' && pin !== confirmation) {
      setError('Los dos PIN no coinciden.')
      return
    }

    setBusy(true)
    const pinHash = await hashDemoPin(selectedMember.id, pin)

    if (mode === 'setup') {
      localStorage.setItem(demoPinStorageKey(selectedMember.id), pinHash)
      await onAuthenticate(selectedMember.id, pin)
      return
    }

    const storedHash = localStorage.getItem(demoPinStorageKey(selectedMember.id))
    if (storedHash !== pinHash) {
      setBusy(false)
      setPin('')
      setError('El PIN no es correcto.')
      return
    }

    await onAuthenticate(selectedMember.id, pin)
  }

  return (
    <main className="access-screen">
      <section className="access-panel" aria-labelledby="access-title">
        <div className="brand-lockup access-brand">
          <span className="brand-mark">32</span>
          <span>
            <strong>Studio32 Hub</strong>
            <small>Espacio de trabajo privado</small>
          </span>
        </div>
        {!selectedMember ? (
          <>
            <div className="access-copy">
              <span className="eyebrow">Acceso seguro de equipo</span>
              <h1 id="access-title">¿Quién entra hoy?</h1>
              <p>Selecciona tu perfil para continuar.</p>
            </div>
            <div className="profile-choice">
              {members.map((member) => (
                <button key={member.id} type="button" onClick={() => selectMember(member.id)} data-testid={`profile-${member.id}`}>
                  <Avatar member={member} size="large" />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.email}</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="access-back" type="button" onClick={goBack}><ArrowLeft size={15} /> Cambiar perfil</button>
            <div className="access-profile">
              <Avatar member={selectedMember} size="large" />
              <span><strong>{selectedMember.name}</strong><small>{selectedMember.email}</small></span>
            </div>
            <div className="access-copy pin-copy">
              <span className="eyebrow">{mode === 'setup' ? 'Primera entrada' : 'Acceso personal'}</span>
              <h1 id="access-title">{mode === 'setup' ? 'Crea tu PIN' : `Hola, ${selectedMember.name}`}</h1>
              <p>{mode === 'setup' ? 'Elige un PIN de 6 dígitos para entrar desde este dispositivo.' : 'Introduce tu PIN personal de 6 dígitos.'}</p>
            </div>
            <form className="access-form" onSubmit={submit}>
              <label htmlFor="access-pin">PIN</label>
              <input
                id="access-pin"
                className="pin-input"
                type="password"
                inputMode="numeric"
                autoComplete={mode === 'setup' ? 'new-password' : 'one-time-code'}
                value={pin}
                onChange={(event) => updatePin(event.target.value, setPin)}
                placeholder="••••••"
                aria-describedby={error ? 'access-error' : undefined}
                data-testid="access-pin"
                autoFocus
              />
              {mode === 'setup' && (
                <>
                  <label htmlFor="access-pin-confirmation">Repite el PIN</label>
                  <input
                    id="access-pin-confirmation"
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) => updatePin(event.target.value, setConfirmation)}
                    placeholder="••••••"
                    data-testid="access-pin-confirmation"
                  />
                </>
              )}
              {error && <p className="access-error" id="access-error" role="alert">{error}</p>}
              <button
                className="access-submit"
                type="submit"
                disabled={busy || pin.length !== pinLength || (mode === 'setup' && confirmation.length !== pinLength)}
                data-testid="access-submit"
              >
                {busy ? 'Comprobando...' : mode === 'setup' ? 'Guardar y entrar' : 'Entrar al Hub'}
                {!busy && <ArrowRight size={17} />}
              </button>
              {!sharedAuth && mode === 'unlock' && import.meta.env.DEV && (
                <button className="local-pin-reset" type="button" onClick={resetLocalPin} data-testid="reset-local-pin">
                  Restablecer PIN local
                </button>
              )}
            </form>
          </>
        )}
        <div className="access-foot">
          <span><Check size={14} /> Acceso protegido por Supabase</span>
          <span>Solo Juanma, Pancho y Gonzalo</span>
        </div>
      </section>
    </main>
  )
}

function Sidebar({
  activeView,
  activeMember,
  inboxCount,
  selectedProjectId,
  projects,
  onNavigate,
  onOpenProject,
  onCapture,
  onChangePin,
  onSignOut,
}: {
  activeView: MainView
  activeMember: Member
  inboxCount: number
  selectedProjectId: ProjectId
  projects: Project[]
  onNavigate: (view: Exclude<MainView, 'project'>) => void
  onOpenProject: (projectId: ProjectId) => void
  onCapture: () => void
  onChangePin?: () => void
  onSignOut: () => void | Promise<void>
}) {
  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <div className="brand-lockup">
        <span className="brand-mark">32</span>
        <span>
          <strong>Studio32 Hub</strong>
          <small>Workspace interno</small>
        </span>
      </div>

      <button className="sidebar-capture" type="button" onClick={onCapture}>
        <Plus size={17} />
        Captura rápida
      </button>

      <nav className="main-navigation">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = item.id === activeView || (item.id === 'projects' && activeView === 'project')
          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? 'is-active' : ''}
              onClick={() => onNavigate(item.id)}
              data-testid={`nav-${item.id}`}
              aria-label={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.id === 'inbox' && inboxCount > 0 && <b>{inboxCount}</b>}
            </button>
          )
        })}
      </nav>

      <div className="sidebar-projects">
        <div className="sidebar-section-title">
          <span>Proyectos activos</span>
          <MoreHorizontal size={16} />
        </div>
        {projects.filter((project) => project.status !== 'Archivado' && project.status !== 'Completado').map((project) => (
          <button
            key={project.id}
            type="button"
            className={activeView === 'project' && selectedProjectId === project.id ? 'is-active' : ''}
            onClick={() => onOpenProject(project.id)}
          >
            <span className="project-dot" style={{ background: project.accent }} />
            <span>{project.name}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-team">
        <span>Equipo Studio32</span>
        <div className="avatar-stack" aria-label="Tres miembros del equipo">
          {members.map((member) => <Avatar key={member.id} member={member} />)}
        </div>
      </div>

      <div className="sidebar-account">
        <Avatar member={activeMember} />
        <span>
          <strong>{activeMember.name}</strong>
          <small>Vista personal</small>
        </span>
        {onChangePin && <button type="button" onClick={onChangePin} aria-label="Cambiar PIN" title="Cambiar PIN"><KeyRound size={17} /></button>}
        <button type="button" onClick={() => void onSignOut()} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  )
}

function TodayView({
  member,
  state,
  onToggleTask,
  onOpenProject,
  onOpenInbox,
  onUpdateCheckIn,
  onAddAgendaEvent,
  onRemoveAgendaEvent,
}: {
  member: Member
  state: HubState
  onToggleTask: (taskId: string) => void
  onOpenProject: (projectId: ProjectId) => void
  onOpenInbox: () => void
  onUpdateCheckIn: (availability: TeamAvailability, focus: string) => void
  onAddAgendaEvent: (event: Omit<AgendaEvent, 'id'>) => void
  onRemoveAgendaEvent: (eventId: string) => void
}) {
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [agendaOpen, setAgendaOpen] = useState(false)
  const myTasks = state.tasks.filter((task) => task.ownerId === member.id && task.status !== 'done')
  const todayTasks = myTasks.filter((task) => task.due.startsWith('Hoy'))
  const attentionTasks = state.tasks.filter((task) => task.blocked)
  const openTasks = state.tasks.filter((task) => task.status !== 'done')
  const currentCheckIn = state.teamCheckIns.find((checkIn) => checkIn.memberId === member.id)
  const studioFocusTask = state.tasks.find((task) => task.status === 'doing' && !task.blocked) ?? openTasks[0]

  return (
    <div className="page today-page">
      <PageHeading
        eyebrow={getTodayLabel()}
        title={`${getGreeting()}, ${member.name}`}
        description="Prioridades, agenda y estado del equipo sin tener que buscar en cinco sitios."
        meta={
          <button className="team-capacity team-check-in-trigger" type="button" onClick={() => setCheckInOpen(true)} data-testid="update-check-in">
            <Users size={16} /> Actualizar mi foco
          </button>
        }
      />

      <section className="daily-summary" aria-label="Resumen del día">
        <SummaryMetric value={todayTasks.length} label="tareas para hoy" tone="green" />
        <SummaryMetric value={state.agendaEvents.length} label="bloques en agenda" tone="blue" />
        <SummaryMetric value={attentionTasks.length} label={attentionTasks.length === 1 ? 'bloqueo activo' : 'bloqueos activos'} tone="amber" />
        <div className="summary-focus">
          <Sparkles size={17} />
          <span>
            <small>Siguiente movimiento</small>
            <strong>{studioFocusTask?.title ?? 'Definir la prioridad principal del estudio'}</strong>
          </span>
        </div>
      </section>

      <section className="surface team-today-surface">
        <SectionHeader
          icon={<Users size={18} />}
          title="Equipo hoy"
          action={<button type="button" onClick={() => setCheckInOpen(true)}><Plus size={14} /> Mi actualización</button>}
        />
        <div className="team-focus-grid">
          {members.map((teamMember) => {
            const checkIn = state.teamCheckIns.find((item) => item.memberId === teamMember.id)
            return (
              <article className="team-focus-item" key={teamMember.id}>
                <Avatar member={teamMember} />
                <span className="team-focus-content">
                  <span className="team-focus-meta">
                    <strong>{teamMember.name}</strong>
                    {checkIn && <b className={`availability availability-${checkIn.availability}`}>{availabilityLabels[checkIn.availability]}</b>}
                  </span>
                  <p>{checkIn?.focus ?? 'Todavía no ha dejado su foco de hoy.'}</p>
                  <small>{checkIn?.updatedAt ?? 'Sin actualizar'}</small>
                </span>
              </article>
            )
          })}
        </div>
      </section>

      <div className="today-grid">
        <section className="surface focus-surface">
          <SectionHeader icon={<CheckCircle2 size={18} />} title="Tu foco" action={formatOpenTasks(myTasks.length, true)} />
          <div className="task-list">
            {myTasks.slice(0, 5).map((task) => (
              <TaskRow key={task.id} task={task} projects={state.projects} onToggle={onToggleTask} onOpenProject={onOpenProject} />
            ))}
            {!myTasks.length && <EmptyState icon={<CheckCircle2 size={23} />} title="Sin tareas asignadas" body="Usa Capturar para añadir la primera tarea." />}
          </div>
        </section>

        <section className="surface agenda-surface">
          <SectionHeader icon={<CalendarDays size={18} />} title="Agenda compartida" action={<button type="button" onClick={() => setAgendaOpen(true)}><Plus size={14} /> Añadir</button>} />
          <div className="agenda-list">
            {state.agendaEvents.map((event) => (
              <div className="agenda-row" key={event.id}>
                <time>{event.time}</time>
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.meta}</small>
                </span>
                <button type="button" onClick={() => onRemoveAgendaEvent(event.id)} aria-label={`Eliminar ${event.title}`} title="Eliminar bloque"><X size={15} /></button>
              </div>
            ))}
            {!state.agendaEvents.length && <EmptyState icon={<CalendarDays size={23} />} title="Agenda vacía" body="Añade aquí reuniones y bloques importantes del día." />}
          </div>
        </section>

        <section className="surface attention-surface">
          <SectionHeader icon={<AlertCircle size={18} />} title="Necesita atención" action={`${attentionTasks.length + state.inbox.length}`} />
          {attentionTasks.map((task) => (
            <button className="attention-row" key={task.id} type="button" onClick={() => onOpenProject(task.projectId)}>
              <span className="attention-icon"><AlertCircle size={17} /></span>
              <span>
                <strong>{task.title}</strong>
                <small>{getProject(state.projects, task.projectId).name} · Esperando respuesta</small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
          <button className="attention-row" type="button" onClick={onOpenInbox}>
            <span className="attention-icon neutral"><Inbox size={17} /></span>
            <span>
              <strong>{state.inbox.length} elementos por ordenar</strong>
              <small>Revisar el Inbox antes de terminar el día</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </section>

        <section className="surface movement-surface">
          <SectionHeader icon={<MessageCircle size={18} />} title="Últimos movimientos" action="Equipo" />
          <div className="updates-list compact">
            {state.updates.slice(0, 4).map((update) => (
              <UpdateRow key={update.id} update={update} projects={state.projects} onOpenProject={onOpenProject} />
            ))}
            {!state.updates.length && <EmptyState icon={<MessageCircle size={23} />} title="Sin actividad todavía" body="Los mensajes, notas y decisiones aparecerán aquí." />}
          </div>
        </section>
      </div>

      <section className="projects-overview">
        <SectionHeader icon={<FolderKanban size={18} />} title="Pulso de proyectos" action={formatOpenTasks(openTasks.length)} />
        <div className="project-pulse-grid">
          {state.projects.filter((project) => project.status !== 'Archivado' && project.status !== 'Completado').map((project) => {
            const projectTasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== 'done')
            const progress = getProjectProgress(state, project.id)
            return (
              <button className="project-pulse" key={project.id} type="button" onClick={() => onOpenProject(project.id)}>
                <span className="project-line" style={{ background: project.accent }} />
                <span className="project-pulse-head">
                  <span>
                    <small>{project.client}</small>
                    <strong>{project.name}</strong>
                  </span>
                  <span className="health-value">{progress}%</span>
                </span>
                <span className="progress-track"><i style={{ width: `${progress}%`, background: project.accent }} /></span>
                <span className="project-pulse-foot">
                  <span>{project.status}</span>
                  <span>{formatOpenTasks(projectTasks.length, true)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {checkInOpen && (
        <CheckInDialog
          member={member}
          checkIn={currentCheckIn ?? { memberId: member.id, availability: 'available', focus: '', updatedAt: 'Sin actualizar' }}
          onClose={() => setCheckInOpen(false)}
          onSubmit={(availability, focus) => {
            onUpdateCheckIn(availability, focus)
            setCheckInOpen(false)
          }}
        />
      )}
      {agendaOpen && (
        <AgendaDialog
          onClose={() => setAgendaOpen(false)}
          onSubmit={(event) => {
            onAddAgendaEvent(event)
            setAgendaOpen(false)
          }}
        />
      )}
    </div>
  )
}

function ProjectsView({
  state,
  onOpenProject,
  onCreateProject,
  onEditProject,
}: {
  state: HubState
  onOpenProject: (projectId: ProjectId) => void
  onCreateProject: () => void
  onEditProject: (projectId: ProjectId) => void
}) {
  const areas = (Object.keys(projectAreaLabels) as ProjectArea[])
  const activeProjects = state.projects.filter((project) => project.status !== 'Archivado' && project.status !== 'Completado').length
  return (
    <div className="page">
      <PageHeading
        eyebrow="Trabajo activo"
        title="Proyectos"
        description="Trabajo de clientes, proyectos internos y memoria del estudio, cada cosa en su rama."
        meta={<button className="secondary-action" type="button" onClick={onCreateProject}><Plus size={16} /> Nuevo proyecto</button>}
      />
      <div className="project-branch-summary" aria-label="Ramas del estudio">
        {areas.map((area) => (
          <span key={area}><strong>{state.projects.filter((project) => project.area === area).length}</strong><small>{projectAreaLabels[area]}</small></span>
        ))}
        <span className="project-active-summary"><strong>{activeProjects}</strong><small>En circulación</small></span>
      </div>
      <section className="project-table surface">
        <div className="project-table-head">
          <span>Proyecto</span>
          <span>Estado</span>
          <span>Próximo hito</span>
          <span>Progreso</span>
          <span />
        </div>
        {areas.map((area) => {
          const areaProjects = state.projects.filter((project) => project.area === area)
          if (!areaProjects.length) return null
          return (
            <div className="project-branch" key={area}>
              <div className="project-branch-head"><span>{projectAreaLabels[area]}</span><small>{areaProjects.length} {areaProjects.length === 1 ? 'proyecto' : 'proyectos'}</small></div>
              {areaProjects.map((project) => {
                const projectTasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== 'done')
                const owners = [...new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.ownerId))]
                const progress = getProjectProgress(state, project.id)
                return (
                  <article className="project-table-row" key={project.id}>
                    <button className="project-name-cell project-open-cell" type="button" onClick={() => onOpenProject(project.id)}>
                      <i style={{ background: project.accent }} />
                      <span><strong>{project.name}</strong><small>{project.client}{project.topics.length ? ` · ${project.topics.join(', ')}` : ''}</small></span>
                    </button>
                    <span><StatusBadge>{project.status}</StatusBadge></span>
                    <span className="milestone-cell"><strong>{project.nextMilestone}</strong><small>{formatOpenTasks(projectTasks.length)}</small></span>
                    <span className="project-progress-cell">
                      <span><i style={{ width: `${progress}%`, background: project.accent }} /></span>
                      <small>{progress}%</small>
                    </span>
                    <span className="project-row-actions">
                      <span className="avatar-stack small">{owners.map((ownerId) => <Avatar key={ownerId} member={getMember(ownerId)} />)}</span>
                      <button className="icon-button compact" type="button" onClick={() => onEditProject(project.id)} aria-label={`Editar ${project.name}`} title="Editar proyecto"><Pencil size={15} /></button>
                      <button className="icon-button compact" type="button" onClick={() => onOpenProject(project.id)} aria-label={`Abrir ${project.name}`} title="Abrir proyecto"><ChevronRight size={17} /></button>
                    </span>
                  </article>
                )
              })}
            </div>
          )
        })}
      </section>
    </div>
  )
}

function InboxView({
  items,
  projects,
  onMove,
  onDismiss,
  onCapture,
}: {
  items: InboxItem[]
  projects: Project[]
  onMove: (itemId: string, projectId: ProjectId) => void
  onDismiss: (itemId: string) => void
  onCapture: () => void
}) {
  return (
    <div className="page narrow-page">
      <PageHeading
        eyebrow="Entrada compartida"
        title="Inbox"
        description="Ideas, peticiones y enlaces pendientes de encontrar su lugar."
        meta={<button className="secondary-action" type="button" onClick={onCapture}><Plus size={16} /> Añadir</button>}
      />
      <section className="surface inbox-surface">
        <div className="inbox-toolbar">
          <span><Inbox size={17} /> {items.length} pendientes</span>
          <small>Ordénalo o descártalo</small>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={25} />} title="Inbox a cero" body="Todo está en su sitio por ahora." />
        ) : (
          <div className="inbox-list">
            {items.map((item) => <InboxRow key={item.id} item={item} projects={projects} onMove={onMove} onDismiss={onDismiss} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function InboxRow({
  item,
  projects,
  onMove,
  onDismiss,
}: {
  item: InboxItem
  projects: Project[]
  onMove: (itemId: string, projectId: ProjectId) => void
  onDismiss: (itemId: string) => void
}) {
  const [destination, setDestination] = useState<ProjectId>(projects[0]?.id ?? 'studio32')
  const member = getMember(item.authorId)
  return (
    <article className="inbox-row">
      <span className={`capture-type type-${item.type}`}>{captureLabels[item.type]}</span>
      <span className="inbox-content">
        <strong>{item.title}</strong>
        {item.detail && <small>{item.detail}</small>}
        <small>{member.name} · {item.createdAt}</small>
      </span>
      <span className="inbox-actions">
        <select value={destination} onChange={(event) => setDestination(event.target.value as ProjectId)} aria-label={`Destino de ${item.title}`}>
          {projects.filter((project) => project.status !== 'Archivado').map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <button className="small-primary" type="button" onClick={() => onMove(item.id, destination)}>Guardar</button>
        <button className="icon-button compact" type="button" onClick={() => onDismiss(item.id)} aria-label={`Descartar ${item.title}`}><X size={16} /></button>
      </span>
    </article>
  )
}

function LibraryView({ state, onOpenProject }: { state: HubState; onOpenProject: (projectId: ProjectId) => void }) {
  const decisions = state.updates.filter((update) => update.kind === 'decision' || update.kind === 'note')
  return (
    <div className="page">
      <PageHeading
        eyebrow="Memoria del estudio"
        title="Biblioteca"
        description="Entregables, referencias, procesos y decisiones que merece la pena volver a encontrar."
      />
      <div className="library-grid">
        <section className="surface">
          <SectionHeader icon={<LinkIcon size={18} />} title="Recursos" action={`${state.resources.length}`} />
          <div className="resource-list">
            {state.resources.map((resource) => (
              <a key={resource.id} className="resource-row" href={resource.url} target={resource.url === '#' ? undefined : '_blank'} rel="noreferrer">
                <span className={`resource-icon resource-${resource.type.toLowerCase()}`}>
                  {resource.type === 'PDF' ? <FileText size={17} /> : <LinkIcon size={17} />}
                </span>
                <span><strong>{resource.title}</strong><small>{getProject(state.projects, resource.projectId).name} · {resource.updatedAt}</small></span>
                <ArrowRight size={16} />
              </a>
            ))}
            {!state.resources.length && <EmptyState icon={<LinkIcon size={23} />} title="Sin recursos" body="Captura un enlace y guárdalo en un proyecto." />}
          </div>
        </section>
        <section className="surface">
          <SectionHeader icon={<Lightbulb size={18} />} title="Decisiones y notas" action={`${decisions.length}`} />
          <div className="decision-list">
            {decisions.map((update) => (
              <button key={update.id} type="button" onClick={() => onOpenProject(update.projectId)}>
                <span className={`update-kind kind-${update.kind}`}>{updateLabels[update.kind]}</span>
                <strong>{update.body}</strong>
                <small>{getProject(state.projects, update.projectId).name} · {update.createdAt}</small>
              </button>
            ))}
            {!decisions.length && <EmptyState icon={<Lightbulb size={23} />} title="Sin notas ni decisiones" body="Registra aquí el contexto que el equipo debe poder recuperar." />}
          </div>
        </section>
      </div>
    </div>
  )
}

function ProjectView({
  project,
  state,
  activeMember,
  activeTab,
  onBack,
  onTabChange,
  onToggleTask,
  onAddMessage,
  onAddBoardItem,
  onAdvanceBoardItem,
  onCapture,
  onEditProject,
}: {
  project: Project
  state: HubState
  activeMember: Member
  activeTab: ProjectTab
  onBack: () => void
  onTabChange: (tab: ProjectTab) => void
  onToggleTask: (taskId: string) => void
  onAddMessage: (projectId: ProjectId, body: string) => void
  onAddBoardItem: (projectId: ProjectId, title: string) => void
  onAdvanceBoardItem: (itemId: string) => void
  onCapture: () => void
  onEditProject: () => void
}) {
  const tasks = state.tasks.filter((task) => task.projectId === project.id)
  const updates = state.updates.filter((update) => update.projectId === project.id)
  const resources = state.resources.filter((resource) => resource.projectId === project.id)
  const boardItems = state.boardItems.filter((item) => item.projectId === project.id)
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const decisions = updates.filter((update) => update.kind === 'decision')
  const progress = getProjectProgress(state, project.id)

  const tabs: Array<{ id: ProjectTab; label: string }> = [
    { id: 'overview', label: 'Resumen' },
    { id: 'tasks', label: 'Tareas' },
    { id: 'conversation', label: 'Conversación' },
    { id: 'board', label: 'Pizarra' },
    { id: 'files', label: 'Entregables' },
  ]

  return (
    <div className="project-page">
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={16} /> Proyectos</button>
      <section className="project-header" style={{ borderTopColor: project.accent }}>
        <div className="project-header-main">
          <span className="eyebrow">{projectAreaLabels[project.area]} · {project.client}</span>
          <h1>{project.name}</h1>
          <p>{project.focus}</p>
        </div>
        <div className="project-header-side">
          <button className="project-edit-action" type="button" onClick={onEditProject}><Pencil size={15} /> Editar proyecto</button>
          <div className="project-header-stats">
            <span><small>Estado</small><strong>{project.status}</strong></span>
            <span><small>Progreso</small><strong>{progress}%</strong></span>
            <span><small>Abiertas</small><strong>{openTasks.length}</strong></span>
          </div>
        </div>
      </section>

      <div className="project-context-bar">
        <span><Clock3 size={16} /><small>Próximo hito</small><strong>{project.nextMilestone}</strong></span>
        <span className="project-context-topics"><Tags size={16} /><small>Temas</small><strong>{project.topics.length ? project.topics.join(' · ') : 'Sin temas todavía'}</strong></span>
        <span className="project-context-people"><Users size={16} /><small>Equipo</small><span className="avatar-stack small">{members.map((member) => <Avatar key={member.id} member={member} />)}</span></span>
      </div>

      <div className="project-tabs" role="tablist" aria-label="Secciones del proyecto">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onTabChange(tab.id)}>
            {tab.label}
            {tab.id === 'tasks' && <b>{openTasks.length}</b>}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="project-overview-grid">
          <section className="surface">
            <SectionHeader icon={<CheckCircle2 size={18} />} title="Siguiente trabajo" action={formatOpenTasks(openTasks.length, true)} />
            <div className="task-list">
              {openTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} projects={state.projects} onToggle={onToggleTask} />)}
              {!openTasks.length && <EmptyState icon={<CheckCircle2 size={23} />} title="Sin trabajo pendiente" body="Añade la primera tarea desde Capturar." />}
            </div>
          </section>
          <section className="surface">
            <SectionHeader icon={<Lightbulb size={18} />} title="Decisiones" action={`${decisions.length}`} />
            {decisions.length ? (
              <div className="decision-list simple">
                {decisions.map((decision) => <article key={decision.id}><strong>{decision.body}</strong><small>{getMember(decision.authorId).name} · {decision.createdAt}</small></article>)}
              </div>
            ) : <EmptyState icon={<Lightbulb size={23} />} title="Sin decisiones registradas" body="Las decisiones del equipo aparecerán aquí." />}
          </section>
          <section className="surface project-activity">
            <SectionHeader icon={<MessageCircle size={18} />} title="Actividad reciente" action={`${updates.length}`} />
            <div className="updates-list">
              {updates.slice(0, 5).map((update) => <UpdateRow key={update.id} update={update} projects={state.projects} />)}
              {!updates.length && <EmptyState icon={<MessageCircle size={23} />} title="Sin actividad" body="Las notas, decisiones y mensajes aparecerán aquí." />}
            </div>
          </section>
          <section className="surface project-links">
            <SectionHeader icon={<LinkIcon size={18} />} title="Accesos rápidos" action={`${resources.length}`} />
            <div className="resource-list">
              {resources.slice(0, 4).map((resource) => (
                <a key={resource.id} className="resource-row" href={resource.url} target={resource.url === '#' ? undefined : '_blank'} rel="noreferrer">
                  <span className={`resource-icon resource-${resource.type.toLowerCase()}`}><LinkIcon size={17} /></span>
                  <span><strong>{resource.title}</strong><small>{resource.type} · {resource.updatedAt}</small></span>
                  <ArrowRight size={16} />
                </a>
              ))}
              {!resources.length && <EmptyState icon={<LinkIcon size={23} />} title="Sin accesos guardados" body="Añade enlaces y entregables desde Capturar." />}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'tasks' && (
        <section className="surface project-single-surface">
          <SectionHeader icon={<CheckCircle2 size={18} />} title="Tareas del proyecto" action={<button type="button" onClick={onCapture}><Plus size={15} /> Añadir tarea</button>} />
          <div className="task-list roomy">
            {tasks.map((task) => <TaskRow key={task.id} task={task} projects={state.projects} onToggle={onToggleTask} />)}
            {!tasks.length && <EmptyState icon={<CheckCircle2 size={23} />} title="Sin tareas" body="Añade una tarea y asígnala a un miembro del equipo." />}
          </div>
        </section>
      )}

      {activeTab === 'conversation' && (
        <ConversationView projectId={project.id} updates={updates} activeMember={activeMember} onSubmit={onAddMessage} />
      )}

      {activeTab === 'board' && (
        <BoardView projectId={project.id} items={boardItems} onAdd={onAddBoardItem} onAdvance={onAdvanceBoardItem} />
      )}

      {activeTab === 'files' && (
        <section className="surface project-single-surface">
          <SectionHeader icon={<FileText size={18} />} title="Entregables y enlaces" action={<button type="button" onClick={onCapture}><Plus size={15} /> Añadir</button>} />
          <div className="resource-list roomy">
            {resources.map((resource) => (
              <a key={resource.id} className="resource-row" href={resource.url} target={resource.url === '#' ? undefined : '_blank'} rel="noreferrer">
                <span className={`resource-icon resource-${resource.type.toLowerCase()}`}>{resource.type === 'PDF' ? <FileText size={17} /> : <LinkIcon size={17} />}</span>
                <span><strong>{resource.title}</strong><small>{resource.type} · Actualizado {resource.updatedAt.toLowerCase()}</small></span>
                <ArrowRight size={16} />
              </a>
            ))}
            {!resources.length && <EmptyState icon={<FileText size={23} />} title="Sin entregables" body="Añade el primer enlace o documento desde Capturar." />}
          </div>
        </section>
      )}
    </div>
  )
}

function ConversationView({
  projectId,
  updates,
  activeMember,
  onSubmit,
}: {
  projectId: ProjectId
  updates: Update[]
  activeMember: Member
  onSubmit: (projectId: ProjectId, body: string) => void
}) {
  const [message, setMessage] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(projectId, message)
    setMessage('')
  }
  return (
    <section className="surface conversation-surface">
      <SectionHeader icon={<MessageCircle size={18} />} title="Conversación del proyecto" action={`${updates.filter((update) => update.kind === 'message').length} mensajes`} />
      <div className="conversation-list">
        {updates.map((update) => {
          const author = getMember(update.authorId)
          return (
            <article className={update.authorId === activeMember.id ? 'is-mine' : ''} key={update.id}>
              <Avatar member={author} />
              <span>
                <span className="conversation-meta"><strong>{author.name}</strong><small>{update.createdAt}</small>{update.kind !== 'message' && <b>{updateLabels[update.kind]}</b>}</span>
                <p>{update.body}</p>
              </span>
            </article>
          )
        })}
      </div>
      <form className="conversation-composer" onSubmit={submit}>
        <Avatar member={activeMember} />
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Escribir como ${activeMember.name}...`} aria-label="Nuevo mensaje" />
        <button type="submit" disabled={!message.trim()} aria-label="Enviar mensaje"><Send size={17} /></button>
      </form>
    </section>
  )
}

function BoardView({
  projectId,
  items,
  onAdd,
  onAdvance,
}: {
  projectId: ProjectId
  items: BoardItem[]
  onAdd: (projectId: ProjectId, title: string) => void
  onAdvance: (itemId: string) => void
}) {
  const [title, setTitle] = useState('')
  const lanes: Array<{ id: BoardLane; label: string; description: string }> = [
    { id: 'ideas', label: 'Ideas', description: 'Por explorar' },
    { id: 'decided', label: 'Decidido', description: 'Tiene sentido hacerlo' },
    { id: 'doing', label: 'En marcha', description: 'Ya está ocurriendo' },
  ]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onAdd(projectId, title)
    setTitle('')
  }
  return (
    <section className="board-view">
      <form className="board-capture" onSubmit={submit}>
        <Lightbulb size={18} />
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Añadir una idea a la pizarra..." aria-label="Nueva idea" />
        <button className="small-primary" type="submit" disabled={!title.trim()}>Añadir</button>
      </form>
      <div className="board-columns">
        {lanes.map((lane) => {
          const laneItems = items.filter((item) => item.lane === lane.id)
          return (
            <section className={`board-column lane-${lane.id}`} key={lane.id}>
              <header><span><strong>{lane.label}</strong><small>{lane.description}</small></span><b>{laneItems.length}</b></header>
              <div>
                {laneItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => onAdvance(item.id)} title="Mover a la siguiente columna">
                    <strong>{item.title}</strong>
                    <span><Avatar member={getMember(item.authorId)} /><ArrowRight size={15} /></span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function SearchResults({
  term,
  state,
  onOpenProject,
  onToggleTask,
}: {
  term: string
  state: HubState
  onOpenProject: (projectId: ProjectId) => void
  onToggleTask: (taskId: string) => void
}) {
  const matchingProjects = state.projects.filter((project) => `${project.name} ${project.client} ${project.focus} ${projectAreaLabels[project.area]} ${project.topics.join(' ')}`.toLocaleLowerCase('es').includes(term))
  const matchingTasks = state.tasks.filter((task) => task.title.toLocaleLowerCase('es').includes(term))
  const matchingUpdates = state.updates.filter((update) => update.body.toLocaleLowerCase('es').includes(term))
  const matchingResources = state.resources.filter((resource) => resource.title.toLocaleLowerCase('es').includes(term))
  const count = matchingProjects.length + matchingTasks.length + matchingUpdates.length + matchingResources.length

  return (
    <div className="page narrow-page search-page">
      <PageHeading eyebrow="Búsqueda global" title={`Resultados para “${term}”`} description={`${count} ${count === 1 ? 'coincidencia' : 'coincidencias'} en el Hub.`} />
      {count === 0 ? (
        <section className="surface"><EmptyState icon={<Search size={24} />} title="Nada por aquí" body="Prueba con otro nombre, tarea o decisión." /></section>
      ) : (
        <section className="surface search-results">
          {matchingProjects.map((project) => (
            <button key={project.id} type="button" onClick={() => onOpenProject(project.id)}><FolderKanban size={17} /><span><strong>{project.name}</strong><small>Proyecto · {project.client}</small></span><ChevronRight size={17} /></button>
          ))}
          {matchingTasks.map((task) => (
            <button key={task.id} type="button" onClick={() => onToggleTask(task.id)}><CheckCircle2 size={17} /><span><strong>{task.title}</strong><small>Tarea · {getProject(state.projects, task.projectId).name}</small></span><span className="search-status">{task.status === 'done' ? 'Hecha' : task.due}</span></button>
          ))}
          {matchingUpdates.map((update) => (
            <button key={update.id} type="button" onClick={() => onOpenProject(update.projectId)}><MessageCircle size={17} /><span><strong>{update.body}</strong><small>{updateLabels[update.kind]} · {getProject(state.projects, update.projectId).name}</small></span><ChevronRight size={17} /></button>
          ))}
          {matchingResources.map((resource) => (
            <button key={resource.id} type="button" onClick={() => onOpenProject(resource.projectId)}><LinkIcon size={17} /><span><strong>{resource.title}</strong><small>Recurso · {getProject(state.projects, resource.projectId).name}</small></span><ChevronRight size={17} /></button>
          ))}
        </section>
      )}
    </div>
  )
}

function ProjectDialog({
  project,
  onClose,
  onSubmit,
}: {
  project?: Project
  onClose: () => void
  onSubmit: (project: ProjectInput) => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [client, setClient] = useState(project?.client ?? '')
  const [area, setArea] = useState<ProjectArea>(project?.area ?? 'clients')
  const [status, setStatus] = useState(project?.status ?? 'Activo')
  const [focus, setFocus] = useState(project?.focus ?? '')
  const [nextMilestone, setNextMilestone] = useState(project?.nextMilestone ?? '')
  const [topics, setTopics] = useState(project?.topics.join(', ') ?? '')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      client: client.trim() || 'Proyecto interno',
      area,
      status,
      focus: focus.trim() || 'Pendiente de definir',
      nextMilestone: nextMilestone.trim() || 'Pendiente de definir',
      topics: [...new Set(topics.split(',').map((topic) => topic.trim()).filter(Boolean))],
    })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-dialog project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-dialog-title">
        <header>
          <span><span className="dialog-icon"><FolderKanban size={18} /></span><span><strong id="project-dialog-title">{project ? 'Editar proyecto' : 'Nuevo proyecto'}</strong><small>{project ? 'Actualiza la situación real del trabajo.' : 'Crea el espacio y sitúalo en su rama.'}</small></span></span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="project-area-options" role="group" aria-label="Rama del proyecto">
            {(Object.keys(projectAreaLabels) as ProjectArea[]).map((option) => (
              <button key={option} type="button" className={area === option ? 'is-active' : ''} onClick={() => setArea(option)}>{projectAreaLabels[option]}</button>
            ))}
          </div>
          <div className="project-dialog-grid">
            <label><span>Nombre</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del proyecto" data-testid="project-name" /></label>
            <label><span>Cliente o contexto</span><input value={client} onChange={(event) => setClient(event.target.value)} placeholder="Cliente, proyecto interno..." /></label>
          </div>
          <div className="project-dialog-grid status-grid">
            <label>
              <span>Estado</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {!projectStatusOptions.includes(status) && <option value={status}>{status}</option>}
                {projectStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label><span>Próximo hito</span><input value={nextMilestone} onChange={(event) => setNextMilestone(event.target.value)} placeholder="Siguiente entrega o revisión" /></label>
          </div>
          <label><span>Foco actual</span><textarea value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Qué necesita avanzar ahora" rows={2} /></label>
          <label><span>Temas <small>separados por comas</small></span><input value={topics} onChange={(event) => setTopics(event.target.value)} placeholder="Estrategia, diseño, web, entregas..." /></label>
          <footer>
            <button className="text-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action" type="submit" disabled={!name.trim()} data-testid="project-submit"><Check size={16} /> {project ? 'Guardar cambios' : 'Crear proyecto'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function CheckInDialog({
  member,
  checkIn,
  onClose,
  onSubmit,
}: {
  member: Member
  checkIn: TeamCheckIn
  onClose: () => void
  onSubmit: (availability: TeamAvailability, focus: string) => void
}) {
  const [availability, setAvailability] = useState<TeamAvailability>(checkIn.availability)
  const [focus, setFocus] = useState(checkIn.focus)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(availability, focus)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-dialog check-in-dialog" role="dialog" aria-modal="true" aria-labelledby="check-in-title">
        <header>
          <span><Avatar member={member} /><span><strong id="check-in-title">¿En qué estás hoy?</strong><small>Una frase para que el equipo se sitúe.</small></span></span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="availability-options" role="group" aria-label="Disponibilidad">
            {(Object.keys(availabilityLabels) as TeamAvailability[]).map((option) => (
              <button key={option} type="button" className={availability === option ? `is-active availability-${option}` : ''} onClick={() => setAvailability(option)}>
                <i /> {availabilityLabels[option]}
              </button>
            ))}
          </div>
          <label>
            <span>Foco o bloqueo principal</span>
            <textarea autoFocus value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Ej. Terminar la propuesta y enviarla antes de las 13:00" rows={3} data-testid="check-in-focus" />
          </label>
          <footer>
            <button className="text-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action" type="submit" disabled={!focus.trim()}><Check size={16} /> Actualizar</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function AgendaDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: Omit<AgendaEvent, 'id'>) => void }) {
  const [time, setTime] = useState('09:30')
  const [title, setTitle] = useState('')
  const [meta, setMeta] = useState('30 min · Equipo')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ time, title, meta })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-dialog agenda-dialog" role="dialog" aria-modal="true" aria-labelledby="agenda-dialog-title">
        <header>
          <span><span className="dialog-icon"><CalendarDays size={18} /></span><span><strong id="agenda-dialog-title">Añadir a la agenda</strong><small>Un bloque visible para todo el estudio.</small></span></span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="agenda-dialog-grid">
            <label><span>Hora</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            <label><span>Duración y asistentes</span><input value={meta} onChange={(event) => setMeta(event.target.value)} placeholder="30 min · Equipo" /></label>
          </div>
          <label><span>Qué va a ocurrir</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisión interna de campaña" data-testid="agenda-title" /></label>
          <footer>
            <button className="text-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action" type="submit" disabled={!title.trim() || !time}><Check size={16} /> Añadir</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function PinChangeDialog({
  member,
  onClose,
  onSubmit,
}: {
  member: Member
  onClose: () => void
  onSubmit: (currentPin: string, nextPin: string) => Promise<string | null>
}) {
  const [currentPin, setCurrentPin] = useState('')
  const [nextPin, setNextPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const updatePinValue = (value: string, setter: (next: string) => void) => {
    setter(value.replace(/\D/g, '').slice(0, pinLength))
    if (error) setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (nextPin !== confirmation) {
      setError('Los dos PIN nuevos no coinciden.')
      return
    }
    if (currentPin === nextPin) {
      setError('El nuevo PIN debe ser distinto del actual.')
      return
    }

    setBusy(true)
    const submitError = await onSubmit(currentPin, nextPin)
    if (submitError) {
      setBusy(false)
      setError(submitError)
      return
    }
    onClose()
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="pin-change-title">
        <header>
          <span><span className="dialog-icon"><KeyRound size={18} /></span><span><strong id="pin-change-title">Cambiar PIN</strong><small>Actualiza el acceso personal de {member.name}.</small></span></span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <form onSubmit={submit}>
          <label><span>PIN actual</span><input className="dialog-pin-input" type="password" inputMode="numeric" autoComplete="current-password" value={currentPin} onChange={(event) => updatePinValue(event.target.value, setCurrentPin)} autoFocus /></label>
          <div className="pin-change-grid">
            <label><span>PIN nuevo</span><input className="dialog-pin-input" type="password" inputMode="numeric" autoComplete="new-password" value={nextPin} onChange={(event) => updatePinValue(event.target.value, setNextPin)} /></label>
            <label><span>Repite el PIN</span><input className="dialog-pin-input" type="password" inputMode="numeric" autoComplete="new-password" value={confirmation} onChange={(event) => updatePinValue(event.target.value, setConfirmation)} /></label>
          </div>
          {error && <p className="access-error" role="alert">{error}</p>}
          <footer>
            <button className="text-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action" type="submit" disabled={busy || currentPin.length !== pinLength || nextPin.length !== pinLength || confirmation.length !== pinLength}>
              <Check size={16} /> {busy ? 'Guardando...' : 'Guardar PIN'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function CaptureDialog({
  selectedProjectId,
  projects,
  activeMemberId,
  onClose,
  onSubmit,
}: {
  selectedProjectId?: ProjectId
  projects: Project[]
  activeMemberId: MemberId
  onClose: () => void
  onSubmit: (payload: CapturePayload) => void
}) {
  const [type, setType] = useState<CaptureType>('task')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [destination, setDestination] = useState<'inbox' | ProjectId>(selectedProjectId ?? 'inbox')
  const [ownerId, setOwnerId] = useState<MemberId>(activeMemberId)
  const [due, setDue] = useState('Hoy')
  const [priority, setPriority] = useState<Task['priority']>('Media')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ type, title, detail, destination, ownerId, due, priority })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capture-dialog" role="dialog" aria-modal="true" aria-labelledby="capture-title">
        <header>
          <span><span className="dialog-icon"><Plus size={18} /></span><span><strong id="capture-title">Captura rápida</strong><small>Guárdalo ahora, ordénalo cuando toque.</small></span></span>
          <button className="icon-button compact" type="button" onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="capture-types" role="group" aria-label="Tipo de captura">
            {(Object.keys(captureLabels) as CaptureType[]).map((captureType) => (
              <button key={captureType} type="button" className={type === captureType ? 'is-active' : ''} onClick={() => setType(captureType)}>{captureLabels[captureType]}</button>
            ))}
          </div>
          <label>
            <span>{type === 'task' ? '¿Qué hay que hacer?' : type === 'decision' ? '¿Qué se ha decidido?' : 'Título'}</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Escribe algo concreto..." />
          </label>
          {(type === 'note' || type === 'decision') && (
            <label><span>Contexto <small>opcional</small></span><textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Añade el contexto necesario..." rows={3} /></label>
          )}
          {type === 'link' && (
            <label><span>URL</span><input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="https://" inputMode="url" /></label>
          )}
          <label>
            <span>Guardar en</span>
            <select value={destination} onChange={(event) => setDestination(event.target.value as 'inbox' | ProjectId)}>
              <option value="inbox">Inbox · ordenar después</option>
              {projects.filter((project) => project.status !== 'Archivado' || project.id === selectedProjectId).map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </label>
          {type === 'task' && destination !== 'inbox' && (
            <div className="capture-task-fields">
              <label>
                <span>Responsable</span>
                <select value={ownerId} onChange={(event) => setOwnerId(event.target.value as MemberId)}>
                  {members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
                </select>
              </label>
              <label>
                <span>Cuándo</span>
                <select value={due} onChange={(event) => setDue(event.target.value)}>
                  <option value="Hoy">Hoy</option>
                  <option value="Mañana">Mañana</option>
                  <option value="Esta semana">Esta semana</option>
                  <option value="Sin fecha">Sin fecha</option>
                </select>
              </label>
              <label>
                <span>Prioridad</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value as Task['priority'])}>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </label>
            </div>
          )}
          <footer>
            <button className="text-button" type="button" onClick={onClose}>Cancelar</button>
            <button className="primary-action" type="submit" disabled={!title.trim()}><Check size={16} /> Guardar</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function TaskRow({
  task,
  projects,
  onToggle,
  onOpenProject,
}: {
  task: Task
  projects: Project[]
  onToggle: (taskId: string) => void
  onOpenProject?: (projectId: ProjectId) => void
}) {
  const owner = getMember(task.ownerId)
  const project = getProject(projects, task.projectId)
  return (
    <article className={`task-row ${task.status === 'done' ? 'is-done' : ''} ${task.blocked ? 'is-blocked' : ''}`}>
      <button className="task-check" type="button" onClick={() => onToggle(task.id)} aria-label={task.status === 'done' ? `Reabrir ${task.title}` : `Completar ${task.title}`}>
        {task.status === 'done' ? <Check size={15} /> : <Circle size={16} />}
      </button>
      <span className="task-content">
        <strong>{task.title}</strong>
        <span>
          {onOpenProject ? <button type="button" onClick={() => onOpenProject(task.projectId)}>{project.name}</button> : <small>{owner.name}</small>}
          <small className={task.due.startsWith('Hoy') ? 'is-today' : ''}>{task.due}</small>
          {task.blocked && <small className="blocked-label">Bloqueada</small>}
        </span>
      </span>
      <Avatar member={owner} />
    </article>
  )
}

function UpdateRow({
  update,
  projects,
  onOpenProject,
}: {
  update: Update
  projects: Project[]
  onOpenProject?: (projectId: ProjectId) => void
}) {
  const member = getMember(update.authorId)
  const content = (
    <>
      <Avatar member={member} />
      <span>
        <span className="update-meta"><strong>{member.name}</strong><small>{update.createdAt}</small>{update.kind !== 'message' && <b className={`kind-${update.kind}`}>{updateLabels[update.kind]}</b>}</span>
        <p>{update.body}</p>
        {onOpenProject && <small>{getProject(projects, update.projectId).name}</small>}
      </span>
    </>
  )
  return onOpenProject ? <button className="update-row" type="button" onClick={() => onOpenProject(update.projectId)}>{content}</button> : <article className="update-row">{content}</article>
}

function PageHeading({
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

function SectionHeader({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <header className="section-header">
      <span>{icon}<strong>{title}</strong></span>
      {action && <span className="section-action">{action}</span>}
    </header>
  )
}

function SummaryMetric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className={`summary-metric tone-${tone}`}><strong>{value}</strong><span>{label}</span></div>
}

function Avatar({ member, size }: { member: Member; size?: 'large' }) {
  return <span className={`avatar ${size === 'large' ? 'avatar-large' : ''}`} style={{ background: member.color }} title={member.name}>{member.initials}</span>
}

function StatusBadge({ children }: { children: string }) {
  return <span className="status-badge" data-status={children}>{children}</span>
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="empty-state">{icon}<strong>{title}</strong><p>{body}</p></div>
}

export default App
