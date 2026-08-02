# Source and transformation

## Official sources

- Provider: 厚生労働省
- Statistics page: <https://www.mhlw.go.jp/toukei/list/114-1d.html>
- Item 6, new job openings by occupation: <https://www.mhlw.go.jp/toukei/list/xls/114-1d-06.xlsx>
- Item 7, new job applications by occupation: <https://www.mhlw.go.jp/toukei/list/xls/114-1d-07.xlsx>
- Definitions: <https://www.mhlw.go.jp/toukei/list/114-1_yougo.html>
- Edition: 2023〜2025年度（現行職業分類）
- Source verification: 2026-08-02
- Openings workbook: 991,012 bytes; SHA-256 `99e2cad815251763fdb05265e6a8b0be29d04db9615e997646db402591dca8c2`
- Applications workbook: 22,874,210 bytes; SHA-256 `83ca2a2cdc31a51f075c057456ee4a7cadea8db63925e890cc711156e62b2be8`
- Terms: 公共データ利用規約（第1.0版）
- Terms page: <https://www.mhlw.go.jp/chosakuken/index.html>

出典：厚生労働省「一般職業紹介状況（職業安定業務統計）雇用関係指標（年度）」第6表・第7表を加工して作成。

## Verified dimensions

- 全国と47労働局、48地域
- 2023〜2025年度、3年度
- パートを含む常用、パートを除く常用、常用的パートタイム、3区分
- 職業計の新規求人と新規申込を対応づけた432組、864元値
- 欠測0、分母0は0
- 雇用区分の合計関係を新規求人・新規申込288系列で検算し、不一致0
- 全国計と47労働局合計を新規求人・新規申込18系列で検算し、不一致0
- 2025年度全国・パートを含む常用は8,603,526求人、4,362,423申込、1.97倍

## Transformation / 加工

1. 第6表・第7表の現行職業分類シートから「職業計」の2023〜2025年度を読み取る。
2. 地域、年度、雇用区分が一致する新規求人と新規申込だけを対応づける。
3. 雇用区分の合計関係、全国計と47労働局合計、整数、欠測、分母0を検算する。
4. 労働局名を都道府県名へ短縮し、9地域と全国に分類する。
5. 加工前の整数値を静的JSONへ保存し、新規求人倍率は画面表示時に算出する。
6. 表示とコピーは小数第2位とし、2つの元件数を常に併記する。

公式Excelのハッシュが変わった場合は、更新内容を人が確認してから再生成します。分類が異なる2022年度以前へ接続しません。

## Interpretation boundary

新規求人数は期間中に新たに受け付けた採用予定人員、新規求職申込件数は期間中に新たに受け付けた申込みの件数です。求人票の枚数や固有の求職者数とは一致しない場合があります。前月からの繰越件数を加える有効求人倍率とは異なり、応募数、採用数、賃金、待遇、定着、民間求人を含む市場全体は示しません。
