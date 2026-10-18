import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const env = fileURLToPath(
  new URL("../.local/report-worker/worker.env", import.meta.url),
);
if (existsSync(env)) process.loadEnvFile(env);
export const owner = process.env.STUDIO32_REPORT_OWNER;
export const cloud =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    : null;
export function checked({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
export async function reportState() {
  if (!cloud || !owner)
    throw new Error("Falta configurar la conexión de informes del sobremesa.");
  const [jobs, documents, workers] = await Promise.all([
    cloud
      .from("ops_report_jobs")
      .select("*")
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(30),
    cloud
      .from("ops_report_documents")
      .select("*")
      .eq("workspace_id", "studio32")
      .order("generated_at", { ascending: false })
      .limit(100),
    cloud.from("ops_report_workers").select("*").eq("workspace_id", "studio32"),
  ]);
  return {
    jobs: checked(jobs),
    documents: checked(documents),
    workers: checked(workers),
  };
}
export async function reportCommand(route, data) {
  if (!cloud || !owner)
    throw new Error("La conexión de informes no está configurada.");
  if (route === "/journey/generate")
    return {
      id: checked(
        await cloud.rpc("ops_request_report", {
          p_owner: owner,
          p_business: data.candidateId,
          p_type: data.reportType || "diagnostico",
          p_key: data.requestKey,
          p_lookup: data.lookupId || null,
        }),
      ),
    };
  if (
    route === "/journey/search" ||
    route === "/journey/search-web" ||
    route === "/journey/generate"
  ) {
    const kind = route === "/journey/generate" ? "report" : "lookup";
    const payload =
      kind === "lookup"
        ? {
            query: data.query,
            city: data.city,
            ...(route === "/journey/search-web" ? { web: data.web } : {}),
          }
        : { lookup_id: data.lookupId, candidate_id: data.candidateId };
    return {
      id: checked(
        await cloud.rpc("ops_desktop_enqueue", {
          p_owner: owner,
          p_kind: kind,
          p_payload: payload,
          p_request_key: data.requestKey,
        }),
      ),
    };
  }
  if (route === "/journey/download") {
    const doc = checked(
      await cloud
        .from("ops_report_documents")
        .select("storage_path,report_type")
        .eq("id", data.id)
        .eq("workspace_id", "studio32")
        .single(),
    );
    const signed = checked(
      await cloud.storage
        .from("studio32-reports")
        .createSignedUrl(doc.storage_path, 120, {
          download: data.download ? `${doc.report_type}-studio32.pdf` : false,
        }),
    );
    return { url: signed.signedUrl };
  }
  throw new Error("Operación no disponible.");
}
