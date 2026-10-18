import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { cloud, checked } from "./report-cloud.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const motor =
  process.env.STUDIO32_MOTOR_ROOT || path.resolve(root, "../../Visibilidad-IA");
const python = path.join(motor, ".venv/Scripts/python.exe");
const work = path.join(root, ".local/report-worker");
const worker = "sobremesa-informes",
  version = "1.0";
if (!cloud)
  throw new Error("Configura primero scripts/configurar-informes-remotos.mjs");
await mkdir(work, { recursive: true });
let stopping = false,
  active = null,
  lastHeartbeat = 0,
  lastActivity = "";
for (const s of ["SIGTERM", "SIGINT"])
  process.on(s, () => {
    stopping = true;
  });
const heartbeat = async () => {
  const activity = stopping ? "offline" : active?.id || "idle";
  if (activity === lastActivity && Date.now() - lastHeartbeat < 15000) return;
  checked(
    await cloud.from("ops_report_workers").upsert({
      id: worker,
      workspace_id: "studio32",
      last_seen: new Date().toISOString(),
      status: stopping ? "offline" : active ? "working" : "idle",
      current_job: active?.id || null,
      version,
    }),
  );
  lastHeartbeat = Date.now();
  lastActivity = activity;
};
async function log(message) {
  console.log(message);
  await appendFile(
    path.join(work, "worker.log"),
    `${new Date().toISOString()} ${message}\n`,
  );
}
async function renew(job, stage, progress) {
  const rows = checked(
    await cloud
      .from("ops_report_jobs")
      .update({
        lease_until: new Date(Date.now() + 90000).toISOString(),
        updated_at: new Date().toISOString(),
        ...(stage ? { stage, progress } : {}),
      })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token)
      .eq("status", "running")
      .gt("lease_until", new Date().toISOString())
      .select("id"),
  );
  if (!rows.length)
    throw new Error(
      "Se perdió la reserva del encargo; otro proceso lo recuperará.",
    );
}
export async function runMotor(job, out) {
  const args = [path.join(root, "scripts/report-motor.py")];
  if (job.kind === "lookup")
    args.push(
      "lookup",
      "--query",
      job.payload.query,
      "--city",
      job.payload.city || "",
      ...(job.payload.web ? ["--web", job.payload.web] : []),
    );
  else {
    const input = path.join(out, "candidate.json");
    await writeFile(input, JSON.stringify(job.payload.candidate));
    args.push("generate", "--candidate", input, "--out", out);
  }
  return new Promise((resolve, reject) => {
    // Credentials are not inherited by the web-reading subprocess.
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([k]) => !/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k),
      ),
    );
    const child = spawn(python, args, {
      windowsHide: true,
      cwd: motor,
      env: { ...env, PYTHONIOENCODING: "utf-8", STUDIO32_MOTOR_ROOT: motor },
    });
    let buffer = "",
      result,
      review,
      err = "",
      chain = Promise.resolve(),
      settled = false;
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error(
          "El análisis superó los diez minutos. Puedes volver a pedirlo.",
        ),
      );
    }, 600000);
    child.stdout.on("data", (b) => {
      buffer += b.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line);
          if (e.event === "progress")
            chain = chain
              .then(() => renew(job, e.stage, e.progress))
              .catch((error) => {
                child.kill();
                if (!settled) {
                  settled = true;
                  reject(error);
                }
              });
          if (e.event === "result") result = e.result;
          if (e.event === "review") review = e.error;
          if (e.event === "error") err = e.error;
        } catch {
          err = "Respuesta inválida del motor.";
        }
      }
    });
    child.stderr.on("data", (b) => {
      void appendFile(path.join(out, "motor.log"), b);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      await chain;
      if (settled) return;
      if (review) resolve({ review });
      else if (code !== 0 || !result)
        reject(
          new Error(
            err ||
              "El motor no pudo terminar. Revisa el registro del sobremesa.",
          ),
        );
      else resolve(result);
    });
  });
}
async function finish(
  job,
  result,
  document = null,
  status = "succeeded",
  error = null,
) {
  const ok = checked(
    await cloud.rpc("ops_finish_report_job", {
      p_job: job.id,
      p_lease: job.lease_token,
      p_result: result,
      p_document: document,
      p_status: status,
      p_error: error,
    }),
  );
  if (!ok)
    throw new Error(
      "La reserva caducó antes de publicar. El encargo se recuperará.",
    );
}
async function execute(job) {
  const out = path.join(work, "jobs", job.id);
  await mkdir(out, { recursive: true });
  if (job.kind === "report") {
    const cached = checked(
      await cloud
        .from("ops_report_documents")
        .select("id")
        .eq("business_key", job.payload.candidate.id)
        .eq("workspace_id", job.workspace_id)
        .like("motor_version", "diagnostico-hub-2/%")
        .gt("expires_at", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1),
    );
    if (cached.length) {
      await finish(job, { documentId: cached[0].id, cached: true });
      return;
    }
  }
  const result = await runMotor(job, out);
  if (result.review) {
    await finish(job, null, null, "needs_review", result.review);
    return;
  }
  if (job.kind === "lookup") {
    await finish(job, result);
    return;
  }
  const file = path.resolve(result.pdf);
  if (
    !file.startsWith(path.resolve(out) + path.sep) ||
    path.extname(file) !== ".pdf"
  )
    throw new Error("Ruta de PDF no válida.");
  const bytes = await readFile(file),
    hash = createHash("sha256").update(bytes).digest("hex");
  if (
    bytes.length !== result.bytes ||
    hash !== result.sha256 ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    throw new Error("No coincide la comprobación del PDF.");
  await renew(job, "Guardando el PDF privado", 95);
  // Unique immutable path per lease: a late worker can never overwrite a published PDF.
  const storagePath = `${job.workspace_id}/${job.id}/${job.lease_token}.pdf`;
  checked(
    await cloud.storage.from("studio32-reports").upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    }),
  );
  const doc = {
    id: job.id,
    business_key: job.payload.candidate.id,
    title: `Diagnóstico · ${job.payload.candidate.name}`,
    storage_path: storagePath,
    sha256: hash,
    bytes: bytes.length,
    motor_version: result.motorVersion,
  };
  try {
    await finish(
      job,
      {
        documentId: doc.id,
        cached: false,
        auditDate: result.auditDate,
        findings: result.findings,
      },
      doc,
    );
  } catch (error) {
    // Never delete after an ambiguous network failure: finish may have committed.
    // A private orphan is safer than deleting a published customer's report.
    throw error;
  }
}
await log("Worker de informes listo. Sin APIs de modelos.");
while (!stopping) {
  try {
    await heartbeat();
    const jobs = checked(
      await cloud.rpc("ops_claim_report_job", { p_worker: worker }),
    );
    if (jobs.length) {
      active = jobs[0];
      await heartbeat();
      await log(`Recogido ${active.kind} ${active.id}`);
      let lostLease = false;
      const timer = setInterval(() => {
        void renew(active)
          .then(heartbeat)
          .catch(() => {
            lostLease = true;
          });
      }, 20000);
      try {
        await execute(active);
        await log(`Procesado ${active.id}; consulta su estado en el Hub.`);
      } catch (e) {
        await log(`Error ${active.id}: ${e.message}`);
        if (!lostLease)
          await finish(
            active,
            null,
            null,
            "failed",
            e.message.slice(0, 400),
          ).catch(() => {});
      } finally {
        clearInterval(timer);
        active = null;
        await heartbeat();
      }
    }
  } catch (e) {
    await log(`Conexión pendiente: ${e.message}`);
  }
  if (process.argv.includes("--once")) break;
  await new Promise((r) => setTimeout(r, 4000));
}
stopping = true;
await heartbeat().catch(() => {});
