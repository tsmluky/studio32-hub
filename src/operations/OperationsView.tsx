import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import OperationsTools from "./OperationsTools";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowLeft,
  AudioLines,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  ExternalLink,
  FileText,
  Home,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Mic,
  Monitor,
  Plus,
  RefreshCw,
  Search,
  Square,
  Store,
  Wrench,
  X,
  Activity,
  NotebookPen,
  Paperclip,
  LogOut,
} from "lucide-react";
import { request, date, configureTransport } from "./api";
import ReportJourney from "./ReportJourney";
import type { Business, Proposal, Snapshot } from "./api";
import SecurityNotice from "./SecurityNotice";
import "./operations.css";

type Tab = "home" | "businesses" | "assistant" | "activity" | "tools";
const navigation = [
  { id: "home", label: "Mi mesa", icon: Home },
  { id: "businesses", label: "Negocios", icon: Store },
  { id: "assistant", label: "Asistente", icon: AudioLines },
  { id: "activity", label: "Actividad", icon: Activity },
] as const;
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function OperationsView({
  onOpenLegacy,
  localPreview = false,
  displayName = "Francisco",
  onSignOut,
  outreachContent,
  onOutreachActiveChange,
}: {
  onOpenLegacy?: () => void;
  localPreview?: boolean;
  displayName?: string;
  onSignOut?: () => void | Promise<void>;
  outreachContent?: ReactNode;
  onOutreachActiveChange?: (active: boolean) => void;
}) {
  configureTransport(localPreview);
  const [tab, setTab] = useState<Tab>("home"),
    [focusJob, setFocusJob] = useState(""),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [connectionError, setConnectionError] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(""),
    [sending, setSending] = useState(false),
    [help, setHelp] = useState(false);
  const [recording, setRecording] = useState(false),
    [transcribing, setTranscribing] = useState(false),
    [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null),
    recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    stream = useRef<MediaStream | null>(null);
  const end = useRef<HTMLDivElement>(null),
    detail = useRef<HTMLElement>(null),
    dialog = useRef<HTMLElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    audioFile = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    mounted = useRef(true),
    threadRef = useRef(selected);
  threadRef.current = selected;
  const business = snapshot?.businesses.find((b) => b.id === selected);
  const refresh = useCallback(async () => {
    const version = generation.current;
    if (selected !== threadRef.current) return;
    try {
      const state = await request<Snapshot>(
        `/state?thread=${encodeURIComponent(selected || "general")}`,
        undefined,
        AbortSignal.timeout(6000),
      );
      if (
        mounted.current &&
        version === generation.current &&
        selected === threadRef.current
      ) {
        setSnapshot(state);
        setConnectionError("");
      }
    } catch (e) {
      if (mounted.current && version === generation.current)
        setConnectionError((e as Error).message);
    } finally {
      if (mounted.current && version === generation.current) setLoading(false);
    }
  }, [selected]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    generation.current++;
    setSnapshot((s) => (s ? { ...s, messages: [], proposals: [] } : s));
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (!document.hidden) void refresh();
      },
      tab === "assistant" || snapshot?.service.busy ? 4000 : 20000,
    );
    return () => clearInterval(interval);
  }, [refresh, tab, snapshot?.service.busy]);
  useEffect(() => {
    if (tab === "assistant" && snapshot?.messages.length) {
      const messages = end.current?.parentElement;
      messages?.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
    }
  }, [snapshot?.messages.length, tab]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  useEffect(() => {
    if (
      tab === "businesses" &&
      selected &&
      !focusJob &&
      window.matchMedia("(max-width:720px)").matches
    )
      detail.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [tab, selected, focusJob]);
  useEffect(
    () => () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  useEffect(() => {
    if (!help) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setHelp(false);
      }
      if (e.key !== "Tab") return;
      const controls = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input,textarea,select",
        ) || [],
      );
      if (!controls.length) return;
      const first = controls[0],
        last = controls.at(-1)!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previousFocus?.focus();
    };
  }, [help]);
  const connected = !!snapshot && !connectionError;
  const desktopOnline =
    connected && (localPreview || snapshot?.service.connected);
  const pending =
    snapshot?.jobs.filter((j) => ["queued", "running"].includes(j.status)) ||
    [];
  const visits = snapshot?.visits.filter((v) => v.status !== "done") || [];
  const filtered =
    snapshot?.businesses.filter((b) =>
      fold(`${b.name} ${b.area}`).includes(fold(query)),
    ) || [];
  const reports = (
    snapshot?.businesses.flatMap((b) =>
      b.reports.map((r) => ({ ...r, business: b })),
    ) || []
  ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  async function act(route: string, payload: unknown) {
    setError("");
    try {
      await request(route, {
        ...(payload as Record<string, unknown>),
        thread: selected || "general",
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  async function send(text = draft) {
    if (
      !text.trim() ||
      sending ||
      !connected ||
      !snapshot?.service.modelReady ||
      recording ||
      transcribing
    )
      return;
    setSending(true);
    setError("");
    setTab("assistant");
    try {
      await request("/messages", {
        text,
        businessId: selected || null,
        requestId: crypto.randomUUID(),
      });
      setDraft("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  function openBusiness(b: Business) {
    setFocusJob("");
    setSelected(b.id);
    setTab("businesses");
    setError("");
  }
  async function propose(kind: string) {
    setTab("assistant");
    try {
      await act("/proposals", { businessId: selected, kind });
    } catch {
      /* Visible alert above composer. */
    }
  }
  async function transcribeAudio(audio: Blob, thread: string) {
    setError("");
    if (!audio.size || audio.size > 8 * 1024 * 1024) {
      setError("Elige un audio de hasta 60 segundos y menos de 8 MB.");
      return;
    }
    setTranscribing(true);
    try {
      const result = await request<{ text: string }>(
        "/transcribe",
        audio,
        AbortSignal.timeout(125000),
      );
      if (!mounted.current) return;
      if (!result.text.trim())
        setError(
          "No se ha detectado voz. Prueba de nuevo más cerca del micrófono.",
        );
      else if (thread !== threadRef.current)
        setError(
          `Has cambiado de negocio. Este es el texto del audio anterior: ${result.text}`,
        );
      else {
        setDraft((d) => [d, result.text].filter(Boolean).join(" "));
        input.current?.focus();
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setTranscribing(false);
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError("");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Este navegador no permite grabar aquí. Abre el Hub en un navegador con micrófono disponible.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const media = new MediaRecorder(
          stream.current,
          mime ? { mimeType: mime } : undefined,
        ),
        chunks: Blob[] = [];
      recorder.current = media;
      media.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      media.onstop = async () => {
        if (recordingTimer.current) clearInterval(recordingTimer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        await transcribeAudio(
          new Blob(chunks, { type: media.mimeType }),
          selected,
        );
      };
      media.start();
      setSeconds(0);
      setRecording(true);
      let elapsed = 0;
      recordingTimer.current = setInterval(() => {
        elapsed++;
        setSeconds(elapsed);
        if (elapsed >= 60 && media.state === "recording") media.stop();
      }, 1000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError((e as Error).message);
    }
  }
  const nameFor = (id: string) =>
    snapshot?.businesses.find((b) => b.id === id)?.name || id;
  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <a
          className="ops-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("home");
          }}
        >
          <span className="ops-mark">
            32<span>®</span>
          </span>
          <span>
            Studio32<small>Tu centro de operaciones</small>
          </span>
        </a>
        <div className="ops-workspace">
          <span className="ops-workspace-icon">
            <Command size={17} />
          </span>
          <div>
            Mi estudio<small>Espacio personal</small>
          </div>
          <span className="ops-dot" />
        </div>
        <span className="ops-nav-label">ESPACIO DE TRABAJO</span>
        <nav aria-label="Centro de operaciones">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => {
                setFocusJob("");
                setTab(n.id);
                setError("");
              }}
              aria-current={tab === n.id ? "page" : undefined}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "activity" && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="ops-nav-divider" />
        <span className="ops-nav-label">TUS RECURSOS</span>
        <button className="ops-side-link" onClick={() => setTab("tools")}>
          <Wrench size={19} />
          Herramientas
          <ExternalLink size={13} />
        </button>
        <button
          className="ops-side-link"
          onClick={() => {
            setTab("businesses");
            setSelected("");
            setQuery("");
          }}
        >
          <FileText size={19} />
          Informes guardados
        </button>
        <div className="ops-side-bottom">
          <div className="ops-machine">
            <Monitor size={19} />
            <span>
              Sobremesa
              <small>
                {desktopOnline
                  ? snapshot?.service.modelReady
                    ? "Conectado · IA disponible"
                    : "Conectado · informes"
                  : loading
                    ? "Conectando…"
                    : "Sin conexión"}
              </small>
            </span>
            <i className={desktopOnline ? "online" : ""} />
          </div>
          <button className="ops-profile" onClick={() => setHelp(true)}>
            <span>FI</span>
            <div>
              {displayName}
              <small>Studio32 · Mi espacio</small>
            </div>
            <CircleHelp size={17} />
          </button>
        </div>
      </aside>
      <div className="ops-workspace-main">
        <header className="ops-topbar">
          <div className="ops-breadcrumb">
            Studio32 <span>/</span>{" "}
            <strong>
              {tab === "tools"
                ? "Herramientas"
                : navigation.find((n) => n.id === tab)?.label}
            </strong>
          </div>
          <div className="ops-top-right">
            <span className="ops-local">
              <span className={desktopOnline ? "ops-dot" : "ops-dot offline"} />
              {localPreview
                ? "En tu sobremesa"
                : desktopOnline
                  ? "Sobremesa conectado"
                  : loading
                    ? "Comprobando conexión…"
                    : "PC sin conexión"}
            </span>
            <button
              className="ops-icon-button"
              aria-label="Actualizar datos del motor"
              disabled={!connected}
              onClick={() => void act("/reload", {}).catch(() => {})}
            >
              <RefreshCw size={17} />
            </button>
            <span className="ops-avatar">FI</span>
          </div>
        </header>
        <main className={`ops-main ops-${tab}`}>
          {tab === "tools" && (
            <OperationsTools
              outreach={outreachContent}
              onActiveChange={onOutreachActiveChange}
              onReports={() => setTab("businesses")}
              onArchive={onOpenLegacy}
            />
          )}
          {connectionError && (
            <div className="ops-connection" role="status">
              <Monitor size={22} />
              <div>
                <strong>Tu sobremesa está desconectado</strong>
                <p>
                  {snapshot
                    ? "Los datos que ves son la última lectura. Conecta el servicio para consultar o guardar cambios."
                    : "Las fichas, los PDF y tu asistente aparecerán al conectar el servicio local."}
                </p>
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  void refresh();
                }}
              >
                Reconectar
              </button>
            </div>
          )}
          {loading && !snapshot && (
            <div className="ops-loading">
              <LoaderCircle className="ops-spin" size={22} /> Abriendo tu
              espacio…
            </div>
          )}
          {error && (
            <div className="ops-error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          )}
          {snapshot?.warnings.map((w) => (
            <p className="ops-data-warning" key={w}>
              {w}
            </p>
          ))}
          {tab === "home" &&
            snapshot?.businesses
              .filter((b) => b.security)
              .map((b) => (
                <button
                  className="ops-priority"
                  key={b.id}
                  onClick={() => openBusiness(b)}
                >
                  <span className="ops-priority-symbol">!</span>
                  <span>
                    <strong>Para revisar · {b.name}</strong>
                    <small>
                      La revisión del {date(b.security!.measuredAt)} encontró
                      enlaces ocultos en {b.security!.affectedPages} páginas.
                      Tienes el informe de seguridad preparado.
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
          {tab === "home" && (
            <>
              <div className="ops-page-title">
                <div>
                  <span className="ops-eyebrow">TU ESTUDIO, EN ORDEN</span>
                  <h1>Vamos a hacer que pase.</h1>
                  <p>
                    Negocios, conversaciones y próximos pasos. Todo parte de
                    aquí.
                  </p>
                </div>
                <span className="ops-today">
                  {new Intl.DateTimeFormat("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    timeZone: "Europe/Madrid",
                  }).format(new Date())}
                </span>
              </div>
              {localPreview && (
                <button
                  className="ops-journey-entry"
                  onClick={() => {
                    setTab("businesses");
                    setSelected("");
                  }}
                >
                  <span className="ops-document-icon">
                    <Search size={23} />
                  </span>
                  <span>
                    <strong>Prepara tu próxima visita</strong>
                    <small>
                      Busca un restaurante nuevo y llévate su diagnóstico en
                      PDF.
                    </small>
                  </span>
                  <ArrowRight size={20} />
                </button>
              )}
              <div className="ops-home-top">
                <section className="ops-hero">
                  <div className="ops-hero-top">
                    <span className="ops-hero-label">
                      {localPreview ? (
                        <AudioLines size={16} />
                      ) : (
                        <FileText size={16} />
                      )}{" "}
                      {localPreview ? "TU ASISTENTE" : "TU PRÓXIMA VISITA"}
                    </span>
                    <span className="ops-hero-star">✳</span>
                  </div>
                  <h2>
                    {localPreview ? "¿Qué movemos" : "Del nombre"}
                    <br />
                    {localPreview ? `hoy, ${displayName}?` : "al diagnóstico."}
                  </h2>
                  <p>
                    {localPreview
                      ? "Recupera un informe, apunta lo que te han contado o prepara tu próxima visita."
                      : "Busca un restaurante, prepara su diagnóstico y llévalo contigo para abrir la conversación."}
                  </p>
                  <button
                    className="ops-hero-input"
                    onClick={() => {
                      setTab(localPreview ? "assistant" : "businesses");
                      if (localPreview)
                        setTimeout(() => input.current?.focus(), 50);
                    }}
                  >
                    <span>
                      {localPreview
                        ? "Escríbeme o cuéntamelo…"
                        : "Prepara tu próxima visita"}
                    </span>
                    <span>
                      {localPreview ? <Mic size={19} /> : <Search size={19} />}
                      <ArrowRight size={19} />
                    </span>
                  </button>
                  <div className="ops-hero-prompts">
                    <button
                      onClick={() => {
                        setTab("businesses");
                        setQuery("");
                      }}
                    >
                      Buscar un restaurante <ArrowRight size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (localPreview) {
                          setTab("assistant");
                          setDraft("¿Qué puedes hacer por mí?");
                        } else setTab("tools");
                      }}
                    >
                      {localPreview
                        ? "Qué puedes hacer"
                        : "Herramientas del estudio"}{" "}
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </section>
                <section className="ops-agenda ops-panel">
                  <div className="ops-section-head">
                    <h2>Próximos pasos</h2>
                    <CalendarDays size={18} />
                  </div>
                  {visits.length ? (
                    visits.slice(0, 3).map((v) => (
                      <div className="ops-visit" key={v.id}>
                        <div className="ops-date-tile">
                          <strong>
                            {new Date(v.starts_at).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              timeZone: "Europe/Madrid",
                            })}
                          </strong>
                          <span>
                            {new Date(v.starts_at).toLocaleDateString("es-ES", {
                              month: "short",
                              timeZone: "Europe/Madrid",
                            })}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelected(v.business_id);
                            setTab("businesses");
                          }}
                        >
                          <strong>{nameFor(v.business_id)}</strong>
                          <small>{date(v.starts_at, true)}</small>
                        </button>
                        <button
                          className="ops-icon-button"
                          disabled={!connected}
                          aria-label={`Completar ${v.title}`}
                          onClick={() =>
                            void act("/complete-visit", { id: v.id }).catch(
                              () => {},
                            )
                          }
                        >
                          <Check size={17} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="ops-agenda-empty">
                      <CalendarDays size={30} strokeWidth={1.3} />
                      <h3>
                        Un poco de espacio <br />
                        para lo que viene.
                      </h3>
                      <p>
                        Elige un negocio y apunta tu próxima visita. La tendrás
                        aquí.
                      </p>
                    </div>
                  )}
                  <button
                    className="ops-text-button"
                    onClick={() => setTab("businesses")}
                  >
                    Preparar una visita <Plus size={16} />
                  </button>
                </section>
              </div>
              <div className="ops-metrics">
                <button onClick={() => setTab("businesses")}>
                  <Store size={19} />
                  <span>
                    <strong>{snapshot?.businesses.length ?? "—"}</strong>{" "}
                    negocios en tu mesa
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button onClick={() => setTab("businesses")}>
                  <FileText size={19} />
                  <span>
                    <strong>{snapshot ? reports.length : "—"}</strong> informes
                    disponibles
                  </span>
                  <ChevronRight size={17} />
                </button>
                <button onClick={() => setTab("activity")}>
                  <Activity size={19} />
                  <span>
                    <strong>{snapshot ? pending.length : "—"}</strong> encargos
                    en marcha
                  </span>
                  <ChevronRight size={17} />
                </button>
              </div>
              <section className="ops-section">
                <div className="ops-section-head">
                  <div>
                    <h2>A mano para tu próxima visita</h2>
                    <p>Los últimos informes que ya tienes preparados.</p>
                  </div>
                  <button
                    className="ops-text-button"
                    onClick={() => setTab("businesses")}
                  >
                    Ver negocios <ArrowRight size={16} />
                  </button>
                </div>
                <div className="ops-report-grid">
                  {reports.slice(0, 3).map((r) => (
                    <article
                      className="ops-report-card"
                      key={`${r.business.id}-${r.type}`}
                    >
                      <div
                        className={`ops-paper ops-paper-${r.type}`}
                        aria-hidden="true"
                      >
                        <span>
                          STUDIO32 <i>↗</i>
                        </span>
                        <b>{r.title}</b>
                        <small>{r.business.name}</small>
                        <div />
                        <div />
                        <div />
                        <em>INFORME GUARDADO · PDF</em>
                      </div>
                      <div className="ops-report-copy">
                        <div>
                          <span className="ops-eyebrow">{r.title}</span>
                          <h3>{r.business.name}</h3>
                          <small>
                            {date(r.updatedAt)} ·{" "}
                            {Math.max(1, Math.round(r.bytes / 1024))} KB
                          </small>
                        </div>
                        <a
                          className={`ops-round-link ${!connected ? "disabled" : ""}`}
                          href={connected ? r.url : undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ${r.title} de ${r.business.name}`}
                        >
                          <ArrowDownToLine size={19} />
                        </a>
                      </div>
                    </article>
                  ))}
                  {!reports.length && (
                    <div className="ops-empty">
                      <FileText size={28} />
                      <h3>Tus informes tendrán su sitio aquí.</h3>
                      <p>Se leen los PDF que ya estén guardados en el motor.</p>
                    </div>
                  )}
                </div>
              </section>
              <div className="ops-footer-note">
                <span className="ops-dot" />
                {connected
                  ? localPreview
                    ? "Datos del motor local. Las fichas conservan su fecha y su fuente."
                    : "Informes privados de tu estudio. Cada documento conserva su fecha y su fuente."
                  : "Tu espacio está preparado para conectar el sobremesa."}
                <span>HECHO PARA TU FORMA DE TRABAJAR ↗</span>
              </div>
            </>
          )}
          {tab === "businesses" && (
            <>
              <div className="ops-page-title">
                <div>
                  <span className="ops-eyebrow">
                    DEL PRIMER CONTACTO AL SIGUIENTE PASO
                  </span>
                  <h1>Tus negocios.</h1>
                  <p>Todo lo que sabes de un local, junto y listo para usar.</p>
                </div>
                <span className="ops-count">
                  {snapshot?.businesses.length || 0} fichas guardadas
                </span>
              </div>
              <ReportJourney focusJob={focusJob} />
              <div className="ops-business-layout">
                <section className="ops-business-list">
                  <label className="ops-search">
                    <Search size={18} />
                    <input
                      placeholder="Nombre, barrio o ciudad"
                      aria-label="Buscar negocios"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        aria-label="Limpiar búsqueda"
                        onClick={() => setQuery("")}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </label>
                  <div className="ops-list-caption">
                    NEGOCIO <span>DOCUMENTOS</span>
                  </div>
                  {filtered.map((b, i) => (
                    <button
                      className={`ops-business-row ${b.id === selected ? "selected" : ""}`}
                      key={b.id}
                      onClick={() => setSelected(b.id)}
                    >
                      <span className={`ops-business-monogram tone-${i % 3}`}>
                        {initials(b.name)}
                      </span>
                      <span>
                        <strong>{b.name}</strong>
                        <small>{b.area || "Zona sin completar"}</small>
                      </span>
                      <b>
                        {b.reports.length}
                        <FileText size={14} />
                      </b>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                  {!filtered.length && (
                    <div className="ops-empty">
                      <Search size={26} />
                      <h3>
                        {query
                          ? "No está en tus fichas guardadas."
                          : "Aún no hay fichas disponibles."}
                      </h3>
                      <p>
                        {query
                          ? "Prueba otro nombre o una zona. Esta búsqueda consulta tu motor local."
                          : "Conecta el sobremesa para leer los negocios del motor."}
                      </p>
                    </div>
                  )}
                </section>
                <section
                  ref={detail}
                  className={`ops-business-detail ops-panel ${business ? "has-selection" : ""}`}
                >
                  {business ? (
                    <>
                      <button
                        className="ops-back-to-list ops-text-button"
                        onClick={() => {
                          setSelected("");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        <ArrowLeft size={16} />
                        Volver a los negocios
                      </button>
                      <div className="ops-detail-top">
                        <span className="ops-business-monogram">
                          {initials(business.name)}
                        </span>
                        <span className="ops-badge">Ficha guardada</span>
                      </div>
                      <h2>{business.name}</h2>
                      <p className="ops-location">
                        <MapPin size={15} />
                        {business.address ||
                          business.area ||
                          "Dirección sin completar"}
                      </p>
                      {business.web && (
                        <a
                          className="ops-web"
                          href={business.web}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {new URL(business.web).hostname}
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <div className="ops-detail-actions">
                        <button
                          className="ops-primary"
                          disabled={!snapshot?.service.modelReady}
                          title={
                            !snapshot?.service.modelReady
                              ? "Esperando al asistente del sobremesa"
                              : undefined
                          }
                          onClick={() => {
                            setTab("assistant");
                            setDraft(
                              "Muéstrame el diagnóstico de este negocio",
                            );
                          }}
                        >
                          <MessageSquare size={16} />
                          Consultar al asistente
                        </button>
                        <button
                          className="ops-secondary"
                          disabled={!desktopOnline}
                          title={
                            !localPreview
                              ? "Prepara una visita para revisar y guardar"
                              : undefined
                          }
                          onClick={() => void propose("schedule_visit")}
                        >
                          <CalendarDays size={17} />
                          Visita
                        </button>
                        <button
                          className="ops-secondary"
                          disabled={!desktopOnline}
                          title={
                            !localPreview
                              ? "Prepara una nota para revisar y guardar"
                              : undefined
                          }
                          onClick={() => void propose("add_note")}
                        >
                          <NotebookPen size={17} />
                          Nota
                        </button>
                      </div>
                      <SecurityNotice
                        business={business}
                        connected={connected}
                      />
                      <h3 className="ops-small-title">
                        Informes preparados{" "}
                        <span>{business.reports.length}</span>
                      </h3>
                      {business.reports.map((r) => (
                        <a
                          className={`ops-document-row ${!connected ? "disabled" : ""}`}
                          key={r.type}
                          href={connected ? r.url : undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>
                            <FileText size={20} />
                          </span>
                          <div>
                            <strong>{r.title}</strong>
                            <small>PDF · {date(r.updatedAt)}</small>
                          </div>
                          <ArrowDownToLine size={17} />
                        </a>
                      ))}
                      {!business.reports.length && (
                        <p className="ops-muted">
                          Todavía no hay PDF guardados para esta ficha.
                        </p>
                      )}
                      {business.findings.length > 0 && (
                        <>
                          <h3 className="ops-small-title">
                            Lo que señala la auditoría
                          </h3>
                          <p className="ops-muted">
                            Medición del {date(business.auditDate)}. Orden
                            original por peso del motor.
                          </p>
                          <div className="ops-findings">
                            {business.findings.map((f, i) => (
                              <details key={i}>
                                <summary>
                                  {f.title}
                                  <Plus size={15} />
                                </summary>
                                <p>{f.evidence}</p>
                                {f.solution && (
                                  <p>
                                    <strong>Propuesta del motor:</strong>{" "}
                                    {f.solution}
                                  </p>
                                )}
                              </details>
                            ))}
                          </div>
                        </>
                      )}
                      <h3 className="ops-small-title">Tus notas</h3>
                      {snapshot?.notes
                        .filter((n) => n.business_id === selected)
                        .map((n) => (
                          <div className="ops-note" key={n.id}>
                            <p>{n.body}</p>
                            <small>{date(n.created_at, true)}</small>
                          </div>
                        ))}
                      {!snapshot?.notes.some(
                        (n) => n.business_id === selected,
                      ) && (
                        <p className="ops-muted">
                          Cuando hables con el dueño, deja aquí lo que quieras
                          recordar.
                        </p>
                      )}
                      <p className="ops-source">
                        Fuente: {business.source}
                        {business.updatedAt && (
                          <> · {date(business.updatedAt)}</>
                        )}
                      </p>
                    </>
                  ) : (
                    <div className="ops-detail-empty">
                      <Store size={35} strokeWidth={1.1} />
                      <h2>
                        Cada negocio,
                        <br />
                        su propio contexto.
                      </h2>
                      <p>
                        Selecciona una ficha para ver sus informes, apuntar una
                        nota o preparar una visita.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "assistant" && (
            <>
              <div className="ops-page-title">
                <div>
                  <span className="ops-eyebrow">
                    UN POCO MENOS DE TRABAJO, UN POCO MÁS DE FOCO
                  </span>
                  <h1>Lo hablamos. Lo hacemos.</h1>
                  <p>
                    {localPreview
                      ? "Escribe o manda una nota de voz. Te respondo por aquí."
                      : "Habla o escribe: consulta informes, encarga un análisis y prepara tus notas o visitas. El PC procesa las peticiones."}
                  </p>
                </div>
              </div>
              <div className="ops-chat-layout">
                <section className="ops-chat ops-panel">
                  <header className="ops-chat-head">
                    <span className="ops-assistant-avatar">
                      <AudioLines size={23} />
                    </span>
                    <div>
                      <strong>Asistente Studio32</strong>
                      <small>
                        {connected && snapshot?.service.modelReady
                          ? "Disponible en tu sobremesa"
                          : localPreview
                            ? "Modelo local desconectado"
                            : "Esperando al servicio del sobremesa"}
                      </small>
                    </div>
                    <button
                      className="ops-icon-button"
                      aria-label="Ayuda del asistente"
                      onClick={() => setHelp(true)}
                    >
                      <CircleHelp size={18} />
                    </button>
                  </header>
                  <div className="ops-chat-context">
                    <Store size={15} />
                    <label htmlFor="ops-context">Contexto</label>
                    <select
                      id="ops-context"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">
                        Mi estudio · conversación general
                      </option>
                      {snapshot?.businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} · {b.area}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className="ops-messages"
                    aria-live="polite"
                    aria-relevant="additions text"
                  >
                    {!snapshot?.messages.length && (
                      <div className="ops-chat-welcome">
                        <span className="ops-welcome-symbol">✳</span>
                        <h2>
                          {business
                            ? `Tenemos a ${business.name} en la mesa.`
                            : "Tu siguiente paso empieza con una frase."}
                        </h2>
                        <p>
                          Puedo recuperar tus informes y ayudarte a preparar
                          notas y visitas. Cada negocio tiene su conversación.
                        </p>
                        <div>
                          {(business
                            ? [
                                "Muéstrame el diagnóstico",
                                "Quiero apuntar una nota de la visita",
                              ]
                            : ["Busca Agua Salada", "¿Qué puedes hacer por mí?"]
                          ).map((text) => (
                            <button key={text} onClick={() => setDraft(text)}>
                              {text}
                              <ArrowRight size={15} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {snapshot?.messages.map((m) => (
                      <article className={`ops-message ${m.role}`} key={m.id}>
                        <span className="ops-message-author">
                          {m.role === "user" ? "Tú" : "Studio32"}{" "}
                          <time>{date(m.created_at, true)}</time>
                        </span>
                        <p>{m.content}</p>
                        {m.cards.map((card, i) =>
                          card.type === "business" ? (
                            <button
                              className="ops-chat-result"
                              key={i}
                              onClick={() => {
                                const b = snapshot.businesses.find(
                                  (b) => b.id === card.id,
                                );
                                if (b) openBusiness(b);
                              }}
                            >
                              <Store size={19} />
                              <span>
                                <strong>{card.name}</strong>
                                <small>{card.area}</small>
                              </span>
                              <ChevronRight size={16} />
                            </button>
                          ) : card.type === "job" ? (
                            <button
                              key={i}
                              className="ops-chat-result"
                              onClick={() => {
                                setFocusJob(card.id);
                                setTab("businesses");
                              }}
                            >
                              <FileText size={20} />
                              <span>
                                <strong>
                                  {card.reportType === "completo"
                                    ? "Análisis completo"
                                    : "Diagnóstico"}{" "}
                                  · {card.business}
                                </strong>
                                <small>Ver progreso y descargar el PDF</small>
                              </span>
                              <ChevronRight size={16} />
                            </button>
                          ) : card.type === "report" ? (
                            <a
                              className={`ops-chat-result ${!connected ? "disabled" : ""}`}
                              key={i}
                              href={connected ? card.url : undefined}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileText size={20} />
                              <span>
                                <strong>{card.title}</strong>
                                <small>{card.business} · PDF guardado</small>
                              </span>
                              <ArrowDownToLine size={17} />
                            </a>
                          ) : (
                            (() => {
                              const p = snapshot.proposals.find(
                                (p) => p.id === card.id,
                              );
                              return p ? (
                                <ProposalForm
                                  key={card.id}
                                  proposal={p}
                                  nameFor={nameFor}
                                  disabled={!connected}
                                  onConfirm={(edits) =>
                                    act("/confirm", { id: p.id, edits })
                                  }
                                  onDiscard={() =>
                                    act("/discard", { id: p.id })
                                  }
                                />
                              ) : null;
                            })()
                          ),
                        )}
                      </article>
                    ))}
                    {pending.some(
                      (j) => j.thread === (selected || "general"),
                    ) && (
                      <div className="ops-thinking">
                        <span />
                        <span />
                        <span /> Consultando tu sobremesa…
                      </div>
                    )}
                    <div ref={end} />
                  </div>
                  <form
                    className="ops-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    <textarea
                      ref={input}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      maxLength={4000}
                      placeholder={
                        business
                          ? `¿Qué hacemos con ${business.name}?`
                          : "Escribe lo que necesitas…"
                      }
                      aria-label="Mensaje al asistente"
                      rows={2}
                    />
                    <div className="ops-composer-bottom">
                      <span>
                        {recording
                          ? `Grabando · ${seconds}s / 60s`
                          : transcribing
                            ? "Transcribiendo en tu PC…"
                            : snapshot?.service.voiceReady
                              ? "Voz o texto. Tú eliges."
                              : "Respuesta escrita · IA local"}
                      </span>
                      <input
                        hidden
                        ref={audioFile}
                        type="file"
                        accept="audio/*"
                        aria-label="Archivo de audio"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void transcribeAudio(file, selected);
                        }}
                      />
                      <button
                        type="button"
                        className="ops-mic"
                        aria-label="Adjuntar audio"
                        title="Transcribir un audio de hasta 60 segundos"
                        disabled={
                          !connected ||
                          !snapshot?.service.voiceReady ||
                          recording ||
                          transcribing
                        }
                        onClick={() => audioFile.current?.click()}
                      >
                        <Paperclip size={18} />
                      </button>
                      <button
                        className={`ops-mic ${recording ? "recording" : ""}`}
                        type="button"
                        aria-label={
                          recording
                            ? "Terminar grabación"
                            : "Grabar nota de voz"
                        }
                        title={
                          snapshot?.service.voiceReady
                            ? "Grabar hasta 60 segundos"
                            : "Transcripción local pendiente de instalar"
                        }
                        disabled={
                          !connected ||
                          !snapshot?.service.voiceReady ||
                          transcribing
                        }
                        onClick={() => void record()}
                      >
                        {transcribing ? (
                          <LoaderCircle className="ops-spin" size={19} />
                        ) : recording ? (
                          <Square size={17} />
                        ) : (
                          <Mic size={19} />
                        )}
                      </button>
                      <button
                        className="ops-send"
                        type="submit"
                        disabled={
                          !connected ||
                          !snapshot?.service.modelReady ||
                          !draft.trim() ||
                          sending ||
                          recording ||
                          transcribing
                        }
                        aria-label="Enviar mensaje"
                      >
                        {sending ? (
                          <LoaderCircle className="ops-spin" size={19} />
                        ) : (
                          <ArrowRight size={20} />
                        )}
                      </button>
                    </div>
                  </form>
                  <p className="ops-chat-footnote">
                    {recording || transcribing
                      ? "La copia del audio se borra tras transcribir. Revisa el texto antes de enviarlo."
                      : "Las propuestas se revisan antes de guardar. Notas y visitas se guardan en tu cuenta y en el sobremesa."}
                  </p>
                </section>
                <aside className="ops-context-panel">
                  <span className="ops-eyebrow">SOBRE LA MESA</span>
                  {business ? (
                    <>
                      <h2>{business.name}</h2>
                      <p>{business.area}</p>
                      <button
                        className="ops-text-button"
                        onClick={() => setTab("businesses")}
                      >
                        Abrir ficha <ArrowRight size={15} />
                      </button>
                      <div className="ops-context-divider" />
                      {business.reports.map((r) => (
                        <a
                          key={r.type}
                          className={`ops-context-report ${!connected ? "disabled" : ""}`}
                          href={connected ? r.url : undefined}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={17} />
                          {r.title}
                          <ExternalLink size={13} />
                        </a>
                      ))}
                      <div className="ops-context-divider" />
                      <button
                        className="ops-context-action"
                        disabled={!connected}
                        onClick={() => void propose("add_note")}
                      >
                        <NotebookPen size={18} />
                        Añadir una nota
                        <Plus size={15} />
                      </button>
                      <button
                        className="ops-context-action"
                        disabled={!connected}
                        onClick={() => void propose("schedule_visit")}
                      >
                        <CalendarDays size={18} />
                        Preparar visita
                        <Plus size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <h2>
                        El contexto
                        <br />
                        marca la diferencia.
                      </h2>
                      <p>
                        Selecciona un negocio en la conversación. Tendré sus
                        informes y su ficha a mano.
                      </p>
                      <button
                        className="ops-text-button"
                        onClick={() => setTab("businesses")}
                      >
                        Elegir un negocio <ArrowRight size={15} />
                      </button>
                    </>
                  )}
                  <div className="ops-context-tip">
                    <AudioLines size={21} />
                    <strong>Háblame como trabajas.</strong>
                    <p>
                      “Acabo de hablar con el dueño. Le interesa el informe
                      completo. Apúntalo para la próxima visita.”
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "activity" && (
            <>
              <div className="ops-page-title">
                <div>
                  <span className="ops-eyebrow">SABER QUÉ ESTÁ PASANDO</span>
                  <h1>El trabajo, a la vista.</h1>
                  <p>Encargos al asistente, resultados y visitas pendientes.</p>
                </div>
                <span className="ops-count">{pending.length} en marcha</span>
              </div>
              <section className="ops-panel ops-activity-list">
                <div className="ops-section-head">
                  <h2>Encargos recientes</h2>
                  <Monitor size={19} />
                </div>
                {snapshot?.jobs.map((j) => (
                  <button
                    key={j.id}
                    className="ops-job"
                    onClick={() => {
                      setSelected(j.thread === "general" ? "" : j.thread);
                      setTab("assistant");
                    }}
                  >
                    <span className={`ops-job-status ${j.status}`}>
                      {j.status === "done" ? (
                        <Check size={18} />
                      ) : j.status === "error" ? (
                        <X size={18} />
                      ) : (
                        <LoaderCircle className="ops-spin" size={18} />
                      )}
                    </span>
                    <span>
                      <strong>{j.text}</strong>
                      <small>
                        {date(j.created_at, true)} ·{" "}
                        {j.thread === "general"
                          ? "Mi estudio"
                          : nameFor(j.thread)}
                        {j.error && ` · ${j.error}`}
                      </small>
                    </span>
                    <b>
                      {
                        (
                          {
                            queued: "En cola",
                            running: "En marcha",
                            done: "Respondido",
                            error: "Necesita atención",
                          } as Record<string, string>
                        )[j.status]
                      }
                    </b>
                    <ChevronRight size={16} />
                  </button>
                ))}
                {!snapshot?.jobs.length && (
                  <div className="ops-empty">
                    <Activity size={27} />
                    <h3>Cuando pidas algo, lo verás aquí.</h3>
                    <p>
                      Podrás saber si está en cola, en marcha o si necesita
                      atención.
                    </p>
                    <button
                      className="ops-primary"
                      onClick={() => setTab("assistant")}
                    >
                      Abrir asistente <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </section>
              <section className="ops-panel ops-activity-list">
                <div className="ops-section-head">
                  <h2>Agenda de visitas</h2>
                  <CalendarDays size={19} />
                </div>
                {snapshot?.visits.map((v) => (
                  <div className="ops-job" key={v.id}>
                    <CalendarDays size={20} />
                    <span>
                      <strong>{v.title}</strong>
                      <small>{date(v.starts_at, true)} · Europe/Madrid</small>
                    </span>
                    {v.status === "done" ? (
                      <span className="ops-badge">Completada</span>
                    ) : (
                      <button
                        className="ops-secondary"
                        disabled={!connected}
                        onClick={() =>
                          void act("/complete-visit", { id: v.id }).catch(
                            () => {},
                          )
                        }
                      >
                        <Check size={16} />
                        Completar
                      </button>
                    )}
                  </div>
                ))}
                {!snapshot?.visits.length && (
                  <p className="ops-muted">
                    Todavía no has apuntado visitas. Puedes prepararlas desde
                    cualquier ficha.
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <nav className="ops-mobile-nav" aria-label="Navegación móvil">
        {navigation.map((n) => (
          <button
            key={n.id}
            className={tab === n.id ? "active" : ""}
            aria-current={tab === n.id ? "page" : undefined}
            onClick={() => {
              setFocusJob("");
              setTab(n.id);
              setError("");
            }}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
        <button
          className={tab === "tools" ? "active" : ""}
          aria-current={tab === "tools" ? "page" : undefined}
          onClick={() => setTab("tools")}
        >
          <Wrench size={21} />
          <span>Más</span>
        </button>
      </nav>
      {help && (
        <div
          className="ops-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHelp(false);
          }}
        >
          <section
            className="ops-modal ops-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-help-title"
            ref={dialog}
          >
            <button
              autoFocus
              className="ops-icon-button"
              aria-label="Cerrar ayuda"
              onClick={() => setHelp(false)}
            >
              <X size={19} />
            </button>
            <span className="ops-eyebrow">PRIMER RECORRIDO · STUDIO32</span>
            <h2 id="ops-help-title">Tu estudio vive aquí.</h2>
            <p>
              {localPreview
                ? "Esta sesión conecta tus fichas y PDF reales con el asistente local. Notas, visitas y conversaciones se guardan en este sobremesa."
                : "Busca un restaurante y encarga su diagnóstico o análisis completo. Puedes pedirlo también al asistente. El PDF quedará disponible aquí."}
            </p>
            <p>
              Los encargos y documentos quedan guardados en Supabase. Si el mapa
              no encuentra un local, puedes indicar su web para comprobarla.
              Revisa el diagnóstico antes de entregarlo.
            </p>
            <p>
              Prospección está en Herramientas, dentro de este espacio. El
              asistente recibe texto o audio desde el Hub. El PC tiene que estar
              encendido para responder o transcribir. Las notas y visitas se
              revisan antes de guardar.
            </p>
            <a
              className="ops-secondary"
              href="https://hub.studio32.es"
              target="_blank"
              rel="noreferrer"
            >
              Abrir Hub publicado <ExternalLink size={16} />
            </a>
            {onSignOut && (
              <button
                className="ops-secondary"
                onClick={() => void onSignOut()}
              >
                <LogOut size={16} />
                Cerrar sesión
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ProposalForm({
  proposal,
  nameFor,
  disabled,
  onConfirm,
  onDiscard,
}: {
  proposal: Proposal;
  nameFor: (id: string) => string;
  disabled: boolean;
  onConfirm: (edits: { note?: string; wallTime?: string }[]) => Promise<void>;
  onDiscard: () => Promise<void>;
}) {
  const [edits, setEdits] = useState(
      proposal.actions.map((a) => ({
        note: a.arguments.note || "",
        wallTime: "",
      })),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    try {
      await onConfirm(edits);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (proposal.status !== "pending")
    return (
      <div className="ops-proposal-finished">
        {proposal.status === "confirmed" ? (
          <>
            <Check size={17} />
            Guardado en el sobremesa
          </>
        ) : (
          <>
            <X size={16} />
            Propuesta descartada
          </>
        )}
      </div>
    );
  return (
    <form
      className="ops-proposal"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <span className="ops-eyebrow">LISTO PARA REVISAR</span>
      {proposal.actions.map((a, i) => (
        <div className="ops-proposal-field" key={i}>
          <strong>
            {a.name === "add_note" ? "Nota" : "Visita"} ·{" "}
            {nameFor(a.arguments.business_id)}
          </strong>
          {a.name === "add_note" ? (
            <label>
              Lo que quieres recordar
              <textarea
                required
                maxLength={4000}
                rows={3}
                value={edits[i].note}
                onChange={(e) =>
                  setEdits((all) =>
                    all.map((v, n) =>
                      n === i ? { ...v, note: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
          ) : (
            <>
              <label>
                Elige fecha y hora · España peninsular
                <input
                  type="datetime-local"
                  required
                  value={edits[i].wallTime}
                  onChange={(e) =>
                    setEdits((all) =>
                      all.map((v, n) =>
                        n === i ? { ...v, wallTime: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <small>La hora queda vacía para que la confirmes tú.</small>
            </>
          )}
        </div>
      ))}
      {error && (
        <p className="ops-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="ops-proposal-actions">
        <button
          type="button"
          className="ops-text-button"
          disabled={busy || disabled}
          onClick={async () => {
            setBusy(true);
            try {
              await onDiscard();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Descartar
        </button>
        <button
          className="ops-primary"
          disabled={busy || disabled}
          type="submit"
        >
          {busy ? (
            <LoaderCircle size={15} className="ops-spin" />
          ) : (
            <Check size={16} />
          )}
          Guardar{" "}
          {proposal.actions.length > 1 ? "las acciones" : "en mi estudio"}
        </button>
      </div>
    </form>
  );
}
