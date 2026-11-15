# mail-checker-app セキュリティモデル（脅威モデル）

対象: `git-yuji/mail-checker-app`（コミット 64d7ebb 時点）。本書はコードから作成し、リポジトリ所有者の回答で確認された事実は「ユーザー回答」と明記しています。セキュリティスキャンはこのファイルを出発点に検出結果の優先度を判断します。

## システム概要と信頼境界
- ドメインと DKIM セレクタを入力すると、MX / SPF / DMARC / DKIM の DNS レコードを取得・診断する公開 Web アプリ。
- Next.js 16（App Router）+ React 19 を OpenNext で Cloudflare Workers にデプロイ（`wrangler.jsonc`、`open-next.config.ts`）。
- 認証・ログイン・データベース・永続ストレージ・シークレットは存在しない（コード上確認）。
- 信頼境界:
  1. インターネット上の匿名ユーザー → `POST /api/check`（Worker）
  2. Worker → 外部 DNS リゾルバ（`node:dns/promises` の `resolveMx` / `resolveTxt`）。DNS 応答は攻撃者が制御可能な外部データ（攻撃者は自分のドメインに任意の TXT/MX を設定できる）
  3. API 応答 → ブラウザ（React で描画、クリップボードへコピー）

## コンポーネント
| 名前 | 対象コード | 説明 |
| --- | --- | --- |
| API | `app/api/check/route.ts`, `app/lib/request.ts`, `app/lib/domain.ts` | 入力の受付・検証（JSON のみ、本文 1KB、ドメイン 253 文字、キーは domain/dkimSelector の2つのみ） |
| RateLimit | `app/lib/rate-limit.ts`, `wrangler.jsonc` の `ratelimits` | Cloudflare Rate Limiting（`cf-connecting-ip` 単位で 10 回 / 60 秒）。binding 不在・失敗時は 503（fail-closed） |
| DNS診断 | `app/lib/dns.ts`, `app/lib/dkim.ts`, `app/types/dns.ts` | DNS 問い合わせ（各 5 秒タイムアウト）と診断ロジック、DKIM 公開鍵の解析（`node:crypto` `createPublicKey`） |
| WebUI | `app/page.tsx`, `app/layout.tsx`, `app/components/*`, `app/lib/format-result.ts`, `app/lib/recommendations.ts` | 結果表示、推奨事項、技術者向け/顧客向け文章のコピー |
| ビルド・配備 | `package.json`, `package-lock.json`, `.github/workflows/node-validation.yml`, `wrangler.jsonc`, `next.config.ts`, `.githooks/`, `scripts/` | 依存関係、CI（`permissions: contents: read`）、Cloudflare 設定 |

## エントリポイント
- `POST /api/check`（匿名で到達可能、`runtime = "nodejs"`）
- 静的ページ `/`（Worker の ASSETS）
- CI: `pull_request` / 特定ブランチへの push で起動する GitHub Actions

## 資産とデータの重要度
- ユーザー回答: 最も重要なのは (1) アプリを使う人のブラウザ（XSS など）と (2) Cloudflare の利用料金・サービスの可用性。
- サービスの可用性と Cloudflare の利用量（Worker 実行・DNS 問い合わせ）
- 利用者のブラウザ（DNS 由来の文字列を表示するため XSS が起きれば影響）
- Cloudflare / GitHub のデプロイ権限（リポジトリ外で管理）
- 個人情報・認証情報は扱わない（入力はドメイン名と DKIM セレクタのみ、保存なし）

## 想定する攻撃者
- ユーザー回答: インターネット上の匿名ユーザーを含め、すべての攻撃者を想定する（どの攻撃者も対象外にしない）。
- 匿名ユーザーは API を直接呼び出せ、自分の DNS ゾーンに任意レコードを置ける。
- 依存パッケージ・CI 経由のサプライチェーン攻撃、GitHub/Cloudflare アカウントの侵害も対象内。

## 既存の対策
- 入力検証: Content-Type 制限、本文サイズの宣言値と実測の両方で 1KB 制限、余分なキー拒否、ドメイン/セレクタの正規表現と長さ制限（`app/lib/domain.ts`）
- DNS 問い合わせタイムアウト 5 秒（`withDnsTimeout`）。ただしタイムアウト後も元の問い合わせはキャンセルされない
- IP 単位のレート制限（fail-closed）。`cf-connecting-ip` がない場合は全員が `unknown-client` キーを共有
- React のテキスト描画（`dangerouslySetInnerHTML` 不使用）、エラー詳細はサーバーログのみ
- CI トークンは read 権限のみ

## 対象外・許容するリスク（ユーザー回答）
- 個人のポートフォリオ用途のため、低〜中程度の問題は許容する（受容リスク）。ただし上記の重要資産（利用者ブラウザ、Cloudflare 料金・可用性）に届く問題はこの限りではない。
- DoS は許容しない（重要資産として可用性・利用料金が挙げられているため）。

## 未解決の質問
- ユーザー回答: 別のインフラリポジトリはない（`wrangler.jsonc` のみ）。Cloudflare ダッシュボード側の設定（WAF、カスタムドメイン、予算アラート等）はコードから確認できない。
