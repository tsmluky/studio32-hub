import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = "http://127.0.0.1:4311/api/operations";
const results = [];
const check = async (name, fn) => {
  await fn();
  results.push(name);
  console.log("OK · " + name);
};
let token, state;
await check("El servicio exige sesión para leer datos", async () =>
  assert.equal((await fetch(`${base}/state`)).status, 401),
);
await check("Rechaza páginas de otros orígenes", async () =>
  assert.equal(
    (
      await fetch(`${base}/session`, {
        headers: { Origin: "https://untrusted.example" },
      })
    ).status,
    403,
  ),
);
await check("Rechaza solicitudes cross-site", async () =>
  assert.equal(
    (
      await fetch(`${base}/session`, {
        headers: { "Sec-Fetch-Site": "cross-site" },
      })
    ).status,
    403,
  ),
);
await check("Entrega una sesión local y fichas existentes", async () => {
  token = (await (await fetch(`${base}/session`)).json()).token;
  const r = await fetch(`${base}/state`, {
    headers: { "X-Studio32-Session": token },
  });
  assert.equal(r.status, 200);
  state = await r.json();
  assert.ok(state.businesses.length);
});
await check("Los PDF disponibles se pueden abrir", async () => {
  const report = state.businesses.flatMap((b) => b.reports)[0];
  assert.ok(report);
  const r = await fetch(new URL(report.url, base));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/pdf/);
  assert.equal(
    Buffer.from(await r.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    "%PDF-",
  );
});
await check("No sirve archivos ajenos al catálogo", async () => {
  for (const route of [
    "/reports/unknown/diagnostico",
    "/reports/agua-salada/%2e%2e%2f.env",
  ])
    assert.equal((await fetch(base + route)).status, 404);
});
await check("No acepta escrituras sin sesión", async () =>
  assert.equal(
    (
      await fetch(`${base}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    401,
  ),
);
await check("No acepta propuestas para negocios inexistentes", async () => {
  assert.equal(
    (
      await fetch(`${base}/proposals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Studio32-Session": token,
        },
        body: JSON.stringify({
          businessId: "unknown-fixture",
          kind: "add_note",
        }),
      })
    ).status,
    400,
  );
});
await writeFile(
  new URL("../.local/operations/verificacion-http.json", import.meta.url),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      checks: results,
      businesses: state.businesses.length,
      reports: state.businesses.flatMap((b) => b.reports).length,
    },
    null,
    2,
  ),
);
