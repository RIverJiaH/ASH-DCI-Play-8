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

async function generatePainPath(sessionId) {
  const root = { optionId: "root-basic-care" };
  const firstResponse = await jsonRequest("/api/options/generate", "POST", {
    sessionId,
    bed: "A01",
    stage: 1,
    selections: [root],
  });
  assert.equal(firstResponse.status, 201);
  const firstSet = await firstResponse.json();
  const pain = firstSet.options.find((option) => option.id === "care-pain");
  assert.ok(pain);

  const painRef = { optionId: pain.id, optionSetId: firstSet.id };
  const secondResponse = await jsonRequest("/api/options/generate", "POST", {
    sessionId,
    bed: "A01",
    stage: 2,
    selections: [root, painRef],
  });
  assert.equal(secondResponse.status, 201);
  const secondSet = await secondResponse.json();
  const abdominal = secondSet.options.find((option) => option.id === "pain-abdominal");
  assert.ok(abdominal);

  return {
    root,
    painRef,
    abdominalRef: { optionId: abdominal.id, optionSetId: secondSet.id },
    firstSet,
    secondSet,
  };
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
  const sessionId = `session-test-confidence-${Date.now()}`;

  const rejected = await jsonRequest("/api/brain-control/evaluate", "POST", {
    sessionId,
    bed: "A01",
    stage: 0,
    optionId: "root-basic-care",
    confidence: 0.69,
    selections: [],
  });
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).decision, "rejected");

  const path = await generatePainPath(sessionId);

  const needsConfirmation = await jsonRequest("/api/brain-control/evaluate", "POST", {
    sessionId,
    bed: "A01",
    stage: 1,
    optionId: path.painRef.optionId,
    optionSetId: path.painRef.optionSetId,
    confidence: 0.8,
    selections: [path.root],
  });
  assert.equal(needsConfirmation.status, 200);
  assert.equal((await needsConfirmation.json()).decision, "confirmation_required");

  const confirmed = await jsonRequest("/api/brain-control/evaluate", "POST", {
    sessionId,
    bed: "A01",
    stage: 1,
    optionId: path.painRef.optionId,
    optionSetId: path.painRef.optionSetId,
    confidence: 0.8,
    confirmed: true,
    selections: [path.root],
  });
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).decision, "accepted");

  const invalid = await jsonRequest("/api/brain-control/evaluate", "POST", {
    sessionId,
    bed: "A01",
    stage: 0,
    optionId: "root-basic-care",
    confidence: 1.2,
    selections: [],
  });
  assert.equal(invalid.status, 400);

  const invalidSelection = await jsonRequest("/api/brain-control/evaluate", "POST", {
    sessionId,
    bed: "A01",
    stage: 1,
    optionId: "made-up-option",
    optionSetId: path.firstSet.id,
    confidence: 0.91,
    selections: [path.root],
  });
  assert.equal(invalidSelection.status, 422);
  assert.equal((await invalidSelection.json()).error.code, "INVALID_SELECTION");
});

test("creates and advances a nursing task through valid states", async () => {
  await jsonRequest("/api/demo/reset", "POST", {});
  const sessionId = `session-test-task-${Date.now()}`;
  const path = await generatePainPath(sessionId);

  const created = await jsonRequest("/api/tasks", "POST", {
    sessionId,
    bed: "A01",
    steps: [
      { ...path.root, confidence: 0.91 },
      { ...path.painRef, confidence: 0.8, confirmed: true },
      { ...path.abdominalRef, confidence: 0.93 },
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

test("creates hydration request after two confirmed selections", async () => {
  await jsonRequest("/api/demo/reset", "POST", {});
  const sessionId = `session-test-hydration-${Date.now()}`;
  const root = { optionId: "root-basic-care" };
  const response = await jsonRequest("/api/options/generate", "POST", {
    sessionId,
    bed: "A01",
    stage: 1,
    selections: [root],
  });
  assert.equal(response.status, 201);
  const optionSet = await response.json();
  const hydration = optionSet.options.find((option) => option.id === "care-hydration");
  assert.ok(hydration);
  assert.equal(hydration.terminal, true);

  const created = await jsonRequest("/api/tasks", "POST", {
    sessionId,
    bed: "A01",
    steps: [
      { ...root, confidence: 0.91 },
      {
        optionId: hydration.id,
        optionSetId: optionSet.id,
        confidence: 0.88,
      },
    ],
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.task.need, "患者需要饮水或口腔护理");
  assert.equal(body.task.steps.length, 2);
});

test("freezes controlled AI options and leaves device execution disabled", async () => {
  await jsonRequest("/api/demo/reset", "POST", {});
  const sessionId = `session-test-safety-${Date.now()}`;
  const path = await generatePainPath(sessionId);

  assert.equal(path.firstSet.source, "mock_ai");
  assert.equal(path.firstSet.options.length, 3);
  assert.ok(path.firstSet.options.every((option) => option.intentCode !== "navigation.back"));
  assert.ok(path.firstSet.options.every((option) => option.actionMode === "request_only"));

  const forged = await jsonRequest("/api/brain-control/evaluate", "POST", {
    sessionId: `${sessionId}-other`,
    bed: "A01",
    stage: 1,
    optionId: path.painRef.optionId,
    optionSetId: path.painRef.optionSetId,
    confidence: 0.91,
    selections: [path.root],
  });
  assert.equal(forged.status, 422);
  assert.equal((await forged.json()).error.code, "OPTION_SET_MISMATCH");

  const deviceAction = await jsonRequest("/api/device-actions", "POST", {
    intentCode: "environment.light.off",
    deviceId: "placeholder-light-01",
    action: "turn_off",
  });
  assert.equal(deviceAction.status, 501);
  assert.equal((await deviceAction.json()).error.code, "DEVICE_INTEGRATION_DISABLED");
});

test("keeps DeepSeek generation server-side and constrained", async () => {
  const [provider, service, page, envExample] = await Promise.all([
    readFile(new URL("../lib/server/deepseek-option-provider.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/ai-option-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  assert.match(provider, /api\.deepseek\.com/);
  assert.match(provider, /response_format/);
  assert.match(provider, /approvedById/);
  assert.match(provider, /guidance/);
  assert.match(service, /using approved fallback/);
  assert.match(page, /DeepSeek 实时分析/);
  assert.match(page, /ai-option-marker/);
  assert.match(envExample, /DEEPSEEK_API_KEY=/);
  assert.doesNotMatch(envExample, /sk-[a-zA-Z0-9]{12,}/);
});
