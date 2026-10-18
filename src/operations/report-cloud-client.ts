import { supabase } from "../supabase";
import type { Business, Snapshot } from "./api";
export type Candidate = {
  id: string;
  name: string;
  web: string;
  city: string;
  address: string;
  sourceUrl: string;
  sourceLabel: string;
};
export type ReportJob = {
  id: string;
  kind: "lookup" | "report";
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  created_at: string;
  payload: {
    report_type?: string;
    query?: string;
    city?: string;
    candidate?: Candidate;
  };
  result?: {
    candidates?: Candidate[];
    documentId?: string;
    attribution?: string;
    cached?: boolean;
    sourceUrl?: string;
  };
};
export type Document = {
  id: string;
  business_key: string;
  business: Candidate;
  title: string;
  storage_path: string;
  bytes: number;
  generated_at: string;
  expires_at: string;
  report_type: "diagnostico" | "completo";
};
export type JourneyState = {
  jobs: ReportJob[];
  documents: Document[];
  workers: { id: string; last_seen: string; status: string }[];
};
function client() {
  if (!supabase) throw new Error("Falta la conexión con el Hub.");
  return supabase;
}
function check<T>(r: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  if (r.data === null || r.data === undefined)
    throw new Error("No se han recibido datos del Hub.");
  return r.data as NonNullable<T>;
}
export async function remoteJourney(
  route: string,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const db = client();
  if (route === "/journey/state") {
    const [j, d, w] = await Promise.all([
      db
        .from("ops_report_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("ops_report_documents")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(100),
      db.from("ops_report_workers").select("*"),
    ]);
    return { jobs: check(j), documents: check(d), workers: check(w) };
  }
  if (route === "/journey/search")
    return {
      id: check(
        await db.rpc("ops_enqueue_lookup", {
          p_query: data?.query,
          p_city: data?.city,
          p_request_key: data?.requestKey,
        }),
      ),
    };
  if (route === "/journey/search-web")
    return {
      id: check(
        await db.rpc("ops_enqueue_lookup_web", {
          p_query: data?.query,
          p_city: data?.city,
          p_web: data?.web,
          p_request_key: data?.requestKey,
        }),
      ),
    };
  if (route === "/journey/generate")
    return {
      id: check(
        await db.rpc("ops_enqueue_report_kind", {
          p_lookup_id: data?.lookupId || null,
          p_business: data?.candidateId,
          p_type: data?.reportType || "diagnostico",
          p_request_key: data?.requestKey,
        }),
      ),
    };
  if (route === "/journey/download") {
    const doc = check(
      await db
        .from("ops_report_documents")
        .select("storage_path,report_type")
        .eq("id", data?.id)
        .single(),
    );
    const signed = check(
      await db.storage
        .from("studio32-reports")
        .createSignedUrl(doc.storage_path, 120, {
          download: data?.download ? `${doc.report_type}-studio32.pdf` : false,
        }),
    );
    return { url: signed.signedUrl };
  }
  throw new Error("Operación no disponible.");
}
const signedCache = new Map<string, { url: string; expires: number }>();
export async function remoteSnapshot(thread = "general"): Promise<Snapshot> {
  const state = (await remoteJourney("/journey/state")) as JourneyState;
  const db = client();
  const [threads, workers, jobs] = await Promise.all([
    db
      .from("ops_assistant_threads")
      .select("thread,payload,updated_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    db.from("ops_assistant_workers").select("*"),
    db
      .from("ops_assistant_jobs")
      .select("id,thread,operation,body,status,error,created_at,request_key")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const saved = check(threads),
    agentWorkers = check(workers),
    agentJobs = check(jobs);
  const conversation = saved.find((t) => t.thread === thread)?.payload as
    Partial<Snapshot> | undefined;
  const latest = saved[0]?.payload as Partial<Snapshot> | undefined;
  const agentOnline = agentWorkers.some(
    (w) =>
      w.status !== "offline" && Date.now() - Date.parse(w.last_seen) < 75000,
  );
  const businesses: Business[] = [];
  for (const doc of state.documents) {
    let signed = signedCache.get(doc.id);
    if (!signed || signed.expires < Date.now()) {
      const r = check(
        await client()
          .storage.from("studio32-reports")
          .createSignedUrl(doc.storage_path, 3600),
      );
      signed = { url: r.signedUrl, expires: Date.now() + 3000000 };
      signedCache.set(doc.id, signed);
    }
    let b = businesses.find((b) => b.id === doc.business_key);
    if (!b) {
      b = {
        id: doc.business_key,
        name: doc.business.name,
        type: "Restaurante",
        web: doc.business.web,
        area: doc.business.city,
        address: doc.business.address,
        phone: "",
        updatedAt: doc.generated_at,
        source: doc.business.sourceLabel,
        reports: [],
        findings: [],
        auditDate: doc.generated_at,
      };
      businesses.push(b);
    }
    if (b.reports.some((r) => r.type === doc.report_type)) continue;
    b.reports.push({
      type: doc.report_type,
      title: doc.title,
      url: signed.url,
      updatedAt: doc.generated_at,
      bytes: doc.bytes,
    });
  }
  const online = state.workers.some(
    (w) =>
      w.status !== "offline" && Date.now() - Date.parse(w.last_seen) < 75000,
  );
  return {
    businesses,
    warnings: [],
    service: {
      connected: online || agentOnline,
      modelReady: agentOnline && agentWorkers.some((w) => w.model_ready),
      busy: agentJobs.some((j) => ["queued", "running"].includes(j.status)),
      storage: "Supabase · privado",
      model: "Qwen3.5 · sobremesa",
      voiceReady: agentOnline && agentWorkers.some((w) => w.voice_ready),
      voiceBusy: false,
    },
    messages: (conversation?.messages || []).map((m) => ({
      ...m,
      cards: m.cards.map((c) =>
        c.type === "report" && "documentId" in c
          ? { ...c, url: signedCache.get(String(c.documentId))?.url || "" }
          : c,
      ),
    })),
    proposals: conversation?.proposals || [],
    notes: latest?.notes || [],
    visits: latest?.visits || [],
    jobs: [
      ...agentJobs.map((j) => ({
        id: j.id,
        thread: j.thread,
        text: j.body.text || j.operation,
        status: j.status,
        error: j.error || undefined,
        created_at: j.created_at,
      })),
      ...state.jobs.map((j) => ({
        id: j.id,
        thread: "reports",
        text:
          j.kind === "report"
            ? `Diagnóstico · ${j.payload.candidate?.name}`
            : `Buscar · ${j.payload.query}`,
        status: j.status,
        error: j.error || undefined,
        created_at: j.created_at,
      })),
    ],
  };
}

export async function remoteAssistant(
  route: string,
  data: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const db = client(),
    body = (data || {}) as Record<string, unknown>;
  const key =
    typeof body.requestId === "string" ? body.requestId : crypto.randomUUID();
  let payload = body,
    path = "";
  const isAudio = data instanceof Blob;
  if (isAudio) {
    if (!data.size || data.size > 8388608)
      throw new Error("El audio admite hasta 8 MB.");
    const auth = await db.auth.getUser();
    if (auth.error || !auth.data.user)
      throw new Error("Vuelve a iniciar sesión.");
    const user = auth.data.user;
    path = `${user.id}/${key}`;
    check(
      await db.storage.from("studio32-audio").upload(path, data, {
        contentType: data.type.split(";")[0] || "audio/webm",
        upsert: false,
      }),
    );
    payload = { path };
  }
  let id: string;
  try {
    id = check(
      await db.rpc("ops_enqueue_assistant", {
        p_operation: route.slice(1),
        p_body: payload,
        p_thread: body.thread || body.businessId || "general",
        p_request_key: key,
      }),
    );
  } catch (e) {
    if (path) await db.storage.from("studio32-audio").remove([path]);
    throw e;
  }
  if (route === "/messages") return { id };
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const job = check(
      await db
        .from("ops_assistant_jobs")
        .select("status,error,result")
        .eq("id", id)
        .single(),
    );
    if (job.status === "succeeded") return job.result;
    if (job.status === "failed")
      throw new Error(job.error || "No se pudo completar la petición.");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, 1500);
      const abort = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  throw new Error(
    "El encargo sigue guardado. Espera al sobremesa y vuelve a consultar.",
  );
}
