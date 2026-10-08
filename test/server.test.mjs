import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/index.js");

let mock;
let base;
const requests = [];

before(async () => {
  mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : null });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ echo: req.url, items: [] }));
    });
  });
  await new Promise((r) => mock.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${mock.address().port}`;
});

after(() => mock.close());

async function connect(env) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: { ...process.env, FLW_BASE_URL: base, FLW_API_KEY: "pn_test", ...env },
    stderr: "pipe",
  });
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

test("sobe via stdio e expõe as ferramentas principais", async () => {
  const client = await connect({});
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const n of ["flw_status", "flw_search_contacts", "flw_get_contact", "flw_list_panels", "flw_get_panel",
    "flw_list_cards", "flw_create_card", "flw_update_card", "flw_list_sessions", "flw_list_sequences"]) {
    assert.ok(names.includes(n), `faltou ${n}`);
  }
  assert.ok(!names.includes("flw_request"), "flw_request deve ficar desligada por padrão");
  assert.ok(!names.includes("flw_send_text"), "envio de mensagens deve ficar desligado por padrão");
  await client.close();
});

test("flw_request e envio aparecem quando habilitados", async () => {
  const client = await connect({ FLW_ALLOW_RAW_REQUESTS: "true", FLW_ENABLE_MESSAGING: "true" });
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  assert.ok(names.includes("flw_request"));
  assert.ok(names.includes("flw_send_text"));
  assert.ok(names.includes("flw_send_template"));
  await client.close();
});

test("flw_list_cards monta a query correta com arrays e paginação", async () => {
  const client = await connect({});
  const result = await client.callTool({
    name: "flw_list_cards",
    arguments: { panelId: "p1", statuses: ["OPEN", "WON"], pageSize: 50 },
  });
  assert.equal(result.isError, undefined);
  const last = requests.at(-1);
  assert.equal(last.method, "GET");
  const u = new URL(last.url, "http://x");
  assert.equal(u.pathname, "/crm/v2/panel/card");
  assert.equal(u.searchParams.get("PanelId"), "p1");
  assert.deepEqual(u.searchParams.getAll("Statuses"), ["OPEN", "WON"]);
  assert.equal(u.searchParams.get("PageSize"), "50");
  assert.equal(u.searchParams.get("PageNumber"), "1");
  await client.close();
});

test("flw_update_card deriva 'fields' dos campos informados", async () => {
  const client = await connect({});
  const result = await client.callTool({
    name: "flw_update_card",
    arguments: { cardId: "c1", stepId: "s2", monetaryAmount: 1500, tagNames: ["quente"] },
  });
  assert.equal(result.isError, undefined);
  const last = requests.at(-1);
  assert.equal(last.method, "PUT");
  assert.equal(last.url, "/crm/v3/panel/card/c1");
  assert.deepEqual(last.body.fields.sort(), ["MonetaryAmount", "StepId", "TagIds"]);
  assert.equal(last.body.stepId, "s2");
  assert.equal(last.body.options.upsertTagOperation, "InsertIfNotExists");
  await client.close();
});

test("flw_update_card exige lostReasonId para LOST e devolve isError", async () => {
  const client = await connect({});
  const result = await client.callTool({ name: "flw_update_card", arguments: { cardId: "c1", status: "LOST" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /lostReasonId/);
  await client.close();
});

test("flw_search_contacts usa POST /core/v1/contact/filter com corpo paginado", async () => {
  const client = await connect({});
  await client.callTool({ name: "flw_search_contacts", arguments: { textFilter: "ana", tagNames: ["vip"] } });
  const last = requests.at(-1);
  assert.equal(last.method, "POST");
  assert.equal(last.url, "/core/v1/contact/filter");
  assert.equal(last.body.textFilter, "ana");
  assert.deepEqual(last.body.tagNames, ["vip"]);
  assert.equal(last.body.pageNumber, 1);
  assert.equal(last.body.pageSize, 20);
  await client.close();
});
