# 地域新規求人倍率

全国・47労働局の職業計の新規求人倍率を、2023〜2025年度、3つの常用雇用区分から選び、新規求人・新規申込の元件数とともに最大4地域で比較する日本語Webサービスです。

- Production: <https://chiiki-shinki-bairitsu.yhay81.com>
- Source: 厚生労働省「一般職業紹介状況（職業安定業務統計）雇用関係指標（年度）」第6表・第7表
- Runtime: Cloudflare Workers + Hono JSX + Vite+ + D1
- Account: 不要

## Commands

```powershell
npm install
npm run data:check
npm run check
npm test
npm run build
npm run dev
```

公開前は`npm run release:check`を実行します。D1 migrationを適用してから`npm run deploy`で配信します。

## Data boundary

倍率は同じ労働局・年度・常用雇用区分の「新規求人数 ÷ 新規求職申込件数」です。前月からの繰越を含む有効求人倍率とは別です。求人票数、固有の求職者数、採用確率、仕事の質、地域順位ではありません。

コードはMIT Licenseです。データの利用条件は[SOURCE.md](SOURCE.md)を参照してください。
