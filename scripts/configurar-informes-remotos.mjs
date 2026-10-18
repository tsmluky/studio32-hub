import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)),
  project = "wwhinwxedcvpxprmcsta";
const linked = (
  await readFile(path.join(root, "supabase/.temp/project-ref"), "utf8")
).trim();
if (linked !== project)
  throw new Error(
    "El proyecto enlazado no es Studio32 Hub. No se configura nada.",
  );
// Capture keys in memory. Never print the CLI result or pass secrets as arguments.
let keys;
try {
  const output = execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/supabase/dist/supabase.js"),
      "projects",
      "api-keys",
      "--project-ref",
      project,
      "-o",
      "json",
    ],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  keys = JSON.parse(output);
} catch {
  console.error(
    "No se pudieron obtener las claves con la sesión de Supabase CLI. No se muestran detalles sensibles.",
  );
  process.exit(1);
}
const anon = keys.find((k) => k.name === "anon")?.api_key,
  secret = keys.find((k) => k.name === "service_role")?.api_key;
if (!anon || !secret)
  throw new Error(
    "No se han obtenido las claves necesarias; no se escriben archivos.",
  );
const url = `https://${project}.supabase.co`,
  admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const { data: member, error } = await admin
  .from("workspace_members")
  .select("user_id")
  .eq("workspace_id", "studio32")
  .eq("member_id", "pancho")
  .single();
if (error || !member)
  throw new Error("No se ha verificado la cuenta propietaria.");
await mkdir(path.join(root, ".local/report-worker"), { recursive: true });
const file = path.join(root, ".local/report-worker/worker.env");
try {
  await access(file);
  console.log("Configuración privada ya existente; se conserva.");
} catch {
  await writeFile(
    file,
    `SUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${secret}\nSTUDIO32_REPORT_OWNER=${member.user_id}\n`,
    { mode: 0o600 },
  );
  console.log("Conexión del worker preparada en archivo local ignorado.");
}
const frontend = path.join(root, ".env.local");
try {
  await access(frontend);
  console.log(".env.local existente; se conserva.");
} catch {
  await writeFile(
    frontend,
    `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_ANON_KEY=${anon}\n`,
    { mode: 0o600 },
  );
  console.log("Configuración pública del cliente preparada.");
}
