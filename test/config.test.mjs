import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, describeConfig, ConfigError, DEFAULT_BASE_URL } from "../dist/lib/config.js";

test("carrega configuração mínima com padrões", () => {
  const cfg = loadConfig({ FLW_API_KEY: "pn_abcd1234efgh" });
  assert.equal(cfg.baseUrl, DEFAULT_BASE_URL);
  assert.equal(cfg.timeoutMs, 30000);
  assert.equal(cfg.allowRawRequests, false);
  assert.equal(cfg.enableMessaging, false);
});

test("aceita FLW_TOKEN como alternativa e remove barra final da base", () => {
  const cfg = loadConfig({ FLW_TOKEN: "pn_x", FLW_BASE_URL: "https://api.flw.chat/" });
  assert.equal(cfg.apiKey, "pn_x");
  assert.equal(cfg.baseUrl, "https://api.flw.chat");
});

test("falha com mensagem clara sem token", () => {
  assert.throws(() => loadConfig({}), (err) => {
    assert.ok(err instanceof ConfigError);
    assert.match(err.message, /FLW_API_KEY/);
    return true;
  });
});

test("mascara o token ao descrever", () => {
  const cfg = loadConfig({ FLW_API_KEY: "pn_live_1234567890" });
  const d = describeConfig(cfg);
  assert.equal(d.apiKey, "pn_l…7890");
  assert.ok(!JSON.stringify(d).includes("pn_live_1234567890"));
});
