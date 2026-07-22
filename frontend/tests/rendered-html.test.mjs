import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    const workerUrl = new URL("../dist/server/index.js", import.meta.url);
    workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
    workerPromise = import(workerUrl.href).then((module) => module.default);
  }
  return workerPromise;
}

async function request(path = "/", init = {}) {
  const worker = await getWorker();
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function render() {
  return request("/", {
      headers: { accept: "text/html" },
    });
}

async function jsonRequest(path, method, body) {
  return request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("server-renders the Brain Care demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /脑护通/);
  assert.match(html, /受控照护交互 Demo/);
  assert.match(html, /患者端/);
  assert.match(html, /护理端/);
  assert.match(html, /模拟脑控信号/);
  assert.doesNotMatch(html, /Your site is taking shape|Starter Project|codex-preview/);
});

test("keeps safety thresholds and task workflow in source", async () => {
  const [page, store, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/brain-care-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(store, /evaluateConfidence/);
  assert.match(store, /INVALID_STATUS_TRANSITION/);
  assert.match(page, /Math\.min/);
  assert.match(page, /\/api\/brain-control\/evaluate/);
  assert.match(page, /\/api\/tasks/);
  assert.doesNotMatch(page, /localStorage/);
  assert.match(page, /pending.*accepted.*done/s);
  assert.match(layout, /脑护通/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("enforces confidence decisions in the backend", async () => {
  await jsonRequest("/api/demo/reset", "POST", {});

  const rejected = await jsonRequest("/api/brain-control/evaluate", "POST", {
    bed: "A01",
    stage: 0,
    label: "需求类型",
    value: "疼痛不适",
    confidence: 0.69,
    selections: [],
  });
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).decision, "rejected");

  const needsConfirmation = await jsonRequest("/api/brain-control/evaluate", "POST", {
    bed: "A01",
    stage: 1,
    label: "疼痛部位",
    value: "腹部",
    confidence: 0.8,
    selections: ["疼痛不适"],
  });
  assert.equal(needsConfirmation.status, 200);
  assert.equal((await needsConfirmation.json()).decision, "confirmation_required");

  const confirmed = await jsonRequest("/api/brain-control/evaluate", "POST", {
    bed: "A01",
    stage: 1,
    label: "疼痛部位",
    value: "腹部",
    confidence: 0.8,
    confirmed: true,
    selections: ["疼痛不适"],
  });
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).decision, "accepted");

  const invalid = await jsonRequest("/api/brain-control/evaluate", "POST", {
    bed: "A01",
    stage: 0,
    label: "需求类型",
    value: "疼痛不适",
    confidence: 1.2,
    selections: [],
  });
  assert.equal(invalid.status, 400);

  const invalidSelection = await jsonRequest("/api/brain-control/evaluate", "POST", {
    bed: "A01",
    stage: 1,
    label: "疼痛部位",
    value: "任意文本",
    confidence: 0.91,
    selections: ["疼痛不适"],
  });
  assert.equal(invalidSelection.status, 422);
  assert.equal((await invalidSelection.json()).error.code, "INVALID_SELECTION");
});

test("creates and advances a nursing task through valid states", async () => {
  await jsonRequest("/api/demo/reset", "POST", {});

  const created = await jsonRequest("/api/tasks", "POST", {
    bed: "A01",
    steps: [
      { label: "需求类型", value: "疼痛不适", confidence: 0.91 },
      { label: "疼痛部位", value: "腹部", confidence: 0.8, confirmed: true },
      { label: "程度与性质", value: "重度持续疼痛", confidence: 0.93 },
    ],
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.task.need, "腹部重度持续疼痛");
  assert.equal(createdBody.task.priority, "high");
  assert.equal(createdBody.task.status, "pending");

  const accepted = await jsonRequest(`/api/tasks/${createdBody.task.id}`, "PATCH", {
    action: "accept",
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).task.status, "accepted");

  const completed = await jsonRequest(`/api/tasks/${createdBody.task.id}`, "PATCH", {
    action: "complete",
  });
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).task.status, "done");

  const repeated = await jsonRequest(`/api/tasks/${createdBody.task.id}`, "PATCH", {
    action: "complete",
  });
  assert.equal(repeated.status, 409);

  const reset = await jsonRequest("/api/demo/reset", "POST", {});
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).tasks.length, 3);
});
