import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const taskScript = join(dirname(fileURLToPath(import.meta.url)), "..", "task.mjs");
const port = 18080 + Math.floor(Math.random() * 1000);
const baseUrl = `http://127.0.0.1:${port}`;

let stubDirectory;
let server;

function writeStub(name, body) {
  const path = join(stubDirectory, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", body });
  return { status: response.status, json: await response.json() };
}

before(async () => {
  stubDirectory = mkdtempSync(join(tmpdir(), "task-test-"));
  writeStub("bundle", 'for argument in "$@"; do printf "[%s]\\n" "$argument"; done');
  writeStub(
    "psql",
    [
      'for argument in "$@"; do last="$argument"; printf "[%s]\\n" "$argument"; done',
      'case "$last" in',
      '  FAIL) echo "ERROR: relation does not exist" >&2; exit 3 ;;',
      '  BIG) head -c 1048576 /dev/zero | tr "\\0" "x"; echo TAIL ;;',
      "esac",
    ].join("\n"),
  );

  server = spawn(process.execPath, [taskScript], {
    env: {
      PATH: `${stubDirectory}:${process.env.PATH}`,
      AWS_LWA_PORT: String(port),
      DATABASE_URL: "postgres://stub",
    },
    stdio: "ignore",
  });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("task server did not start");
});

after(() => {
  server.kill();
  rmSync(stubDirectory, { recursive: true, force: true });
});

test("answers the readiness check on any GET path", async () => {
  assert.equal((await fetch(`${baseUrl}/`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/anything`)).status, 200);
});

test("runs the migration command", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "migrate" }));

  assert.equal(status, 200);
  assert.equal(json.task, "migrate");
  assert.equal(json.exitCode, 0);
  assert.equal(json.output, "[exec]\n[hanami]\n[db]\n[migrate]\n[--no-dump]\n");
});

test("accepts the event on any POST path", async () => {
  const { status } = await post("/", JSON.stringify({ task: "migrate" }));

  assert.equal(status, 200);
});

test("passes SQL to psql as one argument without shell interpretation", async () => {
  const sql = "select '$(touch /tmp/owned)'; select `id` from \"t\" where a = 'b c'";
  const { status, json } = await post("/events", JSON.stringify({ task: "psql", sql }));

  assert.equal(status, 200);
  assert.equal(
    json.output,
    `[postgres://stub]\n[-v]\n[ON_ERROR_STOP=1]\n[-P]\n[pager=off]\n[-c]\n[${sql}]\n`,
  );
});

test("reports a failing command as a server error with its output", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "psql", sql: "FAIL" }));

  assert.equal(status, 500);
  assert.equal(json.exitCode, 3);
  assert.match(json.output, /ERROR: relation does not exist/);
});

test("rejects an unknown task", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "shell", command: "id" }));

  assert.equal(status, 500);
  assert.equal(json.output, "unknown task");
});

test("rejects psql without SQL text", async () => {
  assert.equal((await post("/events", JSON.stringify({ task: "psql" }))).status, 500);
  assert.equal((await post("/events", JSON.stringify({ task: "psql", sql: "" }))).status, 500);
  assert.equal((await post("/events", JSON.stringify({ task: "psql", sql: ["select 1"] }))).status, 500);
});

test("rejects a body that is not a JSON object with a task", async () => {
  assert.equal((await post("/events", "not json")).status, 500);
  assert.equal((await post("/events", "")).status, 500);
  assert.equal((await post("/events", "null")).status, 500);
});

test("keeps only the tail of very large output", async () => {
  const { status, json } = await post("/events", JSON.stringify({ task: "psql", sql: "BIG" }));

  assert.equal(status, 200);
  assert.equal(Buffer.byteLength(json.output), 256 * 1024);
  assert.ok(json.output.endsWith("TAIL\n"));
});
