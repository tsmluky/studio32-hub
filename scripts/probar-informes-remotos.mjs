import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { cloud, checked, reportState, reportCommand } from "./report-cloud.mjs";
process.loadEnvFile(".env.local");
const state = await reportState();
const doc = state.documents.find((d) =>
  d.motor_version.startsWith("diagnostico-hub-3/"),
);
assert.ok(
  doc,
  "Debe haber un diagnóstico nuevo terminado para comprobar la descarga.",
);
const signed = await reportCommand("/journey/download", { id: doc.id });
const response = await fetch(signed.url);
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type"), /application\/pdf/);
const pdf = Buffer.from(await response.arrayBuffer());
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
assert.equal(pdf.length, doc.bytes);
assert.equal(createHash("sha256").update(pdf).digest("hex"), doc.sha256);
await writeFile(".local/report-worker/descarga-verificada.pdf", pdf);
console.log("OK · PDF descargado desde Supabase, tamaño y SHA-256 idénticos.");
const anon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
for (const table of [
  "ops_report_jobs",
  "ops_report_documents",
  "ops_report_workers",
  "ops_assistant_jobs",
  "ops_assistant_threads",
  "ops_assistant_workers",
]) {
  const { error } = await anon.from(table).select("*");
  assert.ok(error, `Lectura anónima permitida: ${table}`);
}
console.log("OK · Las seis tablas rechazan lecturas sin sesión.");
const raw = await fetch(
  `${process.env.SUPABASE_URL}/storage/v1/object/studio32-reports/${doc.storage_path}`,
  { headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY } },
);
assert.notEqual(raw.status, 200);
console.log("OK · El objeto privado no tiene una descarga pública.");
const { data: forged, error } = await anon.rpc("ops_desktop_enqueue", {
  p_owner: state.jobs[0].owner_id,
  p_kind: "lookup",
  p_payload: { query: "No debe guardarse" },
  p_request_key: crypto.randomUUID(),
});
assert.ok(error);
assert.equal(forged, null);
console.log(
  "OK · Sin sesión no se puede suplantar un encargo del propietario.",
);
const cacheChecks = [];
for (const type of ["diagnostico", "completo"]) {
  const prefix = type === "completo" ? "completo-hub-2/" : "diagnostico-hub-3/";
  const existing = state.documents.find(
    (d) => d.report_type === type && d.motor_version.startsWith(prefix),
  );
  assert.ok(existing, `Falta un ${type} de la versión actual`);
  const queued = await reportCommand("/journey/generate", {
    candidateId: existing.business_key,
    reportType: type,
    requestKey: crypto.randomUUID(),
  });
  const deadline = Date.now() + 90000;
  let job;
  while (Date.now() < deadline) {
    job = checked(
      await cloud
        .from("ops_report_jobs")
        .select("status,result,error")
        .eq("id", queued.id)
        .single(),
    );
    if (!["queued", "running"].includes(job.status)) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert.equal(
    job.status,
    "succeeded",
    job.error || `No terminó la caché de ${type}`,
  );
  assert.equal(job.result.cached, true);
  assert.equal(job.result.documentId, existing.id);
  cacheChecks.push({ type, jobId: queued.id, documentId: existing.id });
}
console.log(
  "OK · Ambos tipos reutilizan su PDF actual sin regenerarlo ni mezclarlos.",
);
await writeFile(
  ".local/report-worker/verification.json",
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      documentId: doc.id,
      bytes: doc.bytes,
      sha256: doc.sha256,
      checks: 5,
      cacheChecks,
    },
    null,
    2,
  ),
);
