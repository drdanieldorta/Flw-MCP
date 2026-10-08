import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { loadConfig } from "../dist/lib/config.js";
import { CrmHttpClient, HttpError } from "../dist/lib/http.js";

let server;
let base;
const hits = [];

before(async () => {
  server = http.createServer((req, res) => {
    hits.push({ url: req.url, auth: req.headers.authorization });
    if (req.url.startsWith("/flaky")) {
      const n = hits.filter((h) => h.url.startsWith("/flaky")).length;
      if (n === 1) { res.writeHead(503); res.end("down"); return; }
    }
    if (req.url.startsWith("/boom")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ key: "ERROR_NOT_FOUND", text: "não encontrado" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, url: req.url }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const client = () => new CrmHttpClient(loadConfig({ FLW_BASE_URL: base, FLW_API_KEY: "pn_tok" }));

test("envia Authorization Bearer e monta query, ignorando undefined", async () => {
  const res = await client().get("/core/v1/contact", { PageSize: 5, Status: "ACTIVE", OrderBy: undefined });
  assert.equal(res.status, 200);
  assert.equal(res.data.url, "/core/v1/contact?PageSize=5&Status=ACTIVE");
  assert.equal(hits.at(-1).auth, "Bearer pn_tok");
});

test("repete parâmetros de array na query", async () => {
  const res = await client().get("/crm/v2/panel", { IncludeDetails: ["Steps", "Tags"] });
  assert.equal(res.data.url, "/crm/v2/panel?IncludeDetails=Steps&IncludeDetails=Tags");
});

test("refaz tentativa em 503", async () => {
  const res = await client().get("/flaky");
  assert.equal(res.status, 200);
});

test("erro 4xx vira HttpError com corpo", async () => {
  await assert.rejects(() => client().get("/boom"), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 404);
    assert.equal(err.body.key, "ERROR_NOT_FOUND");
    return true;
  });
});

test("bloqueia URL fora da base", async () => {
  await assert.rejects(() => client().get("https://evil.example.com/steal"), /fora da base/);
});
