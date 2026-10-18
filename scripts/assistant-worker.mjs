import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile, unlink, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { cloud, checked } from "./report-cloud.mjs";
import { createOperations } from "./operations-core.mjs";
const root = fileURLToPath(new URL("..", import.meta.url)),
  work = path.join(root, ".local/cloud-agent");
const require = createRequire(import.meta.url),
  createProvider = require("../../studio32-agent/src/providers/ollama.js");
const baseURL = "http://127.0.0.1:11435",
  model = "qwen3.5:4b";
const instances = new Map();
let stopping = false,
  active = null,
  lastHeartbeat = 0,
  lastActivity = "";
await mkdir(work, { recursive: true });
for (const s of ["SIGINT", "SIGTERM"])
  process.on(s, () => {
    stopping = true;
  });
async function health() {
  try {
    const r = await fetch(baseURL + "/api/tags", {
      signal: AbortSignal.timeout(1500),
    });
    return r.ok && (await r.json()).models?.some((m) => m.name === model);
  } catch {
    return false;
  }
}
const voiceReady = () =>
  stat(path.join(root, ".local/voice/ready")).then(
    () => true,
    () => false,
  );
async function heartbeat() {
  const activity = stopping ? "offline" : active?.id || "idle";
  if (activity === lastActivity && Date.now() - lastHeartbeat < 15000) return;
  checked(
    await cloud.from("ops_assistant_workers").upsert({
      id: "sobremesa-asistente",
      last_seen: new Date().toISOString(),
      status: stopping ? "offline" : active ? "working" : "idle",
      model_ready: !stopping && (await health()),
      voice_ready: !stopping && (await voiceReady()),
    }),
  );
  lastHeartbeat = Date.now();
  lastActivity = activity;
}
async function catalogue() {
  const docs = checked(
    await cloud
      .from("ops_report_documents")
      .select("*")
      .eq("workspace_id", "studio32")
      .order("generated_at", { ascending: false })
      .limit(100),
  );
  const businesses = [];
  for (const d of docs) {
    let b = businesses.find((b) => b.id === d.business_key);
    if (!b) {
      b = {
        id: d.business_key,
        name: d.business.name,
        area: d.business.city,
        address: d.business.address,
        web: d.business.web,
        type: "Restaurante",
        phone: "",
        source: d.business.sourceLabel,
        updatedAt: d.generated_at,
        auditDate: d.generated_at,
        reports: [],
        findings: [],
      };
      businesses.push(b);
    }
    if (!b.reports.some((r) => r.type === d.report_type))
      b.reports.push({
        type: d.report_type,
        title: d.title,
        documentId: d.id,
        updatedAt: d.generated_at,
        bytes: d.bytes,
      });
  }
  return { businesses, files: new Map(), warnings: [] };
}
async function operations(owner) {
  if (!/^[0-9a-f-]{36}$/.test(owner)) throw new Error("Propietario no válido.");
  if (!instances.has(owner))
    instances.set(
      owner,
      await createOperations({
        dataDir: path.join(work, owner),
        provider: createProvider({ baseURL, model, timeoutMs: 120000 }),
        health,
        catalogueLoader: catalogue,
        requestReport: async (b, type, key) => {
          const hex = createHash("sha256")
            .update(`${owner}|${key}|${b.id}|${type}`)
            .digest("hex");
          const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
          return {
            id: checked(
              await cloud.rpc("ops_request_report", {
                p_owner: owner,
                p_business: b.id,
                p_type: type,
                p_key: uuid,
              }),
            ),
          };
        },
      }),
    );
  return instances.get(owner);
}
async function publish(job, ops, result = null, error = null, done = false) {
  const s = ops ? await ops.snapshot(job.thread) : null;
  if (s) {
    delete s.businesses;
    delete s.service;
    delete s.warnings;
  }
  const ok = checked(
    await cloud.rpc("ops_publish_assistant", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_snapshot: s,
      p_result: result,
      p_error: error,
      p_done: done,
    }),
  );
  if (!ok) throw new Error("La reserva del asistente ha caducado.");
}
async function transcribe(job) {
  const file = path.join(work, `${job.id}.audio`),
    audioPath = job.body.path;
  if (audioPath !== `${job.owner_id}/${job.request_key}`)
    throw new Error("Audio no válido.");
  try {
    const audio = checked(
      await cloud.storage.from("studio32-audio").download(audioPath),
    );
    if (!audio.size || audio.size > 8388608)
      throw new Error("El audio admite hasta 8 MB.");
    await writeFile(file, Buffer.from(await audio.arrayBuffer()));
    return await new Promise((resolve, reject) => {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([k]) => !/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k),
        ),
      );
      const child = spawn(
        path.join(root, ".local/voice/Scripts/python.exe"),
        [path.join(root, "scripts/transcribir-local.py"), file],
        { windowsHide: true, env: { ...env, HF_HUB_OFFLINE: "1" } },
      );
      let output = "",
        err = "",
        timeout = false;
      const timer = setTimeout(() => {
        timeout = true;
        child.kill();
      }, 120000);
      child.stdout.on("data", (b) => {
        output += b.toString();
      });
      child.stderr.on("data", (b) => {
        err = (err + b.toString()).slice(-2000);
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (timeout || code !== 0)
          reject(
            new Error(
              err.includes("El audio supera")
                ? "El audio supera los 60 segundos."
                : "No se pudo transcribir. Prueba un audio más corto.",
            ),
          );
        else {
          try {
            resolve(JSON.parse(output));
          } catch {
            reject(new Error("Respuesta de voz inválida."));
          }
        }
      });
    });
  } finally {
    await unlink(file).catch(() => {});
    await cloud.storage.from("studio32-audio").remove([audioPath]);
  }
}
async function execute(job) {
  if (job.operation === "transcribe") {
    await publish(job, null, await transcribe(job), null, true);
    return;
  }
  const ops = await operations(job.owner_id);
  await ops.reload();
  const d = job.body;
  let result;
  if (job.operation === "messages") {
    if (job.thread !== (d.businessId || "general"))
      throw new Error("La conversación no coincide con el negocio.");
    result = ops.send({ ...d, requestId: job.request_key });
    await publish(job, ops);
    await ops.idle();
    const s = await ops.snapshot(job.thread),
      local = s.jobs.find((j) => j.id === result.id);
    if (local?.status === "error") {
      await publish(job, ops, result, local.error, true);
      return;
    }
  } else if (job.operation === "proposals") {
    if (d.businessId !== job.thread) throw new Error("Negocio no válido.");
    result = ops.propose(d);
  } else if (job.operation === "confirm") result = ops.confirm(d.id, d.edits);
  else if (job.operation === "discard") result = ops.discard(d.id);
  else if (job.operation === "complete-visit") result = ops.completeVisit(d.id);
  else throw new Error("Acción no disponible.");
  await publish(job, ops, result, null, true);
}
async function log(message) {
  console.log(message);
  await appendFile(
    path.join(work, "worker.log"),
    new Date().toISOString() + " " + message + "\n",
  );
}
await log("Asistente remoto listo. Modelo y voz locales.");
while (!stopping) {
  try {
    await heartbeat();
    const jobs = checked(await cloud.rpc("ops_claim_assistant_job"));
    if (jobs.length) {
      active = jobs[0];
      await heartbeat();
      await log(`Recogido ${active.operation} ${active.id}`);
      const job = active;
      const timer = setInterval(() => {
        void publish(job, null)
          .then(heartbeat)
          .catch((e) => log(e.message));
      }, 20000);
      try {
        await execute(job);
        await log(`Terminado ${job.id}`);
      } catch (e) {
        await log(`Error ${job.id}: ${e.message}`);
        await publish(job, null, null, e.message.slice(0, 400), true).catch(
          () => {},
        );
      } finally {
        clearInterval(timer);
        active = null;
        await heartbeat();
      }
    }
  } catch (e) {
    await log("Conexión pendiente: " + e.message);
  }
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, 4000));
}
stopping = true;
await heartbeat().catch(() => {});
for (const ops of instances.values()) ops.close();
