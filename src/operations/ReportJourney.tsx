import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  MapPin,
  Monitor,
  Search,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { request, date } from "./api";
import type {
  Candidate,
  JourneyState,
  ReportJob,
  Document,
} from "./report-cloud-client";
import "./report-journey.css";

const pending = (j: ReportJob) => ["queued", "running"].includes(j.status);
export default function ReportJourney({
  focusJob = "",
}: {
  focusJob?: string;
}) {
  const [reportType, setReportType] = useState<"diagnostico" | "completo">(
    "diagnostico",
  );
  const [query, setQuery] = useState(""),
    [city, setCity] = useState("Valencia"),
    [web, setWeb] = useState("");
  const [state, setState] = useState<JourneyState | null>(null),
    [error, setError] = useState(""),
    [connectionError, setConnectionError] = useState(""),
    [busy, setBusy] = useState(false),
    [opening, setOpening] = useState("");
  const [lookupId, setLookupId] = useState(""),
    [selected, setSelected] = useState<Candidate | null>(null),
    [reportId, setReportId] = useState("");
  const live = useRef(true),
    resultTarget = useRef<HTMLDivElement>(null),
    command = useRef(false),
    hasPending = useRef(false),
    requestKey = useRef<{ kind: string; value: string; id: string } | null>(
      null,
    );
  const refresh = useCallback(async () => {
    try {
      const s = await request<JourneyState>("/journey/state");
      if (live.current) {
        hasPending.current = s.jobs.some(pending);
        setState(s);
        setConnectionError("");
      }
    } catch (e) {
      if (live.current) setConnectionError((e as Error).message);
    }
  }, []);
  const working = !!state?.jobs.some(pending);
  useEffect(() => {
    live.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!live.current) return;
      if (!document.hidden) await refresh();
      if (live.current)
        timer = setTimeout(
          () => void poll(),
          hasPending.current ? 4000 : 20000,
        );
    };
    const resume = () => {
      if (!document.hidden) void refresh();
    };
    void poll();
    document.addEventListener("visibilitychange", resume);
    return () => {
      live.current = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh, working]);
  const lookup = state?.jobs.find((j) => j.id === lookupId),
    report = state?.jobs.find((j) => j.id === reportId);
  const online = state?.workers.some(
    (w) =>
      w.status !== "offline" && Date.now() - Date.parse(w.last_seen) < 75000,
  );
  const doc = state?.documents.find((d) => d.id === report?.result?.documentId);
  const library = (state?.documents || []).filter(
    (d, i, docs) =>
      docs.findIndex(
        (other) =>
          other.business_key === d.business_key &&
          other.report_type === d.report_type,
      ) === i,
  );
  useEffect(() => {
    if (focusJob && report?.id === focusJob)
      resultTarget.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [focusJob, report?.id, report?.status]);
  useEffect(() => {
    if (focusJob) {
      setReportId(focusJob);
      void refresh();
    }
  }, [focusJob, refresh]);
  function resume(j: ReportJob) {
    if (j.kind === "lookup") {
      setLookupId(j.id);
      setReportId("");
      setSelected(null);
      setQuery(j.payload.query || "");
      setCity(j.payload.city || "");
    } else {
      setReportId(j.id);
      setSelected(j.payload.candidate || null);
      setLookupId(
        state?.jobs.find(
          (l) =>
            l.kind === "lookup" &&
            l.result?.candidates?.some((c) => c.id === j.payload.candidate?.id),
        )?.id || "",
      );
    }
  }
  function key(kind: string, value: string) {
    if (requestKey.current?.kind !== kind || requestKey.current.value !== value)
      requestKey.current = { kind, value, id: crypto.randomUUID() };
    return requestKey.current.id;
  }
  async function search(website = "") {
    if (command.current || !query.trim()) return;
    command.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await request<{ id: string }>(
        website ? "/journey/search-web" : "/journey/search",
        {
          query: query.trim(),
          city: city.trim(),
          ...(website ? { web: website } : {}),
          requestKey: key(
            "lookup",
            `${query.trim()}|${city.trim()}|${website}`,
          ),
        },
      );
      setLookupId(r.id);
      setSelected(null);
      setReportId("");
      requestKey.current = null;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      command.current = false;
    }
  }
  async function generate(saved?: Document) {
    const target = saved?.business || selected;
    if (!target || command.current) return;
    command.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await request<{ id: string }>("/journey/generate", {
        lookupId: saved ? null : lookupId,
        candidateId: saved?.business_key || target.id,
        reportType: saved ? "completo" : reportType,
        requestKey: key(
          "report",
          `${saved ? "" : lookupId}|${target.id}|${saved ? "completo" : reportType}`,
        ),
      });
      setReportId(r.id);
      requestKey.current = null;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      command.current = false;
    }
  }
  async function open(d: Document, download = false) {
    // Open synchronously so Safari keeps the user gesture while signing the private URL.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setOpening(d.id);
    setError("");
    try {
      const r = await request<{ url: string }>("/journey/download", {
        id: d.id,
        download,
      });
      if (tab) tab.location.href = r.url;
      else window.location.assign(r.url);
    } catch (e) {
      tab?.close();
      setError((e as Error).message);
    } finally {
      setOpening("");
    }
  }
  function progress(j: ReportJob) {
    return (
      <div
        className={`ops-journey-progress ${j.status === "needs_review" || j.status === "failed" ? "attention" : ""}`}
        role="status"
        aria-live="polite"
      >
        <div>
          {pending(j) ? (
            <LoaderCircle className="ops-spin" size={18} />
          ) : j.status === "succeeded" ? (
            <Check size={18} />
          ) : (
            <ShieldCheck size={18} />
          )}
          <strong>
            {j.status === "queued" && !online
              ? "Guardado · esperando al sobremesa"
              : j.stage}
          </strong>
          <span>{j.progress}%</span>
        </div>
        <div className="ops-progress-track">
          <span style={{ width: `${Math.max(3, j.progress)}%` }} />
        </div>
        <p>
          {j.error ||
            (j.status === "queued"
              ? "Puedes salir de esta pantalla. El encargo queda guardado."
              : j.status === "running"
                ? "El PC está trabajando. El PDF aparecerá aquí al terminar."
                : j.status === "needs_review"
                  ? "No entregues este diagnóstico hasta revisar el problema."
                  : "")}
        </p>
        {["failed", "needs_review"].includes(j.status) && (
          <button
            className="ops-secondary"
            onClick={() => {
              if (j.kind === "lookup") void search();
              else {
                requestKey.current = null;
                setReportId("");
              }
            }}
          >
            <RefreshCw size={14} />
            {j.kind === "lookup" ? "Repetir búsqueda" : "Revisar selección"}
          </button>
        )}
      </div>
    );
  }
  return (
    <section className="ops-journey" aria-labelledby="journey-title">
      <div className="ops-journey-heading">
        <div>
          <span className="ops-eyebrow">DE LA CALLE A LA VISITA</span>
          <h2 id="journey-title">Un restaurante. Tu próxima oportunidad.</h2>
          <p>Búscalo, confirma el local y elige qué informe necesitas.</p>
        </div>
        <span className={`ops-badge ${online ? "" : "muted"}`}>
          <Monitor size={14} />
          {online ? "Sobremesa disponible" : "PC sin conexión"}
        </span>
      </div>
      <form
        className="ops-journey-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label>
          <span>Restaurante</span>
          <div>
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre del restaurante"
              required
              minLength={2}
              maxLength={160}
            />
          </div>
        </label>
        <label>
          <span>Ciudad o zona</span>
          <div>
            <MapPin size={17} />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="¿Dónde está?"
              maxLength={120}
            />
          </div>
        </label>
        <button
          className="ops-primary"
          disabled={busy || query.trim().length < 2}
        >
          {busy ? (
            <LoaderCircle className="ops-spin" size={17} />
          ) : (
            <Search size={17} />
          )}
          Buscar restaurante
        </button>
      </form>
      {error && (
        <p className="ops-journey-error" role="alert">
          {error}
        </p>
      )}
      {connectionError && (
        <p className="ops-journey-error" role="alert">
          {connectionError}
        </p>
      )}
      {lookup && pending(lookup) && progress(lookup)}
      {lookup &&
        ["failed", "needs_review"].includes(lookup.status) &&
        progress(lookup)}
      {lookup?.status === "succeeded" && !reportId && (
        <div className="ops-journey-results">
          <div className="ops-list-caption">
            CONFIRMA EL LOCAL{" "}
            <span>{lookup.result?.candidates?.length || 0} resultados</span>
          </div>
          {!lookup.result?.candidates?.length && (
            <p>
              No aparece en las fuentes consultadas. Si tiene web propia,
              podemos comprobarla y preparar su diagnóstico.
            </p>
          )}
          {lookup.result?.candidates?.map((c) => (
            <button
              key={c.id}
              className={`ops-candidate ${selected?.id === c.id ? "selected" : ""}`}
              aria-pressed={selected?.id === c.id}
              onClick={() => setSelected(c)}
            >
              <span className="ops-candidate-check">
                {selected?.id === c.id ? (
                  <Check size={15} />
                ) : (
                  <MapPin size={16} />
                )}
              </span>
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.address}
                  {c.city ? ` · ${c.city}` : ""}
                </small>
                <small>
                  {c.web
                    ? new URL(c.web).hostname
                    : "Sin web propia en la fuente"}
                </small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
          <p className="ops-attribution">
            {lookup.result?.attribution} ·{" "}
            <a
              href={
                lookup.result?.sourceUrl ||
                "https://www.openstreetmap.org/copyright"
              }
              target="_blank"
              rel="noreferrer"
            >
              Ver fuente
            </a>
          </p>
        </div>
      )}
      {lookup?.status === "succeeded" && !reportId && (
        <details
          className="ops-web-fallback"
          open={
            !lookup.result?.candidates?.length || (!!selected && !selected.web)
          }
        >
          <summary>
            {lookup.result?.candidates?.length
              ? "¿No es este local o falta su web?"
              : "Continuar con la web del restaurante"}
          </summary>
          <p>
            Las fuentes del mapa no incluyen todos los negocios. Indica su web y
            comprobaremos que corresponde al nombre.
          </p>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(`${query} ${city} web oficial`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Buscar su web <ExternalLink size={13} />
          </a>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search(web.trim());
            }}
          >
            <label>
              Web del restaurante
              <input
                type="url"
                value={web}
                onChange={(e) => setWeb(e.target.value)}
                placeholder="https://restaurante.es"
                required
                maxLength={2048}
              />
            </label>
            <button className="ops-secondary" disabled={busy || !web.trim()}>
              Comprobar esta web <ArrowRight size={15} />
            </button>
          </form>
        </details>
      )}
      {selected && !reportId && (
        <div className="ops-journey-confirm">
          <div>
            <strong>
              {reportType === "completo"
                ? "Análisis completo de la web"
                : "Diagnóstico para la visita"}
            </strong>
            <p>
              {reportType === "completo"
                ? "Todos los puntos, evidencias y soluciones · PDF privado"
                : "1 página A4 · web actual y oportunidades de mejora · PDF privado"}
            </p>
            <a
              href={selected.web || selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Comprobar la web del local <ExternalLink size={13} />
            </a>
          </div>
          <label className="ops-report-choice">
            Tipo de informe
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(e.target.value as "diagnostico" | "completo")
              }
            >
              <option value="diagnostico">
                Diagnóstico · resumen de una página
              </option>
              <option value="completo">
                Análisis completo · evidencias y plan de arreglos
              </option>
            </select>
          </label>
          <button
            className="ops-primary"
            disabled={busy || !selected.web}
            onClick={() => void generate()}
          >
            Preparar{" "}
            {reportType === "completo" ? "análisis completo" : "diagnóstico"}{" "}
            <ArrowRight size={16} />
          </button>

          <p>
            El completo analiza la web actual. No incluye una web nueva ni
            mediciones de antes/después o recomendaciones de IA.
          </p>
          {!selected.web && (
            <p>
              Necesitamos confirmar su web para analizarla. Selecciona otro
              resultado o revisa la búsqueda.
            </p>
          )}
        </div>
      )}
      <div ref={resultTarget} style={{ scrollMarginTop: 80 }}>
        {report && progress(report)}
      </div>
      {doc && (
        <div className="ops-journey-ready">
          <span className="ops-document-icon">
            <FileText size={27} />
          </span>
          <div>
            <span className="ops-eyebrow">LISTO PARA TU VISITA</span>
            <h3>{doc.business.name}</h3>
            <p>
              {doc.report_type === "completo"
                ? "Análisis completo"
                : "Diagnóstico"}{" "}
              · {date(doc.generated_at)} · {Math.round(doc.bytes / 1024)} KB
              {report?.result?.cached ? " · recuperado de tus informes" : ""}
            </p>
          </div>
          <button
            className="ops-primary"
            disabled={!!opening}
            onClick={() => void open(doc, true)}
          >
            <Download size={16} />
            Descargar PDF
          </button>
          <button
            className="ops-secondary"
            disabled={!!opening}
            onClick={() => void open(doc)}
          >
            Ver para imprimir <ExternalLink size={15} />
          </button>
        </div>
      )}
      {!!state?.jobs.filter(pending).length && (
        <div className="ops-journey-queue">
          <strong>En curso</strong>
          {state.jobs.filter(pending).map((j) => (
            <button key={j.id} onClick={() => resume(j)}>
              <span>
                {j.payload.candidate?.name || j.payload.query}
                <small>{j.stage}</small>
              </span>
              <span>{j.progress}%</span>
            </button>
          ))}
        </div>
      )}
      {!!state?.jobs.some(
        (j) =>
          !pending(j) && !(j.kind === "report" && j.status === "succeeded"),
      ) && (
        <div className="ops-journey-queue">
          <strong>Encargos recientes</strong>
          {state.jobs
            .filter(
              (j) =>
                !pending(j) &&
                !(j.kind === "report" && j.status === "succeeded"),
            )
            .slice(0, 6)
            .map((j) => (
              <button key={j.id} onClick={() => resume(j)}>
                <span>
                  {j.payload.candidate?.name || j.payload.query}
                  <small>
                    {j.kind === "lookup" && j.status === "succeeded"
                      ? `${j.result?.candidates?.length || 0} locales encontrados · ${date(j.created_at)}`
                      : j.stage}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
        </div>
      )}
      {!!state?.documents.length && (
        <div className="ops-journey-library">
          <div className="ops-list-caption">
            TUS INFORMES <span>Disponibles aunque el PC esté apagado</span>
          </div>
          {library.slice(0, 12).map((d) => (
            <div key={d.id}>
              <FileText size={19} />
              <span>
                <strong>{d.business.name}</strong>
                <small>
                  {d.report_type === "completo"
                    ? "Análisis completo"
                    : "Diagnóstico"}{" "}
                  · {d.business.city} · {date(d.generated_at)}
                </small>
              </span>
              <button
                className="ops-icon-button"
                aria-label={`Descargar ${d.report_type === "completo" ? "análisis completo" : "diagnóstico"} de ${d.business.name}`}
                disabled={!!opening}
                onClick={() => void open(d, true)}
              >
                {opening === d.id ? (
                  <LoaderCircle className="ops-spin" size={18} />
                ) : (
                  <Download size={18} />
                )}
              </button>
              {d.report_type !== "completo" &&
                !state.documents.some(
                  (other) =>
                    other.business_key === d.business_key &&
                    other.report_type === "completo",
                ) && (
                  <button
                    className="ops-secondary"
                    disabled={busy}
                    onClick={() => void generate(d)}
                  >
                    Pedir completo
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
      <p className="ops-journey-foot">
        <ShieldCheck size={14} />
        El diagnóstico mide la web; no garantiza recomendaciones de una IA.
        Revisa el PDF antes de entregarlo.
      </p>
    </section>
  );
}
