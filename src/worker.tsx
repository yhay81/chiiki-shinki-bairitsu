import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://chiiki-shinki-bairitsu.yhay81.com";
const dataPage = "https://www.mhlw.go.jp/toukei/list/114-1d.html";
const openingsWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-06.xlsx";
const applicationsWorkbook = "https://www.mhlw.go.jp/toukei/list/xls/114-1d-07.xlsx";
const termsPage = "https://www.mhlw.go.jp/toukei/list/114-1_yougo.html";
const useTerms = "https://www.mhlw.go.jp/chosakuken/index.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "region_changed",
  "sort_changed",
  "employment_changed",
  "year_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-chiiki-shinki-bairitsu-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-chiiki-shinki-bairitsu-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "地域比較" },
  { href: "/guide", label: "数字の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#4a2a3a" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="地域新規求人倍率 ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
            <i />
          </span>
          <span>地域新規求人倍率</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>地域新規求人倍率</strong>
          <p>厚生労働省「職業安定業務統計 雇用関係指標」を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/chiiki-shinki-bairitsu">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const IntakeFigure = () => (
  <div
    aria-label="全国の2025年度、パートを含む常用の新規求人数860万3526、新規求職申込436万2423、新規求人倍率1.97倍を示す受付台帳"
    class="intake-figure"
    role="img"
  >
    <div class="board-tabs" aria-hidden="true">
      <span>全国＋47労働局</span>
      <span>2023—2025</span>
    </div>
    <div class="counter-sign">
      <span>職業計 · パートを含む常用</span>
      <b>2025年度</b>
    </div>
    <div class="intake-lanes" aria-hidden="true">
      <div class="intake-ticket opening-ticket">
        <span>新規求人数</span>
        <strong>8,603,526</strong>
      </div>
      <div class="intake-stamp">
        <i>受</i>
        <small>同じ年度</small>
      </div>
      <div class="intake-ticket application-ticket">
        <span>新規求職申込件数</span>
        <strong>4,362,423</strong>
      </div>
    </div>
    <div class="tally-board" aria-hidden="true">
      <span>新規求人 ÷ 新規申込</span>
      <strong>1.97倍</strong>
      <small>全国 · 2025</small>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="全国・47労働局の新規求人倍率を、2023〜2025年度、3つの常用雇用区分、新規求人・新規申込の元件数とともに最大4地域で比較できます。"
    title="全国・都道府県の新規求人倍率を比較 | 地域新規求人倍率"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="period-label">職業計 · 2023—2025年度</p>
          <h1>新しく届いた求人と申込みを、地域ごとに。</h1>
          <p class="lead">
            同じ労働局・年度・雇用区分の受付件数をそろえ、新規求人倍率と変化を並べます。
          </p>
          <div aria-label="収録内容" class="hero-facts">
            <span>
              <b>48</b> 全国・労働局
            </span>
            <span>
              <b>3</b> 雇用区分
            </span>
            <span>
              <b>最大4</b> 地域比較
            </span>
          </div>
        </div>
        <IntakeFigure />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading compare-heading">
          <div>
            <p class="section-kicker">選択した地域</p>
            <h2 id="compare-title">倍率と3年推移</h2>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <div class="metric-controls">
          <label>
            <span>雇用区分</span>
            <select id="employment" />
          </label>
          <label>
            <span>年度</span>
            <select id="year" />
          </label>
          <div class="ratio-legend" aria-label="倍率の読み方">
            <span>
              <i /> 1倍 = 新規求人と新規申込が同数
            </span>
          </div>
        </div>
        <p class="metric-note">
          職業計の新規求人数を新規求職申込件数で割った値です。前月からの繰越は含みません。
        </p>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4地域を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="section-kicker">地域一覧</p>
            <h2 id="finder-title">労働局を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>都道府県・全国</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：東京、福岡、全国"
              type="search"
            />
          </label>
          <label>
            <span>地域</span>
            <select id="region">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">都道府県コード順</option>
              <option value="ratio-desc">倍率が高い順</option>
              <option value="openings-desc">求人数が多い順</option>
              <option value="change-desc">前年差が大きい順</option>
              <option value="name">名前順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <h2 id="results-title">地域の新規求人倍率</h2>
          <p>
            <b id="result-count">—</b> 地域
          </p>
        </div>
        <div class="place-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">÷</span>
        <div>
          <strong>倍率は「新規求人数 ÷ 新規求職申込件数」</strong>
          <p>
            職業計・常用求人の受理地別集計です。求人票数、応募数、採用確率、賃金、仕事の質、地域の働きやすさを表す順位ではありません。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="新規求人倍率、新規求人数、新規求職申込件数、常用の雇用区分と年度計の読み方を説明します。"
    title="数字の見方 | 地域新規求人倍率"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">数字の見方</p>
        <h1>新規受付どうしを、同じ条件で割る。</h1>
        <p>職業計の新規求人と新規求職申込みを、同じ労働局・年度・雇用区分で対応づけています。</p>
      </div>
      <section class="definition-board">
        <article class="definition-source opening-definition">
          <span>分子</span>
          <h2>新規求人数</h2>
          <p>期間中に新たに受け付けた求人の採用予定人員です。求人票の枚数とは一致しません。</p>
        </article>
        <div class="formula-card">
          <span>新規求人倍率</span>
          <strong>新規求人数 ÷ 新規求職申込件数</strong>
          <p>1倍は新規受付の求人と申込みが同数という意味です。個人の採用確率ではありません。</p>
        </div>
        <article class="definition-source seeker-definition">
          <span>分母</span>
          <h2>新規求職申込件数</h2>
          <p>
            期間中に新たに受け付けた求職申込みの件数です。固有の人数とは一致しない場合があります。
          </p>
        </article>
      </section>
      <section class="guide-grid">
        <article>
          <span>対象</span>
          <h2>職業計</h2>
          <p>職種別表の全体行です。特定職種の倍率は混ぜず、地域全体の元件数を使います。</p>
        </article>
        <article>
          <span>雇用区分</span>
          <h2>3つの常用区分</h2>
          <p>パートを含む常用、パートを除く常用、常用的パートタイムを切り替えられます。</p>
        </article>
        <article>
          <span>年度計・延べ</span>
          <h2>月ごとの合計</h2>
          <p>年度中に新たに受け付けた件数の合計で、前月からの繰越件数は加えません。</p>
        </article>
      </section>
      <section class="note-panel">
        <h2>読み取れないこと</h2>
        <p>
          求人数は求人票の枚数ではなく採用予定人員です。民間求人、応募数、採用数、賃金、待遇、定着は分かりません。倍率だけで地域を評価しないでください。
        </p>
        <a href={termsPage}>厚生労働省 用語の解説</a>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="地域新規求人倍率が利用する厚生労働省の第6表・第7表、加工内容、確認日、利用条件を示します。"
    title="出典とデータ | 地域新規求人倍率"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">出典</p>
        <h1>2つの職業別表から、職業計だけを照合。</h1>
        <p>
          求人と求職の母集団が一致する現行表だけを、全国・47労働局、3年度、3雇用区分で対応づけました。
        </p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>厚生労働省</strong>
          <a href={dataPage}>雇用関係指標（年度）</a>
        </div>
        <div>
          <span>求人</span>
          <strong>第6表 · 新規求人数</strong>
          <a href={openingsWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>新規申込</span>
          <strong>第7表 · 新規求職申込件数</strong>
          <a href={applicationsWorkbook}>公式Excel</a>
        </div>
        <div>
          <span>収録範囲</span>
          <strong>48地域 × 3年度 × 3区分</strong>
          <a href={termsPage}>用語の解説</a>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={useTerms}>厚生労働省の利用規約</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>現行職業分類の第6表と第7表から、職業計の2023〜2025年度だけを抽出しました。</li>
          <li>
            48地域・3年度・3雇用区分の432組、864元値で、地域名・年度・雇用区分を照合しました。
          </li>
          <li>
            パートを含む常用が、パートを除く常用と常用的パートの合計になることを288系列で検算しました。
          </li>
          <li>全国計が47労働局の合計になることを新規求人・新規申込それぞれ9系列で検算しました。</li>
          <li>新規求人数を新規求職申込件数で割り、小数第2位まで表示します。元件数も併記します。</li>
          <li>分類が異なる2022年度以前とは接続せず、欠測や分母0を他地域・他年度で補いません。</li>
          <li>
            出典：厚生労働省「職業安定業務統計 雇用関係指標（年度）第6表・第7表」を加工して作成。
          </li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>ファイル確認</h2>
        <p>2026年8月2日取得。第6表 SHA-256: 99e2cad8…ca8c2、第7表 SHA-256: 83ca2a2c…be8。</p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="地域新規求人倍率の端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 地域新規求人倍率"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="section-kicker">保存</p>
        <h1>選んだ地域は、端末に。</h1>
        <p>検索語、地域名、選択年度、雇用区分をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>比較に選んだ公開地域IDを最大4件だけブラウザへ保存します。アカウントは不要です。</p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>
            訪問、検索、0件、地域・並び順・雇用区分・年度の変更、比較追加、コピーの操作名だけを計測します。
          </p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    asOf: "2026-08-02",
    ok: row?.ok === 1,
    records: 432,
    service: "chiiki-shinki-bairitsu",
  });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 地域新規求人倍率"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="section-kicker">404</p>
          <h1>この地域票は見つかりません。</h1>
          <p>
            <a href="/">地域の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
