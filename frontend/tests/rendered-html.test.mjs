import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
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

test("server-renders the Brain Care demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /脑护通/);
  assert.match(html, /受控照护交互 Demo/);
  assert.match(html, /患者端/);
  assert.match(html, /护士端/);
  assert.match(html, /模拟脑控信号/);
  assert.doesNotMatch(html, /Your site is taking shape|Starter Project|codex-preview/);
});

test("keeps safety thresholds and task workflow in source", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /confidence < 0\.7/);
  assert.match(page, /confidence < 0\.85/);
  assert.match(page, /Math\.min/);
  assert.match(page, /brain-care-tasks/);
  assert.match(page, /pending.*accepted.*done/s);
  assert.match(layout, /脑护通/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
