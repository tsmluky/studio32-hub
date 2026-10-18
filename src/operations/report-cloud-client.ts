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
  payload: { query?: string; city?: string; candidate?: Candidate };
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
        await db.rpc("ops_enqueue_report", {
          p_lookup_id: data?.lookupId,
          p_candidate_id: data?.candidateId,
          p_request_key: data?.requestKey,
        }),
      ),
    };
  if (route === "/journey/download") {
    const doc = check(
      await db
        .from("ops_report_documents")
        .select("storage_path")
        .eq("id", data?.id)
        .single(),
    );
    const signed = check(
      await db.storage
        .from("studio32-reports")
        .createSignedUrl(doc.storage_path, 120, {
          download: data?.download ? "diagnostico-studio32.pdf" : false,
        }),
    );
    return { url: signed.signedUrl };
  }
  throw new Error("Operación no disponible.");
}
const signedCache = new Map<string, { url: string; expires: number }>();
export async function remoteSnapshot(): Promise<Snapshot> {
  const state = (await remoteJourney("/journey/state")) as JourneyState;
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
    b.reports.push({
      type: "diagnostico",
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
    warnings: [
      "El asistente de voz, las notas y la agenda siguen disponibles en la sesión del sobremesa. Desde aquí puedes encargar y descargar diagnósticos.",
    ],
    service: {
      connected: online,
      modelReady: false,
      busy: state.jobs.some((j) => j.status === "running"),
      storage: "Supabase · privado",
      model: "Asistente disponible en el sobremesa",
      voiceReady: false,
      voiceBusy: false,
    },
    messages: [],
    proposals: [],
    notes: [],
    visits: [],
    jobs: state.jobs.map((j) => ({
      id: j.id,
      thread: "general",
      text:
        j.kind === "report"
          ? `Diagnóstico · ${j.payload.candidate?.name}`
          : `Buscar · ${j.payload.query}`,
      status: j.status,
      error: j.error || undefined,
      created_at: j.created_at,
    })),
  };
}
