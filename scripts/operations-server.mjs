import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat, writeFile, unlink, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createOperations } from "./operations-core.mjs";
import { reportState, reportCommand } from "./report-cloud.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const createProvider = require("../../studio32-agent/src/providers/ollama.js");
const model = "qwen3.5:4b",
  baseURL = "http://127.0.0.1:11435";
const token = randomBytes(32).toString("hex");
const dataDir = path.join(root, ".local/operations");
const motorRoot =
  process.env.STUDIO32_MOTOR_ROOT || path.resolve(root, "../../Visibilidad-IA");
const speechPython = path.join(root, ".local/voice/Scripts/python.exe");
let speechBusy = false;
const ops = await createOperations({
  motorRoot,
  dataDir,
  provider: createProvider({ baseURL, model, timeoutMs: 120000 }),
  health: async () => {
    try {
      const r = await fetch(`${baseURL}/api/tags`, {
        signal: AbortSignal.timeout(1500),
      });
      return r.ok && (await r.json()).models?.some((m) => m.name === model);
    } catch {
      return false;
    }
  },
});

const allowed = new Set([
  "127.0.0.1:4310",
  "localhost:4310",
  "127.0.0.1:4311",
  "localhost:4311",
]);
export function safeRequest(req) {
  if (!allowed.has(req.headers.host)) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  if (req.headers.origin) {
    try {
      const origin = new URL(req.headers.origin);
      if (origin.protocol !== "http:" || !allowed.has(origin.host))
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
const respond = (res, code, body) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(body));
};
async function body(req, limit = 50000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit)
      throw new Error("El archivo o mensaje es demasiado grande.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function transcribe(buffer) {
  if (speechBusy)
    throw new Error("Ya hay un audio transcribiéndose. Espera un momento.");
  try {
    await stat(speechPython);
  } catch {
    throw new Error(
      "La transcripción local aún no está instalada. Puedes escribir mientras tanto.",
    );
  }
  speechBusy = true;
  const file = path.join(
    dataDir,
    `audio-${randomBytes(10).toString("hex")}.webm`,
  );
  try {
    await writeFile(file, buffer);
    return await new Promise((resolve, reject) => {
      const child = spawn(
        speechPython,
        [path.join(root, "scripts/transcribir-local.py"), file],
        { windowsHide: true, env: { ...process.env, HF_HUB_OFFLINE: "1" } },
      );
      let stdout = "",
        stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 120000);
      child.stdout.on("data", (b) => {
        stdout += b.toString();
      });
      child.stderr.on("data", (b) => {
        stderr = (stderr + b.toString()).slice(-2000);
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(
            new Error(
              "La transcripción ha tardado demasiado. Prueba un audio más corto.",
            ),
          );
          return;
        }
        if (code !== 0) {
          console.error("Transcripción local: " + stderr);
          reject(
            new Error(
              stderr.includes("El audio supera")
                ? "El audio supera los 60 segundos. Recórtalo y vuelve a intentarlo."
                : "No se pudo transcribir el audio localmente. Comprueba la instalación de voz.",
            ),
          );
        } else {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            reject(
              new Error("El transcriptor devolvió una respuesta inválida."),
            );
          }
        }
      });
    });
  } finally {
    speechBusy = false;
    await unlink(file).catch(() => {});
  }
}
await mkdir(dataDir, { recursive: true });
const server = http.createServer(async (req, res) => {
  if (!safeRequest(req))
    return respond(res, 403, {
      error: "Solo se permite acceso desde el Hub local.",
    });
  const url = new URL(req.url, "http://127.0.0.1:4311"),
    route = url.pathname.replace(/^\/api\/operations/, "");
  try {
    if (req.method === "GET" && route === "/session")
      return respond(res, 200, { token });
    if (req.method === "GET" && route.startsWith("/reports/")) {
      const file = ops.report(route.slice("/reports/".length));
      if (!file)
        return respond(res, 404, { error: "Este informe no está disponible." });
      await stat(file);
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(file)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "frame-ancestors 'self'",
      });
      const stream = createReadStream(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
      return;
    }
    const supplied = Buffer.from(
      String(req.headers["x-studio32-session"] || ""),
    );
    if (
      supplied.length !== token.length ||
      !timingSafeEqual(supplied, Buffer.from(token))
    )
      return respond(res, 401, {
        error: "Abre de nuevo la conexión con el sobremesa.",
      });
    if (req.method === "GET" && route === "/state") {
      const state = await ops.snapshot(
        url.searchParams.get("thread") || "general",
      );
      const ready = await stat(path.join(root, ".local/voice/ready"))
        .then(() => true)
        .catch(() => false);
      return respond(res, 200, {
        ...state,
        service: { ...state.service, voiceReady: ready, voiceBusy: speechBusy },
      });
    }
    if (req.method === "GET" && route === "/journey/state")
      return respond(res, 200, await reportState());
    if (req.method !== "POST")
      return respond(res, 404, { error: "Ruta no disponible." });
    if (route === "/transcribe")
      return respond(
        res,
        200,
        await transcribe(await body(req, 8 * 1024 * 1024)),
      );
    if (!String(req.headers["content-type"]).startsWith("application/json"))
      return respond(res, 415, { error: "Se requiere JSON." });
    const data = JSON.parse((await body(req)).toString("utf8") || "{}");
    if (route.startsWith("/journey/"))
      return respond(res, 200, await reportCommand(route, data));
    if (route === "/messages") return respond(res, 202, ops.send(data));
    if (route === "/proposals") return respond(res, 201, ops.propose(data));
    if (route === "/confirm")
      return respond(res, 200, ops.confirm(data.id, data.edits));
    if (route === "/discard") return respond(res, 200, ops.discard(data.id));
    if (route === "/complete-visit")
      return respond(res, 200, ops.completeVisit(data.id));
    if (route === "/reload") return respond(res, 200, await ops.reload());
    respond(res, 404, { error: "Ruta no disponible." });
  } catch (e) {
    respond(res, 400, {
      error: e.message || "No se pudo completar la operación.",
    });
  }
});
server.listen(4311, "127.0.0.1", () =>
  console.log("Studio32 · servicio local http://127.0.0.1:4311"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await ops.idle();
      ops.close();
      process.exit(0);
    }),
  );
