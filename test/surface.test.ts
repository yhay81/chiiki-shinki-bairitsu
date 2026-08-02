import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import app from "../src/worker";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const worker = read("src/worker.tsx");
const client = read("public/app.js");
const css = read("public/styles.css");
const migration = read("migrations/0001_telemetry.sql");
const surface = `${worker}\n${client}`;
const bindings = {
  ASSETS: {} as Fetcher,
  DB: {
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true }) }),
      first: async () => ({ ok: 1 }),
    }),
  } as unknown as D1Database,
};

describe("product surface", () => {
  it("communicates the regional balance with tickets, tracks, a ratio board, and trends", () => {
    expect(worker).toContain('class="intake-ticket opening-ticket"');
    expect(worker).toContain('class="intake-ticket application-ticket"');
    expect(worker).toContain('class="tally-board"');
    expect(client).toContain('class="ratio-dial"');
    expect(client).toContain('class="balance-bar"');
    expect(client).toContain('class="sparkline"');
    expect(css.toLowerCase()).not.toContain("gradient");
  });
  it("keeps search and four public ids in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/ratios.json")');
    expect(client).toContain("localStorage");
    expect(client).toContain("MAX_COMPARE = 4");
    expect(client).toContain("slice(0, MAX_COMPARE)");
    expect(migration).not.toMatch(
      /prefecture_(?:name|id)|query_(?:text|value)|search_term|employment_value|year_value|email|phone/iu,
    );
  });
  it("states formula, definitions, and interpretation boundaries", () => {
    expect(worker).toContain("新規求人数 ÷ 新規求職申込件数");
    expect(worker).toContain("前月からの繰越は含みません");
    expect(worker).toContain("採用確率、賃金、仕事の質");
    expect(worker).toContain("公共データ利用規約 第1.0版");
    expect(worker).toContain("https://www.mhlw.go.jp/toukei/list/xls/114-1d-06.xlsx");
    expect(worker).toContain("https://www.mhlw.go.jp/toukei/list/xls/114-1d-07.xlsx");
  });
  it("renders four indexable pages with constrained typography and no meta copy", async () => {
    for (const path of ["/", "/guide", "/source", "/privacy"]) {
      const response = await app.request(
        `https://chiiki-shinki-bairitsu.yhay81.com${path}`,
        undefined,
        bindings,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<html lang="ja">');
    }
    expect(css).toContain("2.45rem");
    expect(css).not.toMatch(/font-size:\s*(?:[4-9]|\d{2,})rem/iu);
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });
  it("accepts only same-origin allowlisted telemetry", async () => {
    const accepted = await app.request(
      "https://chiiki-shinki-bairitsu.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://chiiki-shinki-bairitsu.yhay81.com",
          "x-chiiki-shinki-bairitsu-session": "12345678-1234-4123-8123-123456789abc",
          "x-chiiki-shinki-bairitsu-qa": "1",
        },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    const invalid = await app.request(
      "https://chiiki-shinki-bairitsu.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "unknown" }),
      },
      bindings,
    );
    const foreign = await app.request(
      "https://chiiki-shinki-bairitsu.yhay81.com/api/telemetry",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://example.com" },
        body: JSON.stringify({ name: "visited" }),
      },
      bindings,
    );
    expect(accepted.status).toBe(202);
    expect(invalid.status).toBe(400);
    expect(foreign.status).toBe(403);
  });
  it("separates QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-chiiki-shinki-bairitsu-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
});
