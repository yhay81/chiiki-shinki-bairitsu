import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Pair = [number, number];
type RecordRow = { p: string; a: Pair[]; f: Pair[]; t: Pair[] };
const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const records = JSON.parse(
  readFileSync(resolve(root, "public/data/ratios.json"), "utf8"),
) as RecordRow[];
const find = (placeId: string) => records.find((item) => item.p === placeId)!;

describe("matched regional occupation-total ratios", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      schemaVersion: 1,
      asOf: "2026-08-02",
      edition: "2023〜2025年度（現行職業分類・職業計）",
      placeCount: 48,
      prefectureCount: 47,
      employmentCount: 3,
      recordCount: 48,
      pairCount: 432,
      sourceValueCount: 864,
    });
    expect(index.years).toEqual([2023, 2024, 2025]);
    expect(index.sources).toEqual([
      expect.objectContaining({
        kind: "openings",
        sha256: "99e2cad815251763fdb05265e6a8b0be29d04db9615e997646db402591dca8c2",
      }),
      expect.objectContaining({
        kind: "applications",
        sha256: "83ca2a2cdc31a51f075c057456ee4a7cadea8db63925e890cc711156e62b2be8",
      }),
    ]);
  });
  it("contains one unique record per place and three employment series", () => {
    expect(records).toHaveLength(48);
    expect(new Set(records.map((item) => item.p)).size).toBe(48);
    expect(index.places).toHaveLength(48);
    expect(index.employments.map((item: { id: string }) => item.id)).toEqual(["a", "f", "t"]);
  });
  it("retains known nationwide 2025 values", () => {
    expect(find("JP-00").a[2]).toEqual([8_603_526, 4_362_423]);
    expect(find("JP-00").f[2]).toEqual([5_509_350, 2_670_453]);
    expect(find("JP-00").t[2]).toEqual([3_094_176, 1_691_970]);
  });
  it("retains known Tokyo and Okinawa values", () => {
    expect(find("JP-13").a[2]).toEqual([1_276_318, 417_878]);
    expect(find("JP-47").a[2]).toEqual([98_098, 65_506]);
  });
  it("keeps every source value integral and every denominator positive", () => {
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual(["a", "f", "p", "t"]);
      for (const employment of ["a", "f", "t"] as const) {
        expect(record[employment]).toHaveLength(3);
        for (const [opening, seeker] of record[employment]) {
          expect(Number.isInteger(opening)).toBe(true);
          expect(opening).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(seeker)).toBe(true);
          expect(seeker).toBeGreaterThan(0);
        }
      }
    }
    expect(statSync(resolve(root, "public/data/ratios.json")).size).toBeLessThan(25_000);
  });
  it("keeps all employment identities exact", () => {
    for (const record of records) {
      for (let yearIndex = 0; yearIndex < 3; yearIndex += 1) {
        expect(record.a[yearIndex][0]).toBe(record.f[yearIndex][0] + record.t[yearIndex][0]);
        expect(record.a[yearIndex][1]).toBe(record.f[yearIndex][1] + record.t[yearIndex][1]);
      }
    }
  });
  it("keeps nationwide values equal to all 47 labour bureaus", () => {
    const national = find("JP-00");
    const prefectures = records.filter((record) => record.p !== "JP-00");
    for (const employment of ["a", "f", "t"] as const) {
      for (let yearIndex = 0; yearIndex < 3; yearIndex += 1) {
        expect(prefectures.reduce((sum, record) => sum + record[employment][yearIndex][0], 0)).toBe(
          national[employment][yearIndex][0],
        );
        expect(prefectures.reduce((sum, record) => sum + record[employment][yearIndex][1], 0)).toBe(
          national[employment][yearIndex][1],
        );
      }
    }
  });
});
