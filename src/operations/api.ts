import { remoteJourney, remoteSnapshot } from "./report-cloud-client";
let localTransport = false;
export function configureTransport(local: boolean) {
  localTransport = local;
}
export type Report = {
  type: string;
  title: string;
  url: string;
  updatedAt: string;
  bytes: number;
};
export type Business = {
  id: string;
  name: string;
  type: string;
  web: string;
  area: string;
  address: string;
  phone: string;
  updatedAt: string;
  source: string;
  reports: Report[];
  findings: {
    title: string;
    evidence: string;
    solution: string;
    state: string;
  }[];
  auditDate: string;
  security?: {
    affectedPages: number;
    measuredAt: string;
    evidence: string[];
    source: string;
  };
};
export type Action = {
  name: "add_note" | "schedule_visit";
  arguments: { business_id: string; note?: string; starts_at?: string };
};
export type Proposal = { id: string; status: string; actions: Action[] };
export type Message = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  cards: (
    | { type: "proposal"; id: string }
    | { type: "business"; id: string; name: string; area: string }
    | { type: "report"; title: string; url: string; business: string }
  )[];
};
export type Snapshot = {
  businesses: Business[];
  warnings: string[];
  service: {
    connected: boolean;
    modelReady: boolean;
    busy: boolean;
    storage: string;
    model: string;
    voiceReady: boolean;
    voiceBusy: boolean;
  };
  messages: Message[];
  proposals: Proposal[];
  notes: {
    id: string;
    business_id: string;
    body: string;
    created_at: string;
  }[];
  visits: {
    id: string;
    business_id: string;
    starts_at: string;
    title: string;
    status: string;
  }[];
  jobs: {
    id: string;
    thread: string;
    text: string;
    status: string;
    error?: string;
    created_at: string;
  }[];
};
let session: string | null = null;
export async function request<T>(
  route: string,
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!localTransport) {
    if (route.startsWith("/journey/"))
      return (await remoteJourney(route, data as Record<string, unknown>)) as T;
    if (route.startsWith("/state") || route === "/reload")
      return (await remoteSnapshot()) as T;
    throw new Error("Esta acción está disponible en la sesión del sobremesa.");
  }
  if (!session) {
    const r = await fetch("/api/operations/session", {
      signal,
      cache: "no-store",
    });
    if (!r.ok || !r.headers.get("content-type")?.includes("application/json"))
      throw new Error("El sobremesa no está conectado a esta sesión.");
    session = (await r.json()).token;
  }
  const response = await fetch(`/api/operations${route}`, {
    method: data === undefined ? "GET" : "POST",
    signal,
    headers: {
      "X-Studio32-Session": session!,
      ...(data instanceof Blob
        ? { "Content-Type": data.type || "audio/webm" }
        : data === undefined
          ? {}
          : { "Content-Type": "application/json" }),
    },
    body:
      data === undefined
        ? undefined
        : data instanceof Blob
          ? data
          : JSON.stringify(data),
    cache: "no-store",
  });
  if (response.status === 401) session = null;
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("No hay conexión con el servicio del sobremesa.");
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "No se pudo completar la operación.");
  return result as T;
}
export const date = (value: string, time = false) => {
  const parsed = new Date(value);
  if (!value || !Number.isFinite(parsed.valueOf()))
    return "Fecha sin registrar";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Madrid",
  }).format(parsed);
};
