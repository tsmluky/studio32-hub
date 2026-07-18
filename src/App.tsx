import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
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
  LibraryBig,
  Lightbulb,
  Link as LinkIcon,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

type MemberId = 'juanma' | 'pancho' | 'gonzalo'
type ProjectId = 'studio32' | 'atlas' | 'archivo'
type MainView = 'today' | 'projects' | 'inbox' | 'library' | 'project'
type ProjectTab = 'overview' | 'tasks' | 'conversation' | 'board' | 'files'
type TaskStatus = 'todo' | 'doing' | 'done'
type CaptureType = 'task' | 'note' | 'decision' | 'link'
type UpdateKind = 'message' | 'note' | 'decision'
type BoardLane = 'ideas' | 'decided' | 'doing'

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
  status: string
  focus: string
  nextMilestone: string
  health: number
  accent: string
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

type HubState = {
  selectedProjectId: ProjectId
  tasks: Task[]
  updates: Update[]
  resources: Resource[]
  inbox: InboxItem[]
  boardItems: BoardItem[]
}

const members: Member[] = [
  { id: 'juanma', name: 'Juanma', initials: 'JM', role: 'Equipo Studio32', email: 'juanma@studio32.es', color: '#2f6f73' },
  { id: 'pancho', name: 'Pancho', initials: 'PA', role: 'Equipo Studio32', email: 'pancho@studio32.es', color: '#9a5a32' },
  { id: 'gonzalo', name: 'Gonzalo', initials: 'GZ', role: 'Equipo Studio32', email: 'gonzalo@studio32.es', color: '#486ca8' },
]

const projects: Project[] = [
  {
    id: 'studio32',
    name: 'Studio32 Hub',
    client: 'Proyecto interno',
    status: 'En definición',
    focus: 'Convertir el Hub en el primer lugar de trabajo del día.',
    nextMilestone: 'Probar el flujo diario con los 3 miembros',
    health: 78,
    accent: '#2f6f73',
  },
  {
    id: 'atlas',
    name: 'Cliente Atlas',
    client: 'Identidad y campaña',
    status: 'En producción',
    focus: 'Cerrar referencias, entregables y calendario de revisión.',
    nextMilestone: 'Enviar preview antes del viernes',
    health: 62,
    accent: '#486ca8',
  },
  {
    id: 'archivo',
    name: 'Archivo Vivo',
    client: 'Biblioteca del estudio',
    status: 'Siempre abierto',
    focus: 'Guardar procesos y referencias que merece la pena reutilizar.',
    nextMilestone: 'Migrar 10 recursos clave',
    health: 86,
    accent: '#9a5a32',
  },
]

const initialState: HubState = {
  selectedProjectId: 'studio32',
  tasks: [
    {
      id: 't-1',
      projectId: 'studio32',
      title: 'Definir las cinco cosas que siempre deben estar visibles',
      status: 'doing',
      ownerId: 'juanma',
      due: 'Hoy · 11:00',
      priority: 'Alta',
    },
    {
      id: 't-2',
      projectId: 'studio32',
      title: 'Preparar el acceso privado y los datos compartidos',
      status: 'todo',
      ownerId: 'gonzalo',
      due: 'Hoy · 16:00',
      priority: 'Alta',
    },
    {
      id: 't-3',
      projectId: 'studio32',
      title: 'Crear la plantilla de revisión semanal',
      status: 'todo',
      ownerId: 'pancho',
      due: 'Mañana',
      priority: 'Media',
    },
    {
      id: 't-4',
      projectId: 'atlas',
      title: 'Confirmar el orden de las piezas con el cliente',
      status: 'doing',
      ownerId: 'pancho',
      due: 'Hoy · 13:30',
      priority: 'Alta',
      blocked: true,
    },
    {
      id: 't-5',
      projectId: 'atlas',
      title: 'Preparar PDF de la segunda ronda',
      status: 'todo',
      ownerId: 'gonzalo',
      due: 'Viernes',
      priority: 'Media',
    },
    {
      id: 't-6',
      projectId: 'archivo',
      title: 'Seleccionar cinco referencias de presentaciones',
      status: 'todo',
      ownerId: 'juanma',
      due: 'Esta semana',
      priority: 'Baja',
    },
  ],
  updates: [
    {
      id: 'u-1',
      projectId: 'studio32',
      authorId: 'juanma',
      kind: 'decision',
      body: 'El Hub se organizará alrededor de Hoy, Proyectos, Inbox y Biblioteca.',
      createdAt: 'Hoy · 09:12',
    },
    {
      id: 'u-2',
      projectId: 'studio32',
      authorId: 'pancho',
      kind: 'message',
      body: 'La revisión semanal debería terminar con responsables y siguientes pasos claros.',
      createdAt: 'Hoy · 09:18',
    },
    {
      id: 'u-3',
      projectId: 'atlas',
      authorId: 'pancho',
      kind: 'message',
      body: 'El PDF está listo. Falta que el cliente confirme el orden de las piezas.',
      createdAt: 'Hoy · 10:04',
    },
    {
      id: 'u-4',
      projectId: 'archivo',
      authorId: 'gonzalo',
      kind: 'note',
      body: 'Añadidas las referencias de dirección de arte de la campaña Norte.',
      createdAt: 'Ayer · 18:20',
    },
  ],
  resources: [
    {
      id: 'r-1',
      projectId: 'studio32',
      title: 'Carpeta Drive · Studio32 interno',
      type: 'Drive',
      url: 'https://drive.google.com',
      updatedAt: 'Hoy',
    },
    {
      id: 'r-2',
      projectId: 'studio32',
      title: 'Procesos actuales del estudio',
      type: 'Notion',
      url: 'https://notion.so',
      updatedAt: 'Ayer',
    },
    {
      id: 'r-3',
      projectId: 'atlas',
      title: 'Atlas · Presentación R02.pdf',
      type: 'PDF',
      url: '#',
      updatedAt: 'Hoy',
    },
    {
      id: 'r-4',
      projectId: 'archivo',
      title: 'Referencias de presentaciones',
      type: 'Drive',
      url: 'https://drive.google.com',
      updatedAt: 'Lunes',
    },
  ],
  inbox: [
    {
      id: 'i-1',
      type: 'link',
      title: 'Referencia de navegación para proyectos',
      detail: 'https://basecamp.com',
      authorId: 'gonzalo',
      createdAt: 'Hace 25 min',
    },
    {
      id: 'i-2',
      type: 'note',
      title: 'Revisar cómo nombramos las entregas finales',
      authorId: 'pancho',
      createdAt: 'Ayer',
    },
  ],
  boardItems: [
    { id: 'b-1', projectId: 'studio32', title: 'Vista diaria realmente útil', lane: 'doing', authorId: 'juanma' },
    { id: 'b-2', projectId: 'studio32', title: 'Acceso por correo sin contraseña', lane: 'decided', authorId: 'gonzalo' },
    { id: 'b-3', projectId: 'studio32', title: 'Resumen automático de la semana', lane: 'ideas', authorId: 'pancho' },
    { id: 'b-4', projectId: 'atlas', title: 'Versión vertical de la campaña', lane: 'ideas', authorId: 'juanma' },
  ],
}

const agenda = [
  { time: '10:00', title: 'Puesta al día Studio32', meta: '30 min · Equipo' },
  { time: '12:30', title: 'Revisión interna Atlas', meta: '45 min · Pancho y Gonzalo' },
  { time: '17:00', title: 'Bloque de trabajo profundo', meta: '60 min · Sin reuniones' },
]

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

function usePersistentHubState() {
  const [state, setState] = useState<HubState>(() => {
    const stored = localStorage.getItem('studio32-hub-v3')
    if (!stored) return initialState

    try {
      return { ...initialState, ...JSON.parse(stored) } as HubState
    } catch {
      return initialState
    }
  })

  const updateState = (updater: (current: HubState) => HubState) => {
    setState((current) => {
      const next = updater(current)
      localStorage.setItem('studio32-hub-v3', JSON.stringify(next))
      return next
    })
  }

  return [state, updateState] as const
}

function getMember(id: MemberId) {
  return members.find((member) => member.id === id) ?? members[0]
}

function getProject(id: ProjectId) {
  return projects.find((project) => project.id === id) ?? projects[0]
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const demoPinLength = 6

function demoPinStorageKey(memberId: MemberId) {
  return `studio32-demo-pin-v1:${memberId}`
}

async function hashDemoPin(memberId: MemberId, pin: string) {
  const input = new TextEncoder().encode(`studio32-local:${memberId}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function App() {
  const [state, updateState] = usePersistentHubState()
  const [activeMemberId, setActiveMemberId] = useState<MemberId | null>(() => {
    const stored = localStorage.getItem('studio32-current-member-v3')
    return members.some((member) => member.id === stored) ? (stored as MemberId) : null
  })
  const [view, setView] = useState<MainView>('today')
  const [projectTab, setProjectTab] = useState<ProjectTab>('overview')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [search, setSearch] = useState('')

  const activeMember = activeMemberId ? getMember(activeMemberId) : null
  const selectedProject = getProject(state.selectedProjectId)

  const openProject = (projectId: ProjectId) => {
    updateState((current) => ({ ...current, selectedProjectId: projectId }))
    setProjectTab('overview')
    setSearch('')
    setView('project')
  }

  const selectView = (nextView: Exclude<MainView, 'project'>) => {
    setSearch('')
    setView(nextView)
  }

  const signIn = (memberId: MemberId) => {
    localStorage.setItem('studio32-current-member-v3', memberId)
    setActiveMemberId(memberId)
  }

  const signOut = () => {
    localStorage.removeItem('studio32-current-member-v3')
    setActiveMemberId(null)
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

  const addCapture = (payload: {
    type: CaptureType
    title: string
    detail?: string
    destination: 'inbox' | ProjectId
  }) => {
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
              ownerId: activeMemberId,
              due: 'Sin fecha',
              priority: 'Media',
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

  if (!activeMember) {
    return <AccessScreen onSelect={signIn} />
  }

  const searchTerm = search.trim().toLocaleLowerCase('es')

  return (
    <div className="hub-shell">
      <Sidebar
        activeView={view}
        activeMember={activeMember}
        inboxCount={state.inbox.length}
        selectedProjectId={state.selectedProjectId}
        onNavigate={selectView}
        onOpenProject={openProject}
        onCapture={() => setCaptureOpen(true)}
        onSignOut={signOut}
      />

      <section className="workspace">
        <header className="workspace-topbar">
          <label className="global-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar proyectos, tareas, decisiones..."
              aria-label="Buscar en Studio32"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
                <X size={15} />
              </button>
            )}
          </label>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Notificaciones">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="primary-action" type="button" onClick={() => setCaptureOpen(true)} data-testid="quick-capture" aria-label="Capturar">
              <Plus size={17} />
              <span>Capturar</span>
            </button>
          </div>
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
            />
          ) : view === 'projects' ? (
            <ProjectsView state={state} onOpenProject={openProject} />
          ) : view === 'inbox' ? (
            <InboxView
              items={state.inbox}
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
            />
          )}
        </main>
      </section>

      {captureOpen && (
        <CaptureDialog
          selectedProjectId={view === 'project' ? state.selectedProjectId : undefined}
          onClose={() => setCaptureOpen(false)}
          onSubmit={addCapture}
        />
      )}
    </div>
  )
}

function AccessScreen({ onSelect }: { onSelect: (memberId: MemberId) => void }) {
  const [selectedMemberId, setSelectedMemberId] = useState<MemberId | null>(null)
  const [mode, setMode] = useState<'setup' | 'unlock'>('unlock')
  const [pin, setPin] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selectedMember = selectedMemberId ? getMember(selectedMemberId) : null

  const selectMember = (memberId: MemberId) => {
    setSelectedMemberId(memberId)
    setMode(localStorage.getItem(demoPinStorageKey(memberId)) ? 'unlock' : 'setup')
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
    setter(value.replace(/\D/g, '').slice(0, demoPinLength))
    if (error) setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedMember) return

    if (pin.length !== demoPinLength) {
      setError(`El PIN debe tener ${demoPinLength} dígitos.`)
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
      onSelect(selectedMember.id)
      return
    }

    const storedHash = localStorage.getItem(demoPinStorageKey(selectedMember.id))
    if (storedHash !== pinHash) {
      setBusy(false)
      setPin('')
      setError('El PIN no es correcto.')
      return
    }

    onSelect(selectedMember.id)
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
              <span className="eyebrow">Acceso de equipo</span>
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
              <p>{mode === 'setup' ? 'Elige un PIN de 6 dígitos para este prototipo.' : 'Introduce tu PIN de 6 dígitos.'}</p>
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
                disabled={busy || pin.length !== demoPinLength || (mode === 'setup' && confirmation.length !== demoPinLength)}
                data-testid="access-submit"
              >
                {busy ? 'Comprobando...' : mode === 'setup' ? 'Guardar y entrar' : 'Entrar al Hub'}
                {!busy && <ArrowRight size={17} />}
              </button>
              {mode === 'unlock' && import.meta.env.DEV && (
                <button className="local-pin-reset" type="button" onClick={resetLocalPin} data-testid="reset-local-pin">
                  Restablecer PIN local
                </button>
              )}
            </form>
          </>
        )}
        <div className="access-foot">
          <span><Check size={14} /> Acceso privado de Studio32</span>
          <span>Prototipo local</span>
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
  onNavigate,
  onOpenProject,
  onCapture,
  onSignOut,
}: {
  activeView: MainView
  activeMember: Member
  inboxCount: number
  selectedProjectId: ProjectId
  onNavigate: (view: Exclude<MainView, 'project'>) => void
  onOpenProject: (projectId: ProjectId) => void
  onCapture: () => void
  onSignOut: () => void
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
        {projects.map((project) => (
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
        <span>Equipo conectado</span>
        <div className="avatar-stack" aria-label="Tres miembros conectados">
          {members.map((member) => <Avatar key={member.id} member={member} />)}
        </div>
      </div>

      <div className="sidebar-account">
        <Avatar member={activeMember} />
        <span>
          <strong>{activeMember.name}</strong>
          <small>Vista personal</small>
        </span>
        <button type="button" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión">
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
}: {
  member: Member
  state: HubState
  onToggleTask: (taskId: string) => void
  onOpenProject: (projectId: ProjectId) => void
  onOpenInbox: () => void
}) {
  const myTasks = state.tasks.filter((task) => task.ownerId === member.id && task.status !== 'done')
  const todayTasks = myTasks.filter((task) => task.due.startsWith('Hoy'))
  const attentionTasks = state.tasks.filter((task) => task.blocked)
  const openTasks = state.tasks.filter((task) => task.status !== 'done')

  return (
    <div className="page today-page">
      <PageHeading
        eyebrow="Jueves, 16 de julio"
        title={`Buenos días, ${member.name}`}
        description="Esto es lo que necesita atención hoy en Studio32."
      />

      <section className="daily-summary" aria-label="Resumen del día">
        <SummaryMetric value={todayTasks.length} label="tareas para hoy" tone="green" />
        <SummaryMetric value={agenda.length} label="bloques en agenda" tone="blue" />
        <SummaryMetric value={attentionTasks.length} label="bloqueo pendiente" tone="amber" />
        <div className="summary-focus">
          <Sparkles size={17} />
          <span>
            <small>Foco del estudio</small>
            <strong>Probar el nuevo flujo diario</strong>
          </span>
        </div>
      </section>

      <div className="today-grid">
        <section className="surface focus-surface">
          <SectionHeader icon={<CheckCircle2 size={18} />} title="Tu foco" action={`${myTasks.length} abiertas`} />
          <div className="task-list">
            {myTasks.slice(0, 5).map((task) => (
              <TaskRow key={task.id} task={task} onToggle={onToggleTask} onOpenProject={onOpenProject} />
            ))}
          </div>
        </section>

        <section className="surface agenda-surface">
          <SectionHeader icon={<CalendarDays size={18} />} title="Agenda" action="Hoy" />
          <div className="agenda-list">
            {agenda.map((event) => (
              <div className="agenda-row" key={event.time}>
                <time>{event.time}</time>
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.meta}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface attention-surface">
          <SectionHeader icon={<AlertCircle size={18} />} title="Necesita atención" action={`${attentionTasks.length + state.inbox.length}`} />
          {attentionTasks.map((task) => (
            <button className="attention-row" key={task.id} type="button" onClick={() => onOpenProject(task.projectId)}>
              <span className="attention-icon"><AlertCircle size={17} /></span>
              <span>
                <strong>{task.title}</strong>
                <small>{getProject(task.projectId).name} · Esperando respuesta</small>
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
              <UpdateRow key={update.id} update={update} onOpenProject={onOpenProject} />
            ))}
          </div>
        </section>
      </div>

      <section className="projects-overview">
        <SectionHeader icon={<FolderKanban size={18} />} title="Pulso de proyectos" action={`${openTasks.length} tareas abiertas`} />
        <div className="project-pulse-grid">
          {projects.map((project) => {
            const projectTasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== 'done')
            return (
              <button className="project-pulse" key={project.id} type="button" onClick={() => onOpenProject(project.id)}>
                <span className="project-line" style={{ background: project.accent }} />
                <span className="project-pulse-head">
                  <span>
                    <small>{project.client}</small>
                    <strong>{project.name}</strong>
                  </span>
                  <span className="health-value">{project.health}%</span>
                </span>
                <span className="progress-track"><i style={{ width: `${project.health}%`, background: project.accent }} /></span>
                <span className="project-pulse-foot">
                  <span>{project.status}</span>
                  <span>{projectTasks.length} abiertas</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function ProjectsView({ state, onOpenProject }: { state: HubState; onOpenProject: (projectId: ProjectId) => void }) {
  return (
    <div className="page">
      <PageHeading
        eyebrow="Trabajo activo"
        title="Proyectos"
        description="Estado, próximo hito y carga del estudio en una sola vista."
        meta={<span className="team-capacity"><Users size={16} /> Capacidad esta semana: 72%</span>}
      />
      <section className="project-table surface">
        <div className="project-table-head">
          <span>Proyecto</span>
          <span>Estado</span>
          <span>Próximo hito</span>
          <span>Progreso</span>
          <span />
        </div>
        {projects.map((project) => {
          const projectTasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== 'done')
          const owners = [...new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.ownerId))]
          return (
            <button className="project-table-row" key={project.id} type="button" onClick={() => onOpenProject(project.id)}>
              <span className="project-name-cell">
                <i style={{ background: project.accent }} />
                <span><strong>{project.name}</strong><small>{project.client}</small></span>
              </span>
              <span><StatusBadge>{project.status}</StatusBadge></span>
              <span className="milestone-cell"><strong>{project.nextMilestone}</strong><small>{projectTasks.length} tareas abiertas</small></span>
              <span className="project-progress-cell">
                <span><i style={{ width: `${project.health}%`, background: project.accent }} /></span>
                <small>{project.health}%</small>
              </span>
              <span className="project-owner-cell">
                <span className="avatar-stack small">
                  {owners.map((ownerId) => <Avatar key={ownerId} member={getMember(ownerId)} />)}
                </span>
                <ChevronRight size={18} />
              </span>
            </button>
          )
        })}
      </section>
    </div>
  )
}

function InboxView({
  items,
  onMove,
  onDismiss,
  onCapture,
}: {
  items: InboxItem[]
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
            {items.map((item) => <InboxRow key={item.id} item={item} onMove={onMove} onDismiss={onDismiss} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function InboxRow({
  item,
  onMove,
  onDismiss,
}: {
  item: InboxItem
  onMove: (itemId: string, projectId: ProjectId) => void
  onDismiss: (itemId: string) => void
}) {
  const [destination, setDestination] = useState<ProjectId>('studio32')
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
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
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
                <span><strong>{resource.title}</strong><small>{getProject(resource.projectId).name} · {resource.updatedAt}</small></span>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </section>
        <section className="surface">
          <SectionHeader icon={<Lightbulb size={18} />} title="Decisiones y notas" action={`${decisions.length}`} />
          <div className="decision-list">
            {decisions.map((update) => (
              <button key={update.id} type="button" onClick={() => onOpenProject(update.projectId)}>
                <span className={`update-kind kind-${update.kind}`}>{updateLabels[update.kind]}</span>
                <strong>{update.body}</strong>
                <small>{getProject(update.projectId).name} · {update.createdAt}</small>
              </button>
            ))}
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
}) {
  const tasks = state.tasks.filter((task) => task.projectId === project.id)
  const updates = state.updates.filter((update) => update.projectId === project.id)
  const resources = state.resources.filter((resource) => resource.projectId === project.id)
  const boardItems = state.boardItems.filter((item) => item.projectId === project.id)
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const decisions = updates.filter((update) => update.kind === 'decision')

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
          <span className="eyebrow">{project.client}</span>
          <h1>{project.name}</h1>
          <p>{project.focus}</p>
        </div>
        <div className="project-header-stats">
          <span><small>Estado</small><strong>{project.status}</strong></span>
          <span><small>Salud</small><strong>{project.health}%</strong></span>
          <span><small>Abiertas</small><strong>{openTasks.length}</strong></span>
        </div>
      </section>

      <div className="project-context-bar">
        <span><Clock3 size={16} /><small>Próximo hito</small><strong>{project.nextMilestone}</strong></span>
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
            <SectionHeader icon={<CheckCircle2 size={18} />} title="Siguiente trabajo" action={`${openTasks.length} abiertas`} />
            <div className="task-list">
              {openTasks.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} onToggle={onToggleTask} />)}
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
              {updates.slice(0, 5).map((update) => <UpdateRow key={update.id} update={update} />)}
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
            </div>
          </section>
        </div>
      )}

      {activeTab === 'tasks' && (
        <section className="surface project-single-surface">
          <SectionHeader icon={<CheckCircle2 size={18} />} title="Tareas del proyecto" action={<button type="button" onClick={onCapture}><Plus size={15} /> Añadir tarea</button>} />
          <div className="task-list roomy">
            {tasks.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggleTask} />)}
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
  const matchingProjects = projects.filter((project) => `${project.name} ${project.client} ${project.focus}`.toLocaleLowerCase('es').includes(term))
  const matchingTasks = state.tasks.filter((task) => task.title.toLocaleLowerCase('es').includes(term))
  const matchingUpdates = state.updates.filter((update) => update.body.toLocaleLowerCase('es').includes(term))
  const matchingResources = state.resources.filter((resource) => resource.title.toLocaleLowerCase('es').includes(term))
  const count = matchingProjects.length + matchingTasks.length + matchingUpdates.length + matchingResources.length

  return (
    <div className="page narrow-page search-page">
      <PageHeading eyebrow="Búsqueda global" title={`Resultados para “${term}”`} description={`${count} coincidencias en el Hub.`} />
      {count === 0 ? (
        <section className="surface"><EmptyState icon={<Search size={24} />} title="Nada por aquí" body="Prueba con otro nombre, tarea o decisión." /></section>
      ) : (
        <section className="surface search-results">
          {matchingProjects.map((project) => (
            <button key={project.id} type="button" onClick={() => onOpenProject(project.id)}><FolderKanban size={17} /><span><strong>{project.name}</strong><small>Proyecto · {project.client}</small></span><ChevronRight size={17} /></button>
          ))}
          {matchingTasks.map((task) => (
            <button key={task.id} type="button" onClick={() => onToggleTask(task.id)}><CheckCircle2 size={17} /><span><strong>{task.title}</strong><small>Tarea · {getProject(task.projectId).name}</small></span><span className="search-status">{task.status === 'done' ? 'Hecha' : task.due}</span></button>
          ))}
          {matchingUpdates.map((update) => (
            <button key={update.id} type="button" onClick={() => onOpenProject(update.projectId)}><MessageCircle size={17} /><span><strong>{update.body}</strong><small>{updateLabels[update.kind]} · {getProject(update.projectId).name}</small></span><ChevronRight size={17} /></button>
          ))}
          {matchingResources.map((resource) => (
            <button key={resource.id} type="button" onClick={() => onOpenProject(resource.projectId)}><LinkIcon size={17} /><span><strong>{resource.title}</strong><small>Recurso · {getProject(resource.projectId).name}</small></span><ChevronRight size={17} /></button>
          ))}
        </section>
      )}
    </div>
  )
}

function CaptureDialog({
  selectedProjectId,
  onClose,
  onSubmit,
}: {
  selectedProjectId?: ProjectId
  onClose: () => void
  onSubmit: (payload: { type: CaptureType; title: string; detail?: string; destination: 'inbox' | ProjectId }) => void
}) {
  const [type, setType] = useState<CaptureType>('task')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [destination, setDestination] = useState<'inbox' | ProjectId>(selectedProjectId ?? 'inbox')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({ type, title, detail, destination })
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
              {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </label>
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
  onToggle,
  onOpenProject,
}: {
  task: Task
  onToggle: (taskId: string) => void
  onOpenProject?: (projectId: ProjectId) => void
}) {
  const owner = getMember(task.ownerId)
  const project = getProject(task.projectId)
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

function UpdateRow({ update, onOpenProject }: { update: Update; onOpenProject?: (projectId: ProjectId) => void }) {
  const member = getMember(update.authorId)
  const content = (
    <>
      <Avatar member={member} />
      <span>
        <span className="update-meta"><strong>{member.name}</strong><small>{update.createdAt}</small>{update.kind !== 'message' && <b className={`kind-${update.kind}`}>{updateLabels[update.kind]}</b>}</span>
        <p>{update.body}</p>
        {onOpenProject && <small>{getProject(update.projectId).name}</small>}
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

function StatusBadge({ children }: { children: ReactNode }) {
  return <span className="status-badge">{children}</span>
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="empty-state">{icon}<strong>{title}</strong><p>{body}</p></div>
}

export default App
