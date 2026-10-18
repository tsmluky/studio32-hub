import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { cloud, checked, reportState, reportCommand } from "./report-cloud.mjs";
process.loadEnvFile(".env.local");
const state = await reportState();
const doc = state.documents.find((d) =>
  d.motor_version.startsWith("diagnostico-hub-2/"),
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
]) {
  const { error } = await anon.from(table).select("*");
  assert.ok(error, `Lectura anónima permitida: ${table}`);
}
console.log("OK · Las tres tablas rechazan lecturas sin sesión.");
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
await writeFile(
  ".local/report-worker/verification.json",
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      documentId: doc.id,
      bytes: doc.bytes,
      sha256: doc.sha256,
      checks: 4,
    },
    null,
    2,
  ),
);
