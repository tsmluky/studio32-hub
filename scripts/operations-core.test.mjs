import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  createOperations,
  loadCatalogue,
  madridInstant,
} from "./operations-core.mjs";

async function fixture(t, replies = [], observe = () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), "s32-operations-"));
  for (const dir of [
    "datos/fichas",
    "datos/auditorias",
    "informes/gancho",
    "informes/completo",
  ])
    await mkdir(path.join(root, dir), { recursive: true });
  await writeFile(
    path.join(root, "datos/fichas/brisa.json"),
    JSON.stringify({
      nombre: "Brisa",
      url: "https://brisa.test",
      direccion: { barrio: "Cabanyal", ciudad: "Valencia" },
    }),
  );
  await writeFile(
    path.join(root, "informes/gancho/brisa-test.pdf"),
    "%PDF-fixture",
  );
  const provider = {
    chat: async (request) => {
      observe(request);
      if (!replies.length && request.messages.at(-1)?.role === "tool")
        return { role: "assistant", content: "Respuesta tras herramienta" };
      if (!replies.length) throw new Error("modelo no disponible");
      return replies.shift();
    },
  };
  const dataDir = path.join(root, "private"),
    opts = { motorRoot: root, dataDir, provider, health: async () => true };
  const ops = await createOperations(opts);
  t.after(async () => {
    await ops.idle();
    ops.close();
    await rm(root, { recursive: true, force: true });
  });
  return { ops, root, opts };
}
const call = (name, args) => ({
  id: randomUUID(),
  function: { name, arguments: JSON.stringify(args) },
});
test("catalogue exposes only found PDFs; no path traversal or translations as businesses", async (t) => {
  const { ops, root } = await fixture(t);
  await writeFile(
    path.join(root, "datos/fichas/brisa.traducciones.json"),
    '{"nombre":"Wrong"}',
  );
  const c = await loadCatalogue(root);
  assert.equal(c.businesses.length, 1);
  assert.equal(c.businesses[0].reports.length, 1);
  assert.equal(ops.report("../datos/fichas/brisa.json"), undefined);
  assert.equal(ops.report("brisa/completo"), undefined);
});
test("Madrid dates use correct summer/winter offsets and reject invalid or ambiguous DST times", () => {
  assert.equal(madridInstant("2026-10-22T11:00"), "2026-10-22T09:00:00.000Z");
  assert.equal(madridInstant("2026-12-22T11:00"), "2026-12-22T10:00:00.000Z");
  for (const bad of [
    "2026-10-25T02:30",
    "2026-03-29T02:30",
    "2026-02-30T11:00",
    "",
    "2026-10-18",
  ])
    assert.throws(() => madridInstant(bad));
});
test("writes are proposals; explicit edits are validated and duplicate confirmation writes only once", async (t) => {
  const { ops } = await fixture(t);
  const p = ops.propose({ businessId: "brisa", kind: "add_note" });
  assert.equal((await ops.snapshot()).notes.length, 0);
  assert.throws(() => ops.confirm(p.id, [{ note: " " }]));
  ops.confirm(p.id, [{ note: "Nota verificada por el usuario" }]);
  ops.confirm(p.id, [{ note: "Otra" }]);
  const s = await ops.snapshot("brisa");
  assert.equal(s.notes.length, 1);
  assert.equal(s.notes[0].body, "Nota verificada por el usuario");
  assert.equal(s.proposals[0].status, "confirmed");
});
test("a multi-action proposal is atomic when date is missing or invalid", async (t) => {
  const { ops } = await fixture(t, [
    {
      role: "assistant",
      content: "",
      tool_calls: [
        call("add_note", { business_id: "brisa", note: "Interesado" }),
        call("schedule_visit", {
          business_id: "brisa",
          starts_at: "2026-10-22T10:00:00+02:00",
        }),
      ],
    },
  ]);
  ops.send({
    text: "Apunta interesado y prepara visita",
    businessId: "brisa",
    requestId: randomUUID(),
  });
  await ops.idle();
  const s = await ops.snapshot("brisa"),
    p = s.proposals[0];
  assert.equal(s.notes.length, 0);
  assert.equal(s.visits.length, 0);
  assert.throws(() =>
    ops.confirm(p.id, [{ note: "Interesado" }, { wallTime: "" }]),
  );
  assert.equal((await ops.snapshot()).notes.length, 0);
  ops.confirm(p.id, [{ note: "Interesado" }, { wallTime: "2026-10-22T11:00" }]);
  const saved = await ops.snapshot();
  assert.equal(saved.notes.length, 1);
  assert.equal(saved.visits[0].starts_at, "2026-10-22T09:00:00.000Z");
});
test("unknown business or invented tool cannot produce writes", async (t) => {
  const { ops } = await fixture(t, [
    {
      role: "assistant",
      tool_calls: [call("add_note", { business_id: "another", note: "wrong" })],
    },
    { role: "assistant", tool_calls: [call("send_email", { to: "fake" })] },
  ]);
  assert.throws(() => ops.propose({ businessId: "unknown", kind: "add_note" }));
  for (const text of ["primero", "segundo"]) {
    ops.send({ text, businessId: "brisa", requestId: randomUUID() });
    await ops.idle();
  }
  const s = await ops.snapshot("brisa");
  assert.equal(s.notes.length, 0);
  assert.equal(s.proposals.length, 0);
  assert.ok(s.jobs.every((j) => j.status === "error"));
});
test("message idempotency prevents duplicate inference and duplicate history", async (t) => {
  const { ops } = await fixture(t, [{ role: "assistant", content: "Hola" }]);
  const input = { text: "Hola", requestId: randomUUID() };
  assert.equal(ops.send(input).id, ops.send(input).id);
  await ops.idle();
  const s = await ops.snapshot();
  assert.equal(s.jobs.length, 1);
  assert.equal(s.messages.length, 2);
});
test("report tool returns a real document card and no success for absent report", async (t) => {
  const { ops } = await fixture(t, [
    {
      role: "assistant",
      tool_calls: [
        call("get_report", {
          business_id: "brisa",
          report_type: "diagnostico",
        }),
      ],
    },
  ]);
  ops.send({
    text: "Dame el diagnóstico",
    businessId: "brisa",
    requestId: randomUUID(),
  });
  await ops.idle();
  const s = await ops.snapshot("brisa");
  assert.equal(
    s.messages[1].cards[0].url,
    "/api/operations/reports/brisa/diagnostico",
  );
});
test("provider errors become visible failed jobs and allow a later request", async (t) => {
  const { ops } = await fixture(t);
  ops.send({ text: "hola", requestId: randomUUID() });
  await ops.idle();
  const s = await ops.snapshot();
  assert.equal(s.jobs[0].status, "error");
  assert.match(s.messages[1].content, /no disponible/);
});
test("discarded proposal cannot be confirmed, wrong business cannot be substituted", async (t) => {
  const { ops } = await fixture(t);
  const a = ops.propose({ businessId: "brisa", kind: "add_note" });
  ops.discard(a.id);
  assert.throws(() => ops.confirm(a.id, [{ note: "never" }]));
  const b = ops.propose({ businessId: "brisa", kind: "add_note" });
  ops.confirm(b.id, [{ business_id: "wrong", note: "Original business only" }]);
  assert.equal((await ops.snapshot()).notes[0].business_id, "brisa");
});

test("queued requests keep their own user turn, without reading later queued instructions", async (t) => {
  const seen = [];
  const replies = [];
  // Capture messages in the provider boundary rather than copying the SQL assertion.
  const { ops } = await fixture(t, replies, (request) =>
    seen.push(
      request.messages.filter((m) => m.role === "user").map((m) => m.content),
    ),
  );
  replies.push(
    { role: "assistant", content: "Primera respuesta" },
    { role: "assistant", content: "Segunda respuesta" },
  );
  ops.send({ text: "Primera petición", requestId: randomUUID() });
  ops.send({ text: "Segunda petición", requestId: randomUUID() });
  await ops.idle();
  const s = await ops.snapshot();
  assert.equal(s.jobs.length, 2);
  assert.ok(s.jobs.every((j) => j.status === "done"));
  assert.equal(s.messages.filter((m) => m.role === "assistant").length, 2);
  assert.deepEqual(seen[0], ["Primera petición"]);
  assert.equal(seen[1].at(-1), "Segunda petición");
});

test("confirmed notes and visits survive reopening the database", async (t) => {
  const { ops, opts } = await fixture(t);
  const p = ops.propose({ businessId: "brisa", kind: "schedule_visit" });
  ops.confirm(p.id, [{ wallTime: "2026-10-22T12:30" }]);
  const reopened = await createOperations(opts);
  try {
    const saved = await reopened.snapshot("brisa");
    assert.equal(saved.visits.length, 1);
    assert.equal(saved.proposals[0].status, "confirmed");
    reopened.confirm(p.id, [{ wallTime: "2026-10-22T12:30" }]);
    assert.equal((await reopened.snapshot()).visits.length, 1);
  } finally {
    reopened.close();
  }
});

test("read tools can chain search then report in one request", async (t) => {
  const { ops } = await fixture(t, [
    {
      role: "assistant",
      tool_calls: [call("find_business", { query: "Brisa" })],
    },
    {
      role: "assistant",
      tool_calls: [
        call("get_report", {
          business_id: "brisa",
          report_type: "diagnostico",
        }),
      ],
    },
    { role: "assistant", content: "Aquí está" },
  ]);
  ops.send({
    text: "Busca Brisa y dame el diagnóstico",
    requestId: randomUUID(),
  });
  await ops.idle();
  const s = await ops.snapshot();
  assert.equal(s.jobs[0].status, "done");
  assert.deepEqual(
    s.messages.at(-1).cards.map((c) => c.type),
    ["business", "report"],
  );
});

test("successive model write suggestions become one proposal, with no saved actions before review", async (t) => {
  const { ops } = await fixture(t, [
    {
      role: "assistant",
      tool_calls: [
        call("add_note", { business_id: "brisa", note: "Nota de prueba" }),
      ],
    },
    {
      role: "assistant",
      tool_calls: [
        call("schedule_visit", {
          business_id: "brisa",
          starts_at: "2026-10-22T11:00:00+02:00",
        }),
      ],
    },
    { role: "assistant", content: "He guardado todo" }, // Never show an invented success claim.
  ]);
  ops.send({
    text: "Apunta una nota y prepara una visita",
    businessId: "brisa",
    requestId: randomUUID(),
  });
  await ops.idle();
  const s = await ops.snapshot("brisa");
  assert.equal(s.proposals.length, 1);
  assert.equal(s.proposals[0].actions.length, 2);
  assert.equal(s.notes.length, 0);
  assert.equal(s.visits.length, 0);
  assert.match(s.messages.at(-1).content, /propuesta/);
  assert.doesNotMatch(s.messages.at(-1).content, /guardado todo/);
});
