import { readFile } from "node:fs/promises";

const index = JSON.parse(await readFile(new URL("../public/data/index.json", import.meta.url)));
const records = JSON.parse(await readFile(new URL("../public/data/ratios.json", import.meta.url)));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(index.schemaVersion === 1, "schema version");
assert(index.years.join(",") === "2023,2024,2025", "years");
assert(index.placeCount === 48 && index.prefectureCount === 47, "places");
assert(index.employmentCount === 3, "employments");
assert(index.pairCount === 432 && index.sourceValueCount === 864, "counts");
assert(records.length === 48, "record count");
assert(new Set(records.map((record) => record.p)).size === 48, "duplicate places");

for (const record of records) {
  for (const employment of index.employments) {
    const pairs = record[employment.id];
    assert(Array.isArray(pairs) && pairs.length === 3, `pair shape ${record.p} ${employment.id}`);
    for (const [opening, application] of pairs) {
      assert(Number.isInteger(opening) && opening >= 0, `opening ${record.p}`);
      assert(Number.isInteger(application) && application > 0, `application ${record.p}`);
    }
  }
  for (let yearIndex = 0; yearIndex < 3; yearIndex += 1) {
    assert(
      record.a[yearIndex][0] === record.f[yearIndex][0] + record.t[yearIndex][0],
      `opening identity ${record.p}`,
    );
    assert(
      record.a[yearIndex][1] === record.f[yearIndex][1] + record.t[yearIndex][1],
      `application identity ${record.p}`,
    );
  }
}

const national = records.find((record) => record.p === "JP-00");
const prefectures = records.filter((record) => record.p !== "JP-00");
for (const employment of index.employments) {
  for (let yearIndex = 0; yearIndex < 3; yearIndex += 1) {
    for (let valueIndex = 0; valueIndex < 2; valueIndex += 1) {
      const sum = prefectures.reduce(
        (total, record) => total + record[employment.id][yearIndex][valueIndex],
        0,
      );
      assert(
        sum === national[employment.id][yearIndex][valueIndex],
        `national sum ${employment.id}`,
      );
    }
  }
}

assert(national.a[2][0] === 8_603_526, "known nationwide openings");
assert(national.a[2][1] === 4_362_423, "known nationwide applications");
const tokyo = records.find((record) => record.p === "JP-13");
assert(tokyo.a[2][0] === 1_276_318 && tokyo.a[2][1] === 417_878, "known Tokyo values");
console.log(
  `Validated ${index.pairCount} regional ratios and ${index.sourceValueCount} source values.`,
);
