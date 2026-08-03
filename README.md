# Mail Configuration Checker

ドメインを入力すると、メール送受信に関係するMX・SPF・DMARCレコードを確認できるWebアプリケーションです。

DNSレコードをそのまま表示するだけでなく、設定状況や補足情報をカード形式で整理し、メール設定に詳しくない方にも確認結果を説明しやすい画面を目指しています。

## 制作背景

業務でメールの不達調査、SPF設定の確認、調査結果の顧客への説明を行う中で、DNSレコードの確認には次のような課題があると感じました。

- MX・SPF・DMARCをそれぞれ別の方法で調査する必要がある
- 取得したDNSレコードを見ただけでは、設定状況を判断しにくい
- 技術的な調査結果を、メールやDNSに詳しくない顧客へ説明するのが難しい

そこで、ドメインを入力するだけで主要なメール設定をまとめて確認し、結果の意味まで把握できるツールを制作しました。

このアプリケーションでは、業務で行っていた「情報を取得する」「設定状況を判断する」「相手に分かりやすく伝える」という流れをWeb上で再現しています。

## 主な機能

### MXレコードの確認

- メール受信サーバーの有無を確認
- MXレコードを優先度順に表示
- 取得したレコード件数を表示
- メールを受信しないことを示すNull MXを判定

### SPFレコードの確認

- SPFレコードの有無を確認
- 複数のSPFレコードが存在する場合に警告
- `include` 機構の数を表示
- `-all`、`~all`、`?all`、`+all` などの終端設定を表示
- 修飾子が省略された `all` を `+all` として判定

### DMARCレコードの確認

- DMARCレコードの有無を確認
- `p=none`、`p=quarantine`、`p=reject` を解析
- 各ポリシーの意味を補足情報として表示

### 診断結果の表示

- MX・SPF・DMARCを個別のカードで表示
- 正常な設定と確認が必要な設定を色分け
- 実際に取得したDNSレコードを表示
- 診断メッセージと補足情報を分けて表示

## 利用の流れ

1. `example.com` のような形式でドメインを入力する
2. 「診断する」ボタンを押す
3. `POST /api/check` へドメインを送信する
4. サーバー側でMX・SPF・DMARCレコードを並行して取得する
5. 解析した結果をJSONで返す
6. 画面に診断結果と実際のDNSレコードを表示する

## 技術構成

| 分類 | 使用技術 |
| --- | --- |
| フレームワーク | Next.js 16（App Router） |
| UI | React 19 |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS 4 |
| DNS取得 | Node.js `node:dns/promises` |
| 静的解析 | ESLint |

## 実装で意識したこと

### 調査結果を説明しやすい形にする

業務では、DNSレコードを取得するだけでなく、その結果を顧客へ分かりやすく説明する必要がありました。その経験を踏まえ、レコードの生データに加えて、件数・終端設定・ポリシーの意味を表示しています。

### DNS取得と画面表示の責務を分ける

DNSの取得と解析は `app/lib/dns.ts`、型定義は `app/types/dns.ts`、結果表示は `app/components/DnsResultCard.tsx` に分割しています。処理の役割を分けることで、診断項目や表示内容を追加しやすい構成にしました。

### 複数のDNS問い合わせを並行処理する

MX・SPF・DMARCは互いに独立した問い合わせのため、`Promise.all` を使用して並行取得しています。順番に問い合わせる場合と比べて、診断結果を返すまでの待ち時間を抑えています。

### 正常と要確認を区別する

レコードが取得できたかだけでなく、SPFレコードの重複やNull MXなども確認し、`success` と `warning` を使い分けています。画面でもステータスに応じて色を変え、確認が必要な項目を見つけやすくしています。

### 入力値をクライアントとAPIの両方で検証する

画面側だけでなくAPI側でもドメイン形式を検証しています。APIが画面以外から直接呼び出された場合でも、不正な入力をDNS問い合わせへ渡さないようにしています。

## API

### `POST /api/check`

リクエスト例：

```json
{
  "domain": "example.com"
}
```

レスポンス例：

```json
{
  "status": "success",
  "message": "DNSレコードを取得しました。",
  "result": {
    "domain": "example.com",
    "mx": {
      "status": "success",
      "message": "MXレコードが設定されています。",
      "records": [
        {
          "exchange": "mail.example.com",
          "priority": 10
        }
      ],
      "details": ["1件のMXレコードが見つかりました。"]
    },
    "spf": {
      "status": "success",
      "message": "SPFレコードが設定されています。",
      "records": ["v=spf1 include:_spf.example.com ~all"],
      "details": ["includeの数：1", "終端設定：~all"]
    },
    "dmarc": {
      "status": "success",
      "message": "DMARCレコードが設定されています。",
      "records": ["v=DMARC1; p=none"],
      "details": [
        "ポリシー：none",
        "受信側にメールの隔離や拒否を要求しないポリシーです。"
      ]
    }
  }
}
```

## セットアップ

### 必要な環境

- Node.js 20.9以上
- npm

### インストールと起動

```bash
git clone https://github.com/git-yuji/mail-checker-app.git
cd mail-checker-app
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 品質確認

```bash
npm run lint
npm run build
```

## 現在の制限

- SPFのDNS Lookup回数や10回制限は判定していません
- SPFの `include` を再帰的には解析していません
- DKIMレコードは確認していません
- DMARCの組織ドメインへのフォールバックは行っていません
- DMARCの `rua`、`ruf`、`pct` は解析していません
- DNS取得に失敗した場合の原因は詳細分類していません

診断結果は参考情報です。実際にDNSやメール設定を変更する場合は、利用中のサーバー会社やメールサービスの公式情報も確認してください。

## 今後追加したい機能

- SPFのDNS Lookup回数と10回制限の判定
- DKIMレコードの確認
- DMARCレポート設定の解析
- DNSエラー原因の詳細表示
- 診断結果のコピー・保存
- 顧客へ共有する説明文の生成

## この開発を通して得たこと

- Next.js App Routerを使用した画面とAPIの実装
- TypeScriptによるAPIレスポンスとコンポーネントPropsの型設計
- Node.jsのDNS APIを利用したMX・TXTレコードの取得
- SPF・DMARCレコードの形式を考慮した文字列解析
- 業務上の課題を、要件・API・UIへ落とし込む考え方
- GitHubのPull Requestとコードレビューを利用した段階的な改善
