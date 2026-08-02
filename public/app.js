const MAX_COMPARE = 4;
const STORAGE_KEY = "chiiki-shinki-bairitsu:compare:v1";
const DEFAULT_SELECTED = ["JP-00", "JP-13", "JP-47"];

const search = document.querySelector("#search");
const region = document.querySelector("#region");
const sort = document.querySelector("#sort");
const employment = document.querySelector("#employment");
const year = document.querySelector("#year");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let index = null;
let records = [];
let recordMap = new Map();
let selected = loadSelected();
let searchTimer;
let noResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "chiiki-shinki-bairitsu:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chiiki-shinki-bairitsu-session": getSession(),
      "x-chiiki-shinki-bairitsu-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return [...DEFAULT_SELECTED];
    const value = JSON.parse(stored);
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [...DEFAULT_SELECTED];
  } catch {
    return [...DEFAULT_SELECTED];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // Comparison remains available for the current page view.
  }
}

const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const currentEmployment = () => index.employments.find((item) => item.id === employment.value);
const currentYear = () => Number(year.value);
const currentYearIndex = () => index.years.indexOf(currentYear());
const recordFor = (placeId) => recordMap.get(placeId);
const valuesFor = (placeId, yearIndex = currentYearIndex()) => {
  const record = recordFor(placeId);
  const pair = record?.[employment.value]?.[yearIndex];
  if (!pair) return { openings: null, applications: null, ratio: null };
  const [openings, applications] = pair;
  return { openings, applications, ratio: applications > 0 ? openings / applications : null };
};
const previousRatioFor = (placeId) => {
  const previousIndex = currentYearIndex() - 1;
  return previousIndex < 0 ? null : valuesFor(placeId, previousIndex).ratio;
};
const ratioChange = (placeId) => {
  const current = valuesFor(placeId).ratio;
  const previous = previousRatioFor(placeId);
  return current === null || previous === null ? null : current - previous;
};
const formatRatio = (value) => (value === null ? "—" : `${value.toFixed(2)}倍`);
const formatCount = (value) => (value === null ? "—" : number.format(value));
const formatChange = (value) =>
  value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

function ratioDomain() {
  const values = records
    .flatMap((record) =>
      record[employment.value].map(([openings, applications]) => openings / applications),
    )
    .filter(Number.isFinite);
  const min = Math.max(0, Math.floor(Math.min(...values) * 10) / 10 - 0.1);
  const max = Math.ceil(Math.max(...values) * 10) / 10 + 0.1;
  return { min, max: Math.max(min + 0.2, max) };
}

function balanceBar(ratio, label) {
  const domain = ratioDomain();
  const width = ratio === null ? 0 : ((ratio - domain.min) / (domain.max - domain.min)) * 100;
  const equalX = ((1 - domain.min) / (domain.max - domain.min)) * 100;
  return `<svg aria-label="${escapeHtml(label)}" class="balance-bar" preserveAspectRatio="none" role="img" viewBox="0 0 100 16">
    <rect class="balance-track" height="8" rx="4" width="100" x="0" y="4"></rect>
    <rect class="balance-value" height="8" rx="4" width="${Math.max(0, Math.min(100, width)).toFixed(2)}" x="0" y="4"></rect>
    <line class="equal-line" x1="${equalX.toFixed(2)}" x2="${equalX.toFixed(2)}" y1="1" y2="15"></line>
  </svg>`;
}

function ratioDial(ratio, label) {
  const domain = ratioDomain();
  const value = ratio === null ? 0 : ((ratio - domain.min) / (domain.max - domain.min)) * 100;
  const equalValue = ((1 - domain.min) / (domain.max - domain.min)) * 100;
  return `<svg aria-label="${escapeHtml(label)}" class="ratio-dial" role="img" viewBox="0 0 110 72">
    <path class="dial-track" d="M10 62 A45 45 0 0 1 100 62" pathLength="100"></path>
    <path class="dial-value" d="M10 62 A45 45 0 0 1 100 62" pathLength="100" stroke-dasharray="${Math.max(0, Math.min(100, value)).toFixed(2)} 100"></path>
    <line class="dial-equal" x1="${(55 - 45 * Math.cos((equalValue / 100) * Math.PI)).toFixed(2)}" x2="${(55 - 39 * Math.cos((equalValue / 100) * Math.PI)).toFixed(2)}" y1="${(62 - 45 * Math.sin((equalValue / 100) * Math.PI)).toFixed(2)}" y2="${(62 - 39 * Math.sin((equalValue / 100) * Math.PI)).toFixed(2)}"></line>
    <text class="dial-number" x="55" y="59">${formatRatio(ratio)}</text>
  </svg>`;
}

function sparkline(placeId) {
  const record = recordFor(placeId);
  const domain = ratioDomain();
  const ratios = record[employment.value].map(
    ([openings, applications]) => openings / applications,
  );
  const points = ratios
    .map((value, i) => {
      const x = (i / (ratios.length - 1)) * 100;
      const y = 54 - ((value - domain.min) / (domain.max - domain.min)) * 48;
      return `${x.toFixed(2)},${Math.max(6, Math.min(54, y)).toFixed(2)}`;
    })
    .join(" ");
  const selectedIndex = currentYearIndex();
  const markerX = (selectedIndex / (ratios.length - 1)) * 100;
  const markerY = 54 - ((ratios[selectedIndex] - domain.min) / (domain.max - domain.min)) * 48;
  return `<svg aria-label="2023年度から2025年度の新規求人倍率推移" class="sparkline" role="img" viewBox="0 0 100 62">
    <line class="spark-grid" x1="0" x2="100" y1="54" y2="54"></line>
    <polyline class="spark-path" points="${points}"></polyline>
    <circle class="spark-marker" cx="${markerX.toFixed(2)}" cy="${Math.max(6, Math.min(54, markerY)).toFixed(2)}" r="2.8"></circle>
  </svg>`;
}

function renderCompare() {
  const places = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean);
  compareCount.textContent = `${places.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = places.length === 0;
  if (places.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4地域を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = places
    .map((place) => {
      const values = valuesFor(place.id);
      return `<article class="compare-card">
        <div class="compare-title"><div><span>${escapeHtml(place.region)}</span><strong>${escapeHtml(place.name)}</strong></div><button aria-label="${escapeHtml(place.name)}を比較から外す" data-remove="${place.id}" type="button">×</button></div>
        <div class="compare-chart">${ratioDial(values.ratio, `${place.name}の新規求人倍率 ${formatRatio(values.ratio)}`)}${sparkline(place.id)}</div>
        <div class="year-scale"><span>2023</span><span>${currentYear()}</span><span>2025</span></div>
        <dl class="count-pair">
          <div><dt>新規求人数</dt><dd>${formatCount(values.openings)}</dd></div>
          <div><dt>新規求職申込件数</dt><dd>${formatCount(values.applications)}</dd></div>
          <div><dt>前年差</dt><dd>${formatChange(ratioChange(place.id))}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function visiblePlaces() {
  const term = normalize(search.value);
  const selectedRegion = region.value;
  const filtered = index.places.filter((place) => {
    const haystack = normalize(`${place.name}${place.region}`);
    return (
      (!term || haystack.includes(term)) &&
      (selectedRegion === "all" || place.region === selectedRegion)
    );
  });
  const sorted = [...filtered];
  const numericSort = (getter) => (a, b) => getter(b.id) - getter(a.id) || a.id.localeCompare(b.id);
  if (sort.value === "ratio-desc") sorted.sort(numericSort((id) => valuesFor(id).ratio ?? -1));
  if (sort.value === "openings-desc")
    sorted.sort(numericSort((id) => valuesFor(id).openings ?? -1));
  if (sort.value === "change-desc") sorted.sort(numericSort((id) => ratioChange(id) ?? -Infinity));
  if (sort.value === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  return sorted;
}

function renderResults() {
  const visible = visiblePlaces();
  resultCount.textContent = number.format(visible.length);
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する地域がありません</h3><p>都道府県名を短くするか、地域を「すべて」に戻してください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((place) => {
      const values = valuesFor(place.id);
      const active = selected.includes(place.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      return `<article class="place-card">
        <div class="place-heading"><div><p>${escapeHtml(place.region)} · ${escapeHtml(place.id.replace("JP-", ""))}</p><h3>${escapeHtml(place.name)}</h3></div><strong>${formatRatio(values.ratio)}</strong></div>
        ${balanceBar(values.ratio, `${place.name} ${currentYear()}年度の新規求人倍率 ${formatRatio(values.ratio)}`)}
        <dl class="place-counts">
          <div><dt>新規求人数</dt><dd>${formatCount(values.openings)}</dd></div>
          <div><dt>新規求職申込件数</dt><dd>${formatCount(values.applications)}</dd></div>
          <div><dt>前年差</dt><dd>${formatChange(ratioChange(place.id))}</dd></div>
        </dl>
        <button class="compare-button${active ? " is-selected" : ""}" data-select="${place.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4地域を選択済み" : "比較に追加"}</button>
      </article>`;
    })
    .join("");
}

function renderAll() {
  renderCompare();
  renderResults();
}
function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderAll();
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track("searched"), 650);
});
region.addEventListener("change", () => {
  renderResults();
  track("region_changed");
});
sort.addEventListener("change", () => {
  renderResults();
  track("sort_changed");
});
employment.addEventListener("change", () => {
  renderAll();
  track("employment_changed");
});
year.addEventListener("change", () => {
  renderAll();
  track("year_changed");
});
copyCompare.addEventListener("click", async () => {
  const lines = selected
    .map((id) => index.places.find((place) => place.id === id))
    .filter(Boolean)
    .map((place) => {
      const values = valuesFor(place.id);
      return `${place.name}｜${formatRatio(values.ratio)}｜新規求人 ${formatCount(values.openings)}｜新規申込 ${formatCount(values.applications)}｜前年差 ${formatChange(ratioChange(place.id))}`;
    });
  await navigator.clipboard.writeText(
    [
      `地域新規求人倍率（${currentYear()}年度・${currentEmployment().name}・職業計）`,
      ...lines,
      "新規求人数÷新規求職申込件数。採用確率・仕事の質・地域順位ではありません。",
      "出典：厚生労働省「職業安定業務統計 雇用関係指標 第6表・第7表」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

Promise.all([
  fetch("/data/index.json").then((response) => {
    if (!response.ok) throw new Error("index_unavailable");
    return response.json();
  }),
  fetch("/data/ratios.json").then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  }),
])
  .then(([indexData, ratioData]) => {
    index = indexData;
    records = ratioData;
    recordMap = new Map(records.map((record) => [record.p, record]));
    const validIds = new Set(index.places.map((place) => place.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    employment.innerHTML = index.employments
      .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
      .join("");
    year.innerHTML = [...index.years]
      .reverse()
      .map((value) => `<option value="${value}">${value}年度</option>`)
      .join("");
    const regions = [...new Set(index.places.map((place) => place.region))];
    region.insertAdjacentHTML(
      "beforeend",
      regions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "全国・47労働局 · 2023—2025年度";
    renderAll();
    track("visited");
  })
  .catch(() => {
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
